import { DiagnosticsLogger } from '@/config/DiagnosticsLogger';
import type { AppConfig, IConfigurationManager } from '@/config/Configuration';

type KV = {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
};

function makeStorage(seed: Record<string, string> = {}): KV & { data: Record<string, string> } {
  const data = { ...seed };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

const LOG_KEY = 'sozia.diagnostics.log.v1';

function makeConfig(enabled: boolean): IConfigurationManager {
  const values: AppConfig = {
    selectedMicId: null,
    selectedCameraId: null,
    defaultPath: 'SPEECH' as AppConfig['defaultPath'],
    fontSize: 16,
    confidenceThreshold: 0.3,
    chunkDurationMs: 1000,
    serverUrl: 'wss://...',
    maxReconnectAttempts: 5,
    diagnosticsEnabled: enabled,
    vadSensitivity: 'medium',
  };

  return {
    load: async () => {},
    save: async () => {},
    get: <K extends keyof AppConfig>(key: K): AppConfig[K] => values[key],
    set: () => {},
    reset: () => {},
  };
}

describe('DiagnosticsLogger', () => {
  test('does nothing when diagnostics disabled', async () => {
    const s = makeStorage();
    const logger = new DiagnosticsLogger(makeConfig(false), s);

    logger.log('info', 'hello', { x: 1 });
    await logger.flush();

    expect(s.data[LOG_KEY]).toBeUndefined();
  });

  test('writes when diagnostics enabled', async () => {
    const s = makeStorage();
    const logger = new DiagnosticsLogger(makeConfig(true), s);

    logger.log('info', 'hello', { x: 1 });
    await logger.flush();

    const entries = JSON.parse(s.data[LOG_KEY]);
    expect(entries.length).toBe(1);
    expect(entries[0].message).toBe('hello');
  });

  test('redacts sensitive keys', async () => {
    const s = makeStorage();
    const logger = new DiagnosticsLogger(makeConfig(true), s);

    logger.log('warn', 'sensitive', { rawAudio: 'abc', videoFrame: [1, 2, 3] });
    await logger.flush();

    const entries = JSON.parse(s.data[LOG_KEY]);
    expect(entries[0].data.rawAudio).toBe('[REDACTED]');
    expect(entries[0].data.videoFrame).toBe('[REDACTED]');
  });

  test('clear removes persisted logs', async () => {
    const s = makeStorage();
    const logger = new DiagnosticsLogger(makeConfig(true), s);

    logger.log('info', 'a');
    await logger.flush();
    expect(s.data[LOG_KEY]).toBeDefined();

    logger.clear();
    expect(s.data[LOG_KEY]).toBeUndefined();
  });

  test('keeps max 500 entries', async () => {
    const s = makeStorage();
    const logger = new DiagnosticsLogger(makeConfig(true), s);

    for (let i = 0; i < 550; i++) logger.log('info', `msg-${i}`);
    await logger.flush();

    const entries = JSON.parse(s.data[LOG_KEY]);
    expect(entries.length).toBe(500);
  });

  test('getLogPath returns stable path', () => {
    const logger = new DiagnosticsLogger(makeConfig(true), makeStorage());
    expect(logger.getLogPath()).toBe('local://sozia/diagnostics.log');
  });
});
