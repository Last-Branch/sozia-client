import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { ModalityPath, SessionState } from '../common/models';

export type SessionControllerValue = {
  sessionId: string | null;
  state: SessionState;
  activePath: ModalityPath | null;

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

  const stateRef = useRef(state);
  stateRef.current = state;

  const getState = useCallback(() => stateRef.current, []);

  const startSession = useCallback(async (path: ModalityPath) => {
    try {
      setState(SessionState.INITIALIZING);
      const newSessionId = uuidV4();
      setSessionId(newSessionId);
      setActivePath(path);

      setState(SessionState.RUNNING);
    } catch (e) {
      setState(SessionState.ERROR);
      throw e;
    }
  }, []);

  const pauseSession = useCallback(() => {
    setState((prev) => (prev === SessionState.RUNNING ? SessionState.PAUSED : prev));
  }, []);

  const resumeSession = useCallback(() => {
    setState((prev) => (prev === SessionState.PAUSED ? SessionState.RUNNING : prev));
  }, []);

  const stopSession = useCallback(() => {
    setState(SessionState.IDLE);
    setSessionId(null);
    setActivePath(null);
  }, []);

  const value = useMemo<SessionControllerValue>(
    () => ({
      sessionId,
      state,
      activePath,
      startSession,
      pauseSession,
      resumeSession,
      stopSession,
      getState,
    }),
    [activePath, getState, pauseSession, resumeSession, sessionId, startSession, state, stopSession]
  );

  return <SessionControllerContext.Provider value={value}>{children}</SessionControllerContext.Provider>;
}

export function useSessionController(): SessionControllerValue {
  const ctx = useContext(SessionControllerContext);
  if (!ctx) throw new Error('useSessionController must be used within SessionControllerProvider');
  return ctx;
}

