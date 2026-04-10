/**
 * @jest-environment node
 */
/**
 * Unit tests — TransmissionManager
 *
 * Verifies WebSocket lifecycle (connect/disconnect), outbound buffering,
 * exponential-backoff reconnection, and inbound message routing.
 *
 * FakeWebSocket provides a synchronous stand-in for the browser/RN WebSocket
 * global. All timers are fake to keep tests deterministic.
 *
 * Test plan reference: TP-CLIENT-TX-003
 */

import { TransmissionManager } from '../../src/transmission/TransmissionManager';
import { TranscriptStore } from '../../src/store/TranscriptStore';
import { ModalityPath, SegmentStatus, ModalityType } from '../../src/common/models';
import type { AudioFeatureChunk, LandmarkFrame, PipelineHealth } from '../../src/common/models';

// ---------------------------------------------------------------------------
// FakeWebSocket
// ---------------------------------------------------------------------------

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  static lastInstance: FakeWebSocket | null = null;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  readonly sentMessages: string[] = [];

  onopen: ((event: unknown) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  constructor(public readonly url: string) {
    FakeWebSocket.lastInstance = this;
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
  }

  // -- Helpers for tests -----------------------------------------------------

  simulateOpen(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.({});
  }

  simulateReady(): void {
    this.onmessage?.({ data: JSON.stringify({ type: 'ready' }) });
  }

  simulateClose(code = 1006): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code, reason: '' });
  }

  simulateSegment(fields: Record<string, unknown>): void {
    this.onmessage?.({ data: JSON.stringify({ type: 'transcript_segment', ...fields }) });
  }
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.useFakeTimers();
  FakeWebSocket.lastInstance = null;
  FakeWebSocket.instances = [];
  (globalThis as Record<string, unknown>).WebSocket = FakeWebSocket;
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  delete (globalThis as Record<string, unknown>).WebSocket;
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeManager(opts: { maxAttempts?: number } = {}): {
  manager: TransmissionManager;
  store: TranscriptStore;
  onLost: jest.Mock;
} {
  const store = new TranscriptStore();
  const onLost = jest.fn();
  const manager = new TransmissionManager('wss://test.sozia', store, onLost, opts.maxAttempts ?? 5);
  return { manager, store, onLost };
}

/** Connect and await the ready ack — leaves manager in RUNNING state. */
async function connectManager(manager: TransmissionManager): Promise<FakeWebSocket> {
  const promise = manager.connect('session-1', ModalityPath.SPEECH);
  const ws = FakeWebSocket.lastInstance!;
  ws.simulateOpen();
  ws.simulateReady();
  await promise;
  return ws;
}

function makeChunk(timestampMs: number): AudioFeatureChunk {
  return {
    sessionId: 'session-1',
    timestampMs,
    features: [[timestampMs]],
    featureType: 'mfcc',
    sampleRateHz: 16000,
    chunkDurationMs: 500,
  };
}

function makeLandmark(timestampMs: number): LandmarkFrame {
  return {
    sessionId: 'session-1',
    timestampMs,
    faceLandmarks: [[0.1, 0.2, 0.3]],
    leftHandLandmarks: null,
    rightHandLandmarks: null,
    poseLandmarks: null,
  };
}

