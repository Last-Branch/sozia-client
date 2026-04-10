import type { LandmarkFrame, AudioFeatureChunk, PipelineHealth, ModalityPath } from '../common/models';
import type { TranscriptStore } from '../store/TranscriptStore';
import { FeatureSerializer } from './FeatureSerializer';
import { SegmentReceiver } from './SegmentReceiver';

// ---------------------------------------------------------------------------
// WebSocket abstraction (avoids referencing the global type, which is not
// present in the Node test environment — only in React Native / browser).
// ---------------------------------------------------------------------------

interface WebSocketInstance {
  readonly readyState: number;
  onopen: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  send(data: string): void;
  close(): void;
}

const WS_OPEN = 1;

function openSocket(url: string): WebSocketInstance {
  // WebSocket is a global in React Native and is replaced by FakeWebSocket in tests.
  return new (globalThis as any).WebSocket(url) as WebSocketInstance;
}

function isValidWsUrl(url: string): boolean {
  if (!url.startsWith('ws://') && !url.startsWith('wss://')) return false;
  try {
    const parsed = new URL(url);
    // Host must be a real hostname or IP, not a placeholder like "..."
    return parsed.hostname.length > 0 && !/^\.+$/.test(parsed.hostname);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReadyResolver {
  resolve: () => void;
  reject: (err: Error) => void;
}

const MAX_BUFFER_SIZE = 50;
const CONNECT_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// TransmissionManager
// ---------------------------------------------------------------------------

/**
 * Single WebSocket chokepoint between the Sozia client and the inference
 * server (dependency rule R4 — only this package may open network connections).
 *
 * Lifecycle:
 *   connect() → RUNNING ↔ PAUSED (reconnecting) → disconnect()
 *
 * Reconnection uses exponential backoff (1 s, 2 s, 4 s, 8 s, 16 s) up to
 * `maxReconnectAttempts`. Outbound messages are buffered during outages and
 * flushed when the socket reopens.
 */
export class TransmissionManager {
  private readonly serverUrl: string;
  private readonly store: TranscriptStore;
  private readonly onConnectionLost: () => void;
  private readonly maxReconnectAttempts: number;

  private readonly serializer = new FeatureSerializer();
  private readonly receiver = new SegmentReceiver();

  private socket: WebSocketInstance | null = null;
  private sessionId: string | null = null;
  private activePath: ModalityPath | null = null;

  private sendBuffer: string[] = [];
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;
  private readyResolver: ReadyResolver | null = null;

  constructor(
    serverUrl: string,
    store: TranscriptStore,
    onConnectionLost: () => void,
    maxReconnectAttempts = 5,
  ) {
    this.serverUrl = serverUrl;
    this.store = store;
    this.onConnectionLost = onConnectionLost;
    this.maxReconnectAttempts = maxReconnectAttempts;
  }

  /**
   * Opens a WebSocket, sends `session_init`, and resolves once the server
   * replies with a `ready` ack. Rejects after 10 s if no ack is received.
   */
  connect(sessionId: string, activePath: ModalityPath): Promise<void> {
    if (!isValidWsUrl(this.serverUrl)) {
      return Promise.reject(
        new Error(`TransmissionManager: invalid server URL "${this.serverUrl}"`)
      );
    }
    this.sessionId = sessionId;
    this.activePath = activePath;
    this.reconnectAttempts = 0;
    return this._openInitialSocket();
  }

  /**
   * Sends `session_end`, closes the socket, and cancels any pending reconnect.
   * The send buffer is cleared so stale frames are not delivered on the next
   * `connect()` call.
   */
  disconnect(): void {
    const sessionId = this.sessionId;
    this.sessionId = null;
    this.activePath = null;
    this.sendBuffer = [];

    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.connectTimeout !== null) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }

    if (this.readyResolver !== null) {
      this.readyResolver.reject(new Error('TransmissionManager: disconnected before ready'));
      this.readyResolver = null;
    }

    if (this.socket !== null) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onclose = null;
      this.socket.onerror = null;

      if (this.socket.readyState === WS_OPEN && sessionId !== null) {
        this.socket.send(this.serializer.sessionEnd(sessionId));
      }

      this.socket.close();
      this.socket = null;
    }
  }

  /** Serialize and send a feature frame; buffers if the socket is not open. */
  sendFeatures(features: LandmarkFrame | AudioFeatureChunk): void {
    this._sendRaw(this.serializer.serialize(features));
  }

  /** Serialize and send a pipeline health report; buffers if not open. */
  sendHealth(health: PipelineHealth): void {
    this._sendRaw(this.serializer.serialize(health));
  }

  // ---------------------------------------------------------------------------
  // Private — socket setup
  // ---------------------------------------------------------------------------

  private _openInitialSocket(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.readyResolver = { resolve, reject };

      this.connectTimeout = setTimeout(() => {
        this.readyResolver = null;
        reject(new Error('TransmissionManager: connect timed out after 10 s'));
      }, CONNECT_TIMEOUT_MS);

      try {
        this.socket = openSocket(this.serverUrl);
      } catch (err) {
        clearTimeout(this.connectTimeout!);
        this.connectTimeout = null;
        this.readyResolver = null;
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }

      this.socket.onopen = () => {
        this._sendRaw(this.serializer.sessionInit(this.sessionId!, this.activePath!));
        // Buffer is flushed once the server sends "ready" (see _handleMessage).
      };

      this.socket.onmessage = (event) => {
        this._handleMessage(event.data);
      };

      this.socket.onclose = () => {
        this._handleClose();
      };

      this.socket.onerror = () => {
        // onclose follows onerror; handle reconnect there.
      };
    });
  }

  private _reconnect(): void {
    let socket: WebSocketInstance;
    try {
      socket = openSocket(this.serverUrl);
    } catch {
      this.onConnectionLost();
      return;
    }

    this.socket = socket;

    this.socket.onopen = () => {
      // Re-establish session context, then flush any queued frames.
      this._sendRaw(this.serializer.sessionInit(this.sessionId!, this.activePath!));
      this._flushBuffer();
    };

    this.socket.onmessage = (event) => {
      this._handleMessage(event.data);
    };

    this.socket.onclose = () => {
      this._handleClose();
    };

    this.socket.onerror = () => {};
  }

  // ---------------------------------------------------------------------------
  // Private — messaging
  // ---------------------------------------------------------------------------

  private _sendRaw(data: string): void {
    if (this.socket !== null && this.socket.readyState === WS_OPEN) {
      this.socket.send(data);
    } else {
      this._buffer(data);
    }
  }

  private _buffer(data: string): void {
    if (this.sendBuffer.length >= MAX_BUFFER_SIZE) {
      this.sendBuffer.shift(); // drop oldest to stay within cap
    }
    this.sendBuffer.push(data);
  }

  private _flushBuffer(): void {
    const queued = this.sendBuffer.splice(0);
    for (const msg of queued) {
      this._sendRaw(msg);
    }
  }

  private _handleMessage(data: string): void {
    const segment = this.receiver.deserialize(data);
    if (segment !== null) {
      this.store.receiveSegment(segment);
      return;
    }

    try {
      const parsed = JSON.parse(data) as unknown;
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        (parsed as Record<string, unknown>)['type'] === 'ready'
      ) {
        // Reset on every ready ack, including reconnects.
        this.reconnectAttempts = 0;

        if (this.readyResolver !== null) {
          clearTimeout(this.connectTimeout!);
          this.connectTimeout = null;

          const { resolve } = this.readyResolver;
          this.readyResolver = null;

          this._flushBuffer();
          resolve();
        }
      }
    } catch {
      // Malformed JSON — ignore.
    }
  }

  // ---------------------------------------------------------------------------
  // Private — reconnection
  // ---------------------------------------------------------------------------

  private _handleClose(): void {
    if (this.sessionId === null) return; // intentional disconnect — do not reconnect

    this.reconnectAttempts += 1;

    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      this.onConnectionLost();
      return;
    }

    const delayMs = 1_000 * Math.pow(2, this.reconnectAttempts - 1);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._reconnect();
    }, delayMs);
  }
}
