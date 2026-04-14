import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { ModalityPath, SessionState, type PipelineHealth } from '../../common/models';
import type { DeviceHandle } from '../../device';
import { ExpoAudioPipeline } from '../../pipeline/audio';
import { VideoPipeline } from '../../pipeline/video';
import { DeviceManager, ExpoDeviceEnumerator } from '../../device';
import { TranscriptStore } from '../../store';
import { TransmissionManager } from '../../transmission';
import { Configuration, type IConfigurationManager } from '../../config';
import { buildSessionActions } from './sessionActions';

export type SessionControllerValue = {
  sessionId: string | null;
  state: SessionState;
  activePath: ModalityPath | null;
  store: TranscriptStore;
  healthReports: PipelineHealth[];
  config: IConfigurationManager;

  startSession: (path: ModalityPath) => Promise<void>;
  pauseSession: () => void;
  resumeSession: () => void;
  stopSession: () => void;
  getState: () => SessionState;
  onPipelineHealthChanged: (health: PipelineHealth) => void;
  onConnectionLost: () => void;
  enumerateDevices: () => Promise<DeviceHandle[]>;
  selectMicrophone: (id: string) => void;
  selectCamera: (id: string) => void;
};

const SessionControllerContext = createContext<SessionControllerValue | null>(null);

function uuidV4(): string {
  const anyGlobal = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  const maybe = anyGlobal.crypto?.randomUUID?.();
  if (typeof maybe === 'string' && maybe.length > 0) return maybe;

  const hex = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));
  const r = () => Math.floor(Math.random() * 256);
  const b = new Uint8Array([r(), r(), r(), r(), r(), r(), r(), r(), r(), r(), r(), r(), r(), r(), r(), r()]);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  return (
    hex[b[0]] +
    hex[b[1]] +
    hex[b[2]] +
    hex[b[3]] +
    '-' +
    hex[b[4]] +
    hex[b[5]] +
    '-' +
    hex[b[6]] +
    hex[b[7]] +
    '-' +
    hex[b[8]] +
    hex[b[9]] +
    '-' +
    hex[b[10]] +
    hex[b[11]] +
    hex[b[12]] +
    hex[b[13]] +
    hex[b[14]] +
    hex[b[15]]
  );
}

