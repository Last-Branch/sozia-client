import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { ModalityPath, SessionState, type LandmarkFrame, type PipelineHealth, type SessionStatusMessage } from '@common/models';
import type { DeviceHandle } from '@/device';
import { ExpoAudioPipeline } from '@/pipeline/audio';
import {
  LandmarkExtractor,
  NativeLandmarkBridge,
  NativeMediaPipeLandmarkBackend,
  VideoPipeline,
  WebMediaPipeLandmarkBackend,
} from '@/pipeline/video';
import { DeviceManager, ExpoDeviceEnumerator } from '@/device';
import { TranscriptStore } from '@/store';
import { DisconnectBeforeReadyError, TransmissionManager } from '@/transmission';
import { Configuration, type IConfigurationManager } from '@/config';
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
  /** Stops the session then starts again with the same modality (live screen Restart). */
  restartSession: () => Promise<void>;
  getState: () => SessionState;
  onPipelineHealthChanged: (health: PipelineHealth) => void;
  onConnectionLost: () => void;
  enumerateDevices: () => Promise<DeviceHandle[]>;
  selectMicrophone: (id: string) => void;
  selectCamera: (id: string) => void;
  setCameraVideoElement: (el: HTMLVideoElement | null) => void;
  setNativeLandmarks: (frame: LandmarkFrame | null) => void;
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

  const isNative = Platform.OS === 'ios' || Platform.OS === 'android';
  const landmarkBackend = useRef(
    isNative ? new NativeMediaPipeLandmarkBackend() : new WebMediaPipeLandmarkBackend(),
  );
  const deviceManager = useRef(
    new DeviceManager(
      new ExpoDeviceEnumerator(),
      new ExpoAudioPipeline(),
      new VideoPipeline(new LandmarkExtractor(landmarkBackend.current)),
    ),
  );
  const config = useRef<IConfigurationManager>(new Configuration());
  const transmissionManager = useRef<TransmissionManager | null>(null);

  useEffect(() => {
    void config.current.load().then(() => {
      deviceManager.current.setAudioVadSensitivity(config.current.get('vadSensitivity'));
    });
    if (!isNative) {
      // WebMediaPipeLandmarkBackend requires async model loading; native backend
      // is model-loaded by the JSI plugin on a background thread.
      const backend = landmarkBackend.current as { init?: () => Promise<void> };
      void backend.init?.();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const setCameraVideoElement = useCallback((el: HTMLVideoElement | null) => {
    cameraVideoRef.current = el;
    if (el) {
      deviceManager.current.updateVideoCameraHandle({
        getFrame: () => ({
          timestampMs: Date.now(),
          width: el.videoWidth,
          height: el.videoHeight,
          data: el,
        }),
      });
    }
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
        getModalityPath: () => activePathRef.current,
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

  const setNativeLandmarks = useCallback((frame: LandmarkFrame | null) => {
    NativeLandmarkBridge.setLatestFrame(frame);
  }, []);

  const startSession = useCallback(async (path: ModalityPath) => {
    try {
      deviceManager.current.stopAllPipelines();
      transmissionManager.current?.disconnect();
      transmissionManager.current = null;

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
      const apiKey = config.current.get('apiKey') ?? '';

      const handleSessionStatus = (msg: SessionStatusMessage) => {
        if (msg.state === SessionState.ERROR) {
          actions.onConnectionLost();
        }
      };

      transmissionManager.current = new TransmissionManager(
        serverUrl,
        store,
        actions.onConnectionLost,
        maxReconnectAttempts,
        handleSessionStatus,
        () => { actions.onConnectionLost(); },
      );

      const videoEl = cameraVideoRef.current;
      const cameraHandle = videoEl
        ? { getFrame: () => ({ timestampMs: Date.now(), width: videoEl.videoWidth, height: videoEl.videoHeight, data: videoEl }) }
        : {};

      if (path === ModalityPath.SPEECH) {
        await deviceManager.current.startAudioPipeline(newSessionId, {}, transmissionManager.current);
        await deviceManager.current.startVideoPipeline(newSessionId, cameraHandle, transmissionManager.current);
      } else if (path === ModalityPath.SIGN) {
        await deviceManager.current.startVideoPipeline(newSessionId, cameraHandle, transmissionManager.current);
      }

      // Connect in the background — the send buffer holds frames produced
      // during the connection window. onConnectionLost handles failure.
      void transmissionManager.current.connect(newSessionId, path, apiKey).catch((err: unknown) => {
        if (err instanceof DisconnectBeforeReadyError) return;
        actions.onConnectionLost();
      });

      deviceManager.current.pauseAllPipelines();
      setState(SessionState.PAUSED);
    } catch (e) {
      setState(SessionState.ERROR);
      throw e;
    }
  }, [store, actions]);

  const pauseSession = useCallback(() => {
    const s = stateRef.current;
    // Allow pause from DEGRADED too — health polling moves RUNNING → DEGRADED when a
    // pipeline flags unavailable; pause must still stop capture/inference work.
    if (s !== SessionState.RUNNING && s !== SessionState.DEGRADED) return;
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

  const restartSession = useCallback(async () => {
    const path = activePathRef.current ?? ModalityPath.SPEECH;
    stopSession();
    try {
      await startSession(path);
    } catch (e) {
      if (__DEV__) console.warn('restartSession failed', e);
    }
  }, [stopSession, startSession]);

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
      transmissionManager.current?.sendHealth(health);
    }, 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [state, activePath, actions]);

  useEffect(() => {
    if (!activePath) return;
    if (state !== SessionState.RUNNING && state !== SessionState.DEGRADED) return;

    let mounted = true;
    const interval = setInterval(() => {
      if (!mounted) return;
      const health = deviceManager.current.getVideoHealth();
      actions.onPipelineHealthChanged(health);
      transmissionManager.current?.sendHealth(health);
    }, 3000);

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
      restartSession,
      getState,
      onPipelineHealthChanged: actions.onPipelineHealthChanged,
      onConnectionLost: actions.onConnectionLost,
      enumerateDevices,
      selectMicrophone,
      selectCamera,
      setCameraVideoElement,
      setNativeLandmarks,
    }),
    [actions, activePath, enumerateDevices, getState, healthReports, pauseSession, restartSession, resumeSession, selectCamera, selectMicrophone, sessionId, startSession, state, stopSession, store, setCameraVideoElement, setNativeLandmarks]
  );

  return <SessionControllerContext.Provider value={value}>{children}</SessionControllerContext.Provider>;
}

export function useSessionController(): SessionControllerValue {
  const ctx = useContext(SessionControllerContext);
  if (!ctx) throw new Error('useSessionController must be used within SessionControllerProvider');
  return ctx;
}
