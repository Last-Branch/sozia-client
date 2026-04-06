import type { IConfigurationManager } from './Configuration';

const LOG_STORAGE_KEY = 'sozia.diagnostics.log.v1';
const MAX_ENTRIES = 500;

export type DiagnosticLevel = 'info' | 'warn' | 'error';

type DiagnosticEntry = {
  ts: number;
  level: DiagnosticLevel;
  message: string;
  data?: Record<string, unknown>;
};

type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
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

function sanitizeData(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const k = key.toLowerCase();
    if (
      k.includes('raw') ||
      k.includes('audio') ||
      k.includes('video') ||
      k.includes('pcm') ||
      k.includes('frame')
    ) {
      out[key] = '[REDACTED]';
      continue;
    }
    if (Array.isArray(value)) {
      out[key] = `[Array(${value.length})]`;
      continue;
    }
    if (value && typeof value === 'object') {
      out[key] = '[Object]';
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * Opt-in diagnostics logger for sozia.client.config.
 * Writes bounded entries to local persistent storage if available.
 */
export class DiagnosticsLogger {
  private readonly config: IConfigurationManager;
  private readonly storage: KeyValueStorage | null;
  private entries: DiagnosticEntry[] = [];
  private readonly logPath = 'local://sozia/diagnostics.log';

  constructor(config: IConfigurationManager, storage: KeyValueStorage | null = getBrowserStorage()) {
    this.config = config;
    this.storage = storage;
  }

  log(level: DiagnosticLevel, message: string, data?: Record<string, unknown>): void {
    if (!this.isEnabled()) return;

    const entry: DiagnosticEntry = {
      ts: Date.now(),
      level,
      message,
      ...(data ? { data: sanitizeData(data) } : {}),
    };

    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(this.entries.length - MAX_ENTRIES);
    }
  }

  async flush(): Promise<void> {
    if (!this.isEnabled() || !this.storage) return;
    this.storage.setItem(LOG_STORAGE_KEY, JSON.stringify(this.entries));
  }

  clear(): void {
    this.entries = [];
    this.storage?.removeItem(LOG_STORAGE_KEY);
  }

  getLogPath(): string {
    return this.logPath;
  }

  private isEnabled(): boolean {
    return this.config.get('diagnosticsEnabled') === true;
  }
}