function makeHealth(): PipelineHealth {
  return {
    sessionId: 'session-1',
    pipeline: 'audio',
    available: true,
    fps: null,
    snr: 30,
    faceDetected: null,
    lastUpdatedMs: 100,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TransmissionManager', () => {
  // -- connect() -------------------------------------------------------------

  describe('connect()', () => {
    it('resolves when server sends ready ack', async () => {
      const { manager } = makeManager();
      const promise = manager.connect('session-1', ModalityPath.SPEECH);
      const ws = FakeWebSocket.lastInstance!;
      ws.simulateOpen();
      ws.simulateReady();
      await expect(promise).resolves.toBeUndefined();
    });

    it('sends session_init with sessionId and activePath on open', async () => {
      const { manager } = makeManager();
      const promise = manager.connect('session-1', ModalityPath.SIGN);
      const ws = FakeWebSocket.lastInstance!;
      ws.simulateOpen();

      const msg = JSON.parse(ws.sentMessages[0]);
      expect(msg.type).toBe('session_init');
      expect(msg.sessionId).toBe('session-1');
      expect(msg.activePath).toBe(ModalityPath.SIGN);

      ws.simulateReady();
      await promise;
    });

    it('rejects after 10 s if server never sends ready', async () => {
      const { manager } = makeManager();
      const promise = manager.connect('session-1', ModalityPath.SPEECH);
      const ws = FakeWebSocket.lastInstance!;
      ws.simulateOpen();
      // No ready ack
      jest.advanceTimersByTime(10_001);
      await expect(promise).rejects.toThrow();
    });

    it('connects to the provided serverUrl', () => {
      const store = new TranscriptStore();
      const manager = new TransmissionManager('wss://custom.host/ws', store, jest.fn());
      manager.connect('session-1', ModalityPath.SPEECH);
      expect(FakeWebSocket.lastInstance!.url).toBe('wss://custom.host/ws');
    });

    it('rejects immediately when serverUrl is a placeholder like "wss://..."', async () => {
      const store = new TranscriptStore();
      const manager = new TransmissionManager('wss://...', store, jest.fn());
      await expect(manager.connect('session-1', ModalityPath.SPEECH)).rejects.toThrow('invalid server URL');
      expect(FakeWebSocket.lastInstance).toBeNull(); // no WebSocket created
    });

    it('rejects immediately when serverUrl has no ws:// or wss:// scheme', async () => {
      const store = new TranscriptStore();
      const manager = new TransmissionManager('https://example.com', store, jest.fn());
      await expect(manager.connect('session-1', ModalityPath.SPEECH)).rejects.toThrow('invalid server URL');
    });
  });

  // -- sendFeatures() --------------------------------------------------------

  describe('sendFeatures()', () => {
    it('sends audio_feature_chunk immediately when connected', async () => {
      const { manager } = makeManager();
      const ws = await connectManager(manager);

      manager.sendFeatures(makeChunk(100));

      const msg = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
      expect(msg.type).toBe('audio_feature_chunk');
      expect(msg.timestampMs).toBe(100);
    });

    it('sends landmark_frame immediately when connected', async () => {
      const { manager } = makeManager();
      const ws = await connectManager(manager);

      manager.sendFeatures(makeLandmark(200));

      const msg = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
      expect(msg.type).toBe('landmark_frame');
      expect(msg.timestampMs).toBe(200);
    });

    it('buffers features when not yet connected (socket CONNECTING)', () => {
      const { manager } = makeManager();
      manager.connect('session-1', ModalityPath.SPEECH);
      // Socket created but not opened yet
      const ws = FakeWebSocket.lastInstance!;
      expect(ws.readyState).toBe(FakeWebSocket.CONNECTING);

      manager.sendFeatures(makeChunk(1));

      expect(ws.sentMessages).toHaveLength(0);
    });

    it('flushes buffered features when ready ack arrives', async () => {
      const { manager } = makeManager();
      const promise = manager.connect('session-1', ModalityPath.SPEECH);
      const ws = FakeWebSocket.lastInstance!;

      // Buffer a chunk before the socket is ready
      manager.sendFeatures(makeChunk(42));
      ws.simulateOpen();
      // Still not flushed (waiting for ready)
      expect(ws.sentMessages).toHaveLength(1); // only session_init

      ws.simulateReady();
      await promise;

      // session_init + buffered chunk
      expect(ws.sentMessages).toHaveLength(2);
      const flushed = JSON.parse(ws.sentMessages[1]);
      expect(flushed.type).toBe('audio_feature_chunk');
      expect(flushed.timestampMs).toBe(42);
    });

    it('drops the oldest entry when buffer exceeds 50 items', async () => {
      const { manager } = makeManager();
      const promise = manager.connect('session-1', ModalityPath.SPEECH);
      const ws = FakeWebSocket.lastInstance!;

      // Push 51 chunks — chunk #0 should be dropped
      for (let i = 0; i < 51; i++) {
        manager.sendFeatures(makeChunk(i));
      }

      ws.simulateOpen();
      ws.simulateReady();
      await promise;

      // session_init (1) + 50 buffered chunks (chunk 0 dropped)
      const buffered = ws.sentMessages.slice(1);
      expect(buffered).toHaveLength(50);
      expect(JSON.parse(buffered[0]).timestampMs).toBe(1); // chunk 0 dropped
      expect(JSON.parse(buffered[49]).timestampMs).toBe(50);
    });
  });

  // -- sendHealth() ----------------------------------------------------------

  describe('sendHealth()', () => {
    it('sends pipeline_health when connected', async () => {
      const { manager } = makeManager();
      const ws = await connectManager(manager);

      manager.sendHealth(makeHealth());

      const msg = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
      expect(msg.type).toBe('pipeline_health');
      expect(msg.available).toBe(true);
      expect(msg.pipeline).toBe('audio');
    });

    it('buffers health reports when disconnected', async () => {
      const { manager } = makeManager();
      const ws = await connectManager(manager);

      ws.simulateClose();
      manager.sendHealth(makeHealth());

      // No new WS yet (inside reconnect delay)
      expect(ws.sentMessages.filter((m) => JSON.parse(m).type === 'pipeline_health')).toHaveLength(0);
    });
  });

  // -- disconnect() ----------------------------------------------------------

  describe('disconnect()', () => {
    it('sends session_end before closing', async () => {
      const { manager } = makeManager();
      const ws = await connectManager(manager);

      manager.disconnect();

      const msg = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
      expect(msg.type).toBe('session_end');
      expect(msg.sessionId).toBe('session-1');
    });

    it('stops reconnection attempts after disconnect', async () => {
      const { manager, onLost } = makeManager();
      const ws = await connectManager(manager);

      manager.disconnect();
      ws.simulateClose(); // onclose fires but sessionId is null → no reconnect

      jest.advanceTimersByTime(60_000);
      expect(onLost).not.toHaveBeenCalled();
      expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it('clears buffer so it is not sent on the next connect', async () => {
      const { manager } = makeManager();
      const ws1 = await connectManager(manager);

      ws1.simulateClose(); // enter reconnect window
      manager.sendFeatures(makeChunk(99)); // buffered during disconnection

      manager.disconnect(); // clears buffer + stops reconnect

      // New connect should not flush the old chunk
      const promise2 = manager.connect('session-2', ModalityPath.SPEECH);
      const ws2 = FakeWebSocket.lastInstance!;
      ws2.simulateOpen();
      ws2.simulateReady();
      await promise2;

      const chunkMsgs = ws2.sentMessages
        .map((m) => JSON.parse(m))
        .filter((m) => m.type === 'audio_feature_chunk');
      expect(chunkMsgs).toHaveLength(0);
    });
  });

  // -- reconnection ----------------------------------------------------------

  describe('reconnection', () => {
    it('creates a new WebSocket after 1000 ms on first close', async () => {
      const { manager } = makeManager();
      const ws1 = await connectManager(manager);
      const countBefore = FakeWebSocket.instances.length;

      ws1.simulateClose();
      jest.advanceTimersByTime(999);
      expect(FakeWebSocket.instances.length).toBe(countBefore); // not yet

      jest.advanceTimersByTime(1);
      expect(FakeWebSocket.instances.length).toBe(countBefore + 1);
    });

    it('doubles the delay on each successive close (exponential backoff)', async () => {
      const { manager } = makeManager();
      const ws1 = await connectManager(manager);

      // Attempt 1 — delay 1000 ms
      ws1.simulateClose();
      jest.advanceTimersByTime(1000);
      const ws2 = FakeWebSocket.lastInstance!;
      expect(ws2).not.toBe(ws1);

      // Attempt 2 — delay 2000 ms
      ws2.simulateClose();
      jest.advanceTimersByTime(1999);
      expect(FakeWebSocket.lastInstance).toBe(ws2); // not reconnected yet

      jest.advanceTimersByTime(1);
      const ws3 = FakeWebSocket.lastInstance!;
      expect(ws3).not.toBe(ws2);
    });

    it('calls onConnectionLost after exhausting maxReconnectAttempts', async () => {
      const { manager, onLost } = makeManager({ maxAttempts: 2 });
      const ws1 = await connectManager(manager);

      // Attempt 1 (delay 1000 ms)
      ws1.simulateClose();
      jest.advanceTimersByTime(1000);

      // Attempt 2 (delay 2000 ms)
      FakeWebSocket.lastInstance!.simulateClose();
      jest.advanceTimersByTime(2000);

      // Attempt 3 — exceeds max
      FakeWebSocket.lastInstance!.simulateClose();
      expect(onLost).toHaveBeenCalledTimes(1);
    });

    it('re-sends session_init on reconnect open', async () => {
      const { manager } = makeManager();
      const ws1 = await connectManager(manager);

      ws1.simulateClose();
      jest.advanceTimersByTime(1000);

      const ws2 = FakeWebSocket.lastInstance!;
      ws2.simulateOpen();

      const initMsg = JSON.parse(ws2.sentMessages[0]);
      expect(initMsg.type).toBe('session_init');
      expect(initMsg.sessionId).toBe('session-1');
    });

    it('flushes buffer immediately after session_init on reconnect', async () => {
      const { manager } = makeManager();
      const ws1 = await connectManager(manager);

      ws1.simulateClose();
      manager.sendFeatures(makeChunk(777)); // buffered during outage

      jest.advanceTimersByTime(1000);
      const ws2 = FakeWebSocket.lastInstance!;
      ws2.simulateOpen();

      // session_init + buffered chunk
      expect(ws2.sentMessages).toHaveLength(2);
      const flushed = JSON.parse(ws2.sentMessages[1]);
      expect(flushed.type).toBe('audio_feature_chunk');
      expect(flushed.timestampMs).toBe(777);
    });

    it('resets reconnect counter after a successful reconnect', async () => {
      const { manager, onLost } = makeManager({ maxAttempts: 2 });
      const ws1 = await connectManager(manager);

      // First disconnect + reconnect (attempt 1)
      ws1.simulateClose();
      jest.advanceTimersByTime(1000);
      const ws2 = FakeWebSocket.lastInstance!;
      ws2.simulateOpen();
      ws2.simulateReady(); // successful reconnect — resets counter

      // Now disconnect ws2 — counter should start from 0 again
      ws2.simulateClose(); // attempt 1 of new cycle
      jest.advanceTimersByTime(1000);
      FakeWebSocket.lastInstance!.simulateClose(); // attempt 2 of new cycle
      jest.advanceTimersByTime(2000);
      FakeWebSocket.lastInstance!.simulateClose(); // attempt 3 → exceeds max=2

      expect(onLost).toHaveBeenCalledTimes(1);
    });
  });

  // -- incoming messages -----------------------------------------------------

  describe('incoming messages', () => {
    it('routes transcript_segment to store.receiveSegment()', async () => {
      const { manager, store } = makeManager();
      const ws = await connectManager(manager);

      ws.simulateSegment({
        segmentId: 'seg-1',
        sessionId: 'session-1',
        status: SegmentStatus.FINAL,
        text: 'Merhaba',
        source: ModalityType.ASR,
        confidence: 0.9,
        timestampMs: 1000,
        durationMs: 500,
        createdAtMs: 1_700_000_000_000,
        replacesSegmentId: null,
      });

      expect(store.size).toBe(1);
      expect(store.getSegments()[0].text).toBe('Merhaba');
    });

    it('ignores unknown message types without throwing', async () => {
      const { manager, store } = makeManager();
      const ws = await connectManager(manager);

      expect(() => {
        ws.onmessage?.({ data: JSON.stringify({ type: 'unknown_event', payload: 42 }) });
      }).not.toThrow();

      expect(store.size).toBe(0);
    });

    it('ignores malformed JSON without throwing', async () => {
      const { manager } = makeManager();
      const ws = await connectManager(manager);

      expect(() => {
        ws.onmessage?.({ data: 'not valid json' });
      }).not.toThrow();
    });

    it('ignores a segment with missing required fields', async () => {
      const { manager, store } = makeManager();
      const ws = await connectManager(manager);

      ws.onmessage?.({ data: JSON.stringify({ type: 'transcript_segment', segmentId: 'seg-1' }) });

      expect(store.size).toBe(0);
    });
  });
});
