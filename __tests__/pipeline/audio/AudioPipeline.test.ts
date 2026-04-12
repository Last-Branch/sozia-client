/**
 * @jest-environment node
 */
/**
 * Unit tests — sozia.client.pipeline.audio
 *
 * Scope: IAudioPipeline contract and MFCCFrame structure.
 * These tests use a MockAudioPipeline to verify the interface contract is
 * correct and complete. They serve as the acceptance baseline for any
 * concrete implementation (e.g. ExpoAudioPipeline) that ships later.
 *
 * Test plan reference: TP-CLIENT-AUDIO-001 through TP-CLIENT-AUDIO-008
 */

import type { IAudioPipeline, MFCCFrame, RawAudioHandle, SensitivityLevel } from '../../../src/pipeline/audio';
import type { AudioFeatureChunk, PipelineHealth } from '../../../src/common/models';
import type { TransmissionManager } from '../../../src/transmission/TransmissionManager';

// ---------------------------------------------------------------------------
// MockAudioPipeline — a minimal, synchronous stand-in used only in tests.
// ---------------------------------------------------------------------------

class MockAudioPipeline implements IAudioPipeline {
  private sessionId = '';
  private available = false;
  private lastUpdatedMs = 0;
  private listeners: Set<(frame: MFCCFrame) => void> = new Set();
  lastStartArgs: { sessionId: string; micHandle: RawAudioHandle; tx: TransmissionManager | undefined } | null = null;
  lastVadSensitivity: SensitivityLevel | null = null;

  async start(
    sessionId: string,
    micHandle: RawAudioHandle = {},
    tx?: TransmissionManager,
  ): Promise<void> {
    this.sessionId = sessionId;
    this.available = true;
    this.lastUpdatedMs = Date.now();
    this.lastStartArgs = { sessionId, micHandle, tx };
  }

  pause(): void {
    this.available = false;
  }

  resume(): void {
    this.available = true;
  }

  stop(): void {
    this.sessionId = '';
    this.available = false;
    this.listeners.clear();
  }

  getHealth(): PipelineHealth {
    return {
      sessionId: this.sessionId,
      pipeline: 'audio',
      available: this.available,
      fps: null,
      snr: null,
      faceDetected: null,
      lastUpdatedMs: this.lastUpdatedMs,
    };
  }