export function SessionControllerProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [state, setState] = useState<SessionState>(SessionState.IDLE);
  const [activePath, setActivePath] = useState<ModalityPath | null>(null);
  const [healthReports, setHealthReports] = useState<PipelineHealth[]>([]);

  const store = useMemo(() => new TranscriptStore(), []);

  const deviceManager = useRef(
    new DeviceManager(new ExpoDeviceEnumerator(), new ExpoAudioPipeline(), new VideoPipeline()),
  );
  const config = useRef<IConfigurationManager>(new Configuration());
  const transmissionManager = useRef<TransmissionManager | null>(null);

  // Load persisted configuration on mount, then apply settings that gate pipeline behaviour.
  useEffect(() => {
    void config.current.load().then(() => {
      deviceManager.current.setAudioVadSensitivity(config.current.get('vadSensitivity'));
    });
  }, []);

  const stateRef = useRef(state);
  stateRef.current = state;

  const activePathRef = useRef(activePath);
  activePathRef.current = activePath;

  const healthReportsRef = useRef(healthReports);
  healthReportsRef.current = healthReports;

  const getState = useCallback(() => stateRef.current, []);

  const actions = useMemo(
    () =>
      buildSessionActions({
        getState: () => stateRef.current,
        setState,
        getHealthReports: () => healthReportsRef.current,
        setHealthReports,
      }),
    []
  );

  const enumerateDevices = useCallback(
    () => deviceManager.current.enumerateDevices(),
    []
  );

  const selectMicrophone = useCallback(
    (id: string) => deviceManager.current.selectMicrophone(id),
    []
  );

  const selectCamera = useCallback(
    (id: string) => deviceManager.current.selectCamera(id),
    []
  );

  const startSession = useCallback(async (path: ModalityPath) => {
    try {
      setState(SessionState.INITIALIZING);
      store.clear();
      const newSessionId = uuidV4();
      setSessionId(newSessionId);
      setActivePath(path);

      const savedCameraId = config.current.get('selectedCameraId');
      if (savedCameraId) deviceManager.current.selectCamera(savedCameraId);
      await deviceManager.current.activateCamera();

      if (path === ModalityPath.SPEECH) {
        const savedMicId = config.current.get('selectedMicId');
        if (savedMicId) deviceManager.current.selectMicrophone(savedMicId);
        await deviceManager.current.activateMicrophone();
      }

      const serverUrl = config.current.get('serverUrl') ?? 'ws://localhost:8080';
      const maxReconnectAttempts = config.current.get('maxReconnectAttempts') ?? 5;
      transmissionManager.current = new TransmissionManager(
        serverUrl,
        store,
        actions.onConnectionLost,
        maxReconnectAttempts,
      );

      if (path === ModalityPath.SPEECH) {
        await deviceManager.current.startAudioPipeline(newSessionId, {}, transmissionManager.current);
      } else if (path === ModalityPath.SIGN) {
        await deviceManager.current.startVideoPipeline(newSessionId, {}, transmissionManager.current);
      }

      // Connect in the background — the 50-frame send buffer holds frames
      // produced during the connection window. onConnectionLost handles failure.
      void transmissionManager.current.connect(newSessionId, path)
        .catch(() => { actions.onConnectionLost(); });

      setState(SessionState.RUNNING);
    } catch (e) {
      setState(SessionState.ERROR);
      throw e;
    }
  }, [store, actions]);

  const pauseSession = useCallback(() => {
    if (stateRef.current !== SessionState.RUNNING) return;
    deviceManager.current.pauseAllPipelines();
    setState(SessionState.PAUSED);
  }, []);

  const resumeSession = useCallback(() => {
    if (stateRef.current !== SessionState.PAUSED) return;
    deviceManager.current.resumeAllPipelines();
    setState(SessionState.RUNNING);
  }, []);

  const stopSession = useCallback(() => {
    deviceManager.current.stopAllPipelines();
    transmissionManager.current?.disconnect();
    transmissionManager.current = null;
    setState(SessionState.IDLE);
    setSessionId(null);
    setActivePath(null);
    store.clear();
  }, [store]);

  // Poll audio pipeline health every second while a SPEECH session is active.
  // Transitions RUNNING → DEGRADED if the pipeline becomes unavailable.
  useEffect(() => {
    if (activePath !== ModalityPath.SPEECH) return;
    if (state !== SessionState.RUNNING && state !== SessionState.DEGRADED) return;

    let mounted = true;
    const interval = setInterval(() => {
      if (!mounted) return;
      const health = deviceManager.current.getAudioHealth();
      actions.onPipelineHealthChanged(health);
    }, 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [state, activePath, actions]);

  // Poll video pipeline health every second while a SIGN session is active.
  // Transitions RUNNING → DEGRADED if tracking becomes unavailable.
  useEffect(() => {
    if (activePath !== ModalityPath.SIGN) return;
    if (state !== SessionState.RUNNING && state !== SessionState.DEGRADED) return;

    let mounted = true;
    const interval = setInterval(() => {
      if (!mounted) return;
      const health = deviceManager.current.getVideoHealth();
      actions.onPipelineHealthChanged(health);
    }, 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [state, activePath, actions]);

  const value = useMemo<SessionControllerValue>(
    () => ({
      sessionId,
      state,
      activePath,
      store,
      healthReports,
      config: config.current,
      startSession,
      pauseSession,
      resumeSession,
      stopSession,
      getState,
      onPipelineHealthChanged: actions.onPipelineHealthChanged,
      onConnectionLost: actions.onConnectionLost,
      enumerateDevices,
      selectMicrophone,
      selectCamera,
    }),
    [actions, activePath, enumerateDevices, getState, healthReports, pauseSession, resumeSession, selectCamera, selectMicrophone, sessionId, startSession, state, stopSession, store]
  );

  return <SessionControllerContext.Provider value={value}>{children}</SessionControllerContext.Provider>;
}

export function useSessionController(): SessionControllerValue {
  const ctx = useContext(SessionControllerContext);
  if (!ctx) throw new Error('useSessionController must be used within SessionControllerProvider');
  return ctx;
}
