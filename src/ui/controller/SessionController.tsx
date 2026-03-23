import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { ModalityPath, SessionState } from '../../common/models';
import { AudioChunker, ExpoAudioPipeline } from '../../pipeline/audio';
import { TranscriptStore } from '../../store';

export type SessionControllerValue = {
  sessionId: string | null;
  state: SessionState;
  activePath: ModalityPath | null;
  /** Shared transcript timeline for the active session. */
  store: TranscriptStore;

  startSession: (path: ModalityPath) => Promise<void>;
  pauseSession: () => void;
  resumeSession: () => void;
  stopSession: () => void;
  getState: () => SessionState;
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

  // Stable store instance — lives for the lifetime of the provider.
  // Cleared at the start of each new session and on stop.
  const store = useMemo(() => new TranscriptStore(), []);

  // Audio pipeline and chunker — stable across renders, one instance per provider.
  const audioPipeline = useRef(new ExpoAudioPipeline());
  const audioChunker = useRef(new AudioChunker());

  const stateRef = useRef(state);
  stateRef.current = state;

  const activePathRef = useRef(activePath);
  activePathRef.current = activePath;

  const getState = useCallback(() => stateRef.current, []);

  const startSession = useCallback(async (path: ModalityPath) => {
    try {
      setState(SessionState.INITIALIZING);
      store.clear();
      const newSessionId = uuidV4();
      setSessionId(newSessionId);
      setActivePath(path);

      if (path === ModalityPath.SPEECH) {
        await audioPipeline.current.start(newSessionId);
        audioChunker.current.start(newSessionId);
        audioPipeline.current.onFrame((frame) => audioChunker.current.push(frame));
      }

      setState(SessionState.RUNNING);
    } catch (e) {
      setState(SessionState.ERROR);
      throw e;
    }
  }, [store]);

  const pauseSession = useCallback(() => {
    if (stateRef.current !== SessionState.RUNNING) return;
    if (activePathRef.current === ModalityPath.SPEECH) {
      audioPipeline.current.pause();
    }
    setState(SessionState.PAUSED);
  }, []);

  const resumeSession = useCallback(() => {
    if (stateRef.current !== SessionState.PAUSED) return;
    if (activePathRef.current === ModalityPath.SPEECH) {
      audioPipeline.current.resume();
    }
    setState(SessionState.RUNNING);
  }, []);

  const stopSession = useCallback(() => {
    audioPipeline.current.stop();
    audioChunker.current.stop();
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

    const interval = setInterval(() => {
      const health = audioPipeline.current.getHealth();
      if (!health.available && stateRef.current === SessionState.RUNNING) {
        setState(SessionState.DEGRADED);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state, activePath]);

  const value = useMemo<SessionControllerValue>(
    () => ({
      sessionId,
      state,
      activePath,
      store,
      startSession,
      pauseSession,
      resumeSession,
      stopSession,
      getState,
    }),
    [activePath, getState, pauseSession, resumeSession, sessionId, startSession, state, stopSession, store]
  );

  return <SessionControllerContext.Provider value={value}>{children}</SessionControllerContext.Provider>;
}

export function useSessionController(): SessionControllerValue {
  const ctx = useContext(SessionControllerContext);
  if (!ctx) throw new Error('useSessionController must be used within SessionControllerProvider');
  return ctx;
}