  onFrame(callback: (frame: MFCCFrame) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  setVadSensitivity(level: SensitivityLevel): void {
    this.lastVadSensitivity = level;
  }

  /** Test helper: emit a frame to all registered listeners. */
  _emit(frame: MFCCFrame): void {
    this.listeners.forEach((cb) => cb(frame));
  }
}

function makeFakeTx(): TransmissionManager & { sent: AudioFeatureChunk[] } {
  const sent: AudioFeatureChunk[] = [];
  return {
    sent,
    sendFeatures: (features: unknown) => {
      sent.push(features as AudioFeatureChunk);
    },
  } as unknown as TransmissionManager & { sent: AudioFeatureChunk[] };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockFrame(overrides: Partial<MFCCFrame> = {}): MFCCFrame {
  return {
    timestampMs: 1000,
    coefficients: Array.from({ length: 13 }, (_, i) => i * 0.1),
    energy: -12.5,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// TP-CLIENT-AUDIO-001: MFCCFrame structure
// ---------------------------------------------------------------------------

describe('MFCCFrame', () => {
  it('TP-CLIENT-AUDIO-001a: contains timestampMs as a non-negative number', () => {
    const frame = makeMockFrame({ timestampMs: 0 });
    expect(typeof frame.timestampMs).toBe('number');
    expect(frame.timestampMs).toBeGreaterThanOrEqual(0);
  });

  it('TP-CLIENT-AUDIO-001b: contains 13 MFCC coefficients', () => {
    const frame = makeMockFrame();
    expect(Array.isArray(frame.coefficients)).toBe(true);
    expect(frame.coefficients).toHaveLength(13);
    frame.coefficients.forEach((c) => expect(typeof c).toBe('number'));
  });

  it('TP-CLIENT-AUDIO-001c: contains energy as a finite number', () => {
    const frame = makeMockFrame({ energy: -12.5 });
    expect(typeof frame.energy).toBe('number');
    expect(isFinite(frame.energy)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TP-CLIENT-AUDIO-002: PipelineHealth — audio-specific field constraints
// ---------------------------------------------------------------------------

describe('IAudioPipeline.getHealth()', () => {
  let pipeline: MockAudioPipeline;

  beforeEach(() => {
    pipeline = new MockAudioPipeline();
  });

  it('TP-CLIENT-AUDIO-002a: reports pipeline as "audio"', async () => {
    await pipeline.start('session-001');
    expect(pipeline.getHealth().pipeline).toBe('audio');
  });

  it('TP-CLIENT-AUDIO-002b: fps is null (audio has no frame rate)', async () => {
    await pipeline.start('session-001');
    expect(pipeline.getHealth().fps).toBeNull();
  });

  it('TP-CLIENT-AUDIO-002c: faceDetected is null (audio does not detect faces)', async () => {
    await pipeline.start('session-001');
    expect(pipeline.getHealth().faceDetected).toBeNull();
  });

  it('TP-CLIENT-AUDIO-002d: sessionId in health matches the id passed to start()', async () => {
    await pipeline.start('abc-123');
    expect(pipeline.getHealth().sessionId).toBe('abc-123');
  });

  it('TP-CLIENT-AUDIO-002e: available is false before start() is called', () => {
    expect(pipeline.getHealth().available).toBe(false);
  });

  it('TP-CLIENT-AUDIO-002f: available is true after start()', async () => {
    await pipeline.start('session-001');
    expect(pipeline.getHealth().available).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TP-CLIENT-AUDIO-003: Lifecycle state transitions
// ---------------------------------------------------------------------------

describe('IAudioPipeline lifecycle', () => {
  let pipeline: MockAudioPipeline;

  beforeEach(() => {
    pipeline = new MockAudioPipeline();
  });

  it('TP-CLIENT-AUDIO-003a: start() returns a Promise', () => {
    const result = pipeline.start('session-001');
    expect(result).toBeInstanceOf(Promise);
    return result;
  });

  it('TP-CLIENT-AUDIO-003b: pause() marks pipeline as unavailable', async () => {
    await pipeline.start('session-001');
    pipeline.pause();
    expect(pipeline.getHealth().available).toBe(false);
  });

  it('TP-CLIENT-AUDIO-003c: resume() after pause() marks pipeline as available', async () => {
    await pipeline.start('session-001');
    pipeline.pause();
    pipeline.resume();
    expect(pipeline.getHealth().available).toBe(true);
  });

  it('TP-CLIENT-AUDIO-003d: stop() marks pipeline as unavailable and clears sessionId', async () => {
    await pipeline.start('session-001');
    pipeline.stop();
    const health = pipeline.getHealth();
    expect(health.available).toBe(false);
    expect(health.sessionId).toBe('');
  });
});

// ---------------------------------------------------------------------------
// TP-CLIENT-AUDIO-004: Frame subscription
// ---------------------------------------------------------------------------

describe('IAudioPipeline.onFrame()', () => {
  let pipeline: MockAudioPipeline;

  beforeEach(() => {
    pipeline = new MockAudioPipeline();
  });

  it('TP-CLIENT-AUDIO-004a: onFrame() returns an unsubscribe function', async () => {
    await pipeline.start('session-001');
    const unsub = pipeline.onFrame(() => {});
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('TP-CLIENT-AUDIO-004b: registered callback receives emitted frames', async () => {
    await pipeline.start('session-001');
    const received: MFCCFrame[] = [];
    pipeline.onFrame((f) => received.push(f));

    const frame = makeMockFrame({ timestampMs: 500 });
    pipeline._emit(frame);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(frame);
  });

  it('TP-CLIENT-AUDIO-004c: unsubscribe stops frame delivery', async () => {
    await pipeline.start('session-001');
    const received: MFCCFrame[] = [];
    const unsub = pipeline.onFrame((f) => received.push(f));

    pipeline._emit(makeMockFrame({ timestampMs: 100 }));
    unsub();
    pipeline._emit(makeMockFrame({ timestampMs: 200 }));

    expect(received).toHaveLength(1);
  });

  it('TP-CLIENT-AUDIO-004d: multiple listeners can be registered simultaneously', async () => {
    await pipeline.start('session-001');
    const countA = { n: 0 };
    const countB = { n: 0 };
    pipeline.onFrame(() => countA.n++);
    pipeline.onFrame(() => countB.n++);

    pipeline._emit(makeMockFrame());

    expect(countA.n).toBe(1);
    expect(countB.n).toBe(1);
  });

  it('TP-CLIENT-AUDIO-004e: stop() removes all listeners', async () => {
    await pipeline.start('session-001');
    const received: MFCCFrame[] = [];
    pipeline.onFrame((f) => received.push(f));

    pipeline.stop();
    pipeline._emit(makeMockFrame());

    expect(received).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TP-CLIENT-AUDIO-005: start() accepts micHandle and TransmissionManager
// ---------------------------------------------------------------------------

describe('IAudioPipeline.start() signature', () => {
  it('TP-CLIENT-AUDIO-005a: accepts sessionId, micHandle, and tx', async () => {
    const pipeline = new MockAudioPipeline();
    const tx = makeFakeTx();

    await pipeline.start('session-xyz', {}, tx);

    expect(pipeline.lastStartArgs?.sessionId).toBe('session-xyz');
    expect(pipeline.lastStartArgs?.tx).toBe(tx);
  });

  it('TP-CLIENT-AUDIO-005b: tx is optional (undefined when omitted)', async () => {
    const pipeline = new MockAudioPipeline();

    await pipeline.start('session-xyz', {});

    expect(pipeline.lastStartArgs?.tx).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// TP-CLIENT-AUDIO-006: setVadSensitivity()
// ---------------------------------------------------------------------------

describe('IAudioPipeline.setVadSensitivity()', () => {
  it('TP-CLIENT-AUDIO-006a: stores the requested sensitivity level', () => {
    const pipeline = new MockAudioPipeline();

    pipeline.setVadSensitivity('high');

    expect(pipeline.lastVadSensitivity).toBe('high');
  });
});
