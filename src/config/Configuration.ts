import { ModalityPath } from '../common/models';

const CONFIG_STORAGE_KEY = 'sozia.config.v1';

export interface AppConfig {
  selectedMicId: string | null;
  selectedCameraId: string | null;
  defaultPath: ModalityPath;
  fontSize: number;
  confidenceThreshold: number;
  chunkDurationMs: number;
  serverUrl: string;
  maxReconnectAttempts: number;
  diagnosticsEnabled: boolean;
}

export interface IConfigurationManager {
  load(): Promise<void>;
  save(): Promise<void>;
  get<K extends keyof AppConfig>(key: K): AppConfig[K];
  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void;
  reset(): void;
}

type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const DEFAULT_CONFIG: AppConfig = {
  selectedMicId: null,
  selectedCameraId: null,
  defaultPath: ModalityPath.SPEECH,
  fontSize: 16,
  confidenceThreshold: 0.3,
  chunkDurationMs: 1000,
  serverUrl: 'wss://...',
  maxReconnectAttempts: 5,
  diagnosticsEnabled: false,
};

function getBrowserStorage(): KeyValueStorage | null {
  const maybeStorage = (globalThis as { localStorage?: KeyValueStorage }).localStorage;
  if (!maybeStorage) return null;
  if (
    typeof maybeStorage.getItem !== 'function' ||
    typeof maybeStorage.setItem !== 'function' ||
    typeof maybeStorage.removeItem !== 'function'
  ) {
    return null;
  }
  return maybeStorage;
}

function clampNumber(value: unknown, fallback: number, min?: number, max?: number): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) return fallback;
  let out = value;
  if (typeof min === 'number') out = Math.max(min, out);
  if (typeof max === 'number') out = Math.min(max, out);
  return out;
}

function mergeWithDefaults(raw: unknown): AppConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CONFIG };
  const input = raw as Partial<AppConfig>;
  return {
    selectedMicId: typeof input.selectedMicId === 'string' ? input.selectedMicId : null,
    selectedCameraId: typeof input.selectedCameraId === 'string' ? input.selectedCameraId : null,
    defaultPath: input.defaultPath === ModalityPath.SIGN ? ModalityPath.SIGN : ModalityPath.SPEECH,
    fontSize: clampNumber(input.fontSize, DEFAULT_CONFIG.fontSize, 8, 72),
    confidenceThreshold: clampNumber(input.confidenceThreshold, DEFAULT_CONFIG.confidenceThreshold, 0, 1),
    chunkDurationMs: clampNumber(input.chunkDurationMs, DEFAULT_CONFIG.chunkDurationMs, 100, 10000),
    serverUrl: typeof input.serverUrl === 'string' && input.serverUrl.length > 0
      ? input.serverUrl
      : DEFAULT_CONFIG.serverUrl,
    maxReconnectAttempts: clampNumber(input.maxReconnectAttempts, DEFAULT_CONFIG.maxReconnectAttempts, 0, 50),
    diagnosticsEnabled: input.diagnosticsEnabled === true,
  };
}

/**
 * Persists and provides app preferences for sozia.client.config.
 * Backed by localStorage when available; otherwise in-memory fallback.
 */
export class Configuration implements IConfigurationManager {
  private readonly storage: KeyValueStorage | null;
  private config: AppConfig = { ...DEFAULT_CONFIG };

  constructor(storage: KeyValueStorage | null = getBrowserStorage()) {
    this.storage = storage;
  }

  async load(): Promise<void> {
    if (!this.storage) return;
    try {
      const serialized = this.storage.getItem(CONFIG_STORAGE_KEY);
      if (!serialized) {
        this.config = { ...DEFAULT_CONFIG };
        return;
      }
      this.config = mergeWithDefaults(JSON.parse(serialized));
    } catch {
      // Corrupted entries should never crash startup.
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  async save(): Promise<void> {
    if (!this.storage) return;
    this.storage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.config));
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.config = { ...this.config, [key]: value };
    void this.save();
  }

  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
    void this.save();
  }
}

export function getDefaultAppConfig(): AppConfig {
  return { ...DEFAULT_CONFIG };
}
