/**
 * @jest-environment node
 */
/**
 * Unit tests — ExpoAudioPipeline
 *
 * Verifies the concrete audio pipeline behaviour:
 * - platform-specific module resolution (_resolveRecorder)
 * - correct delegation to startRecording / stopRecording / pauseRecording / resumeRecording
 * - no synchronous throw when recording methods are absent (web factory path)
 * - frame processing and chunk forwarding
 *
 * Test plan reference: TP-CLIENT-EXPOPIPELINE-001 through TP-CLIENT-EXPOPIPELINE-005
 */

import { ExpoAudioPipeline } from '@/pipeline/audio/ExpoAudioPipeline';
import { AudioChunker } from '@/pipeline/audio/AudioChunker';

// ---------------------------------------------------------------------------
// Mock @siteed/audio-studio — shape varies by test case (native vs web)
// ---------------------------------------------------------------------------

const mockStartRecording = jest.fn().mockResolvedValue(undefined);
const mockStopRecording = jest.fn().mockResolvedValue(undefined);
const mockPauseRecording = jest.fn().mockResolvedValue(undefined);
const mockResumeRecording = jest.fn().mockResolvedValue(undefined);

// Default mock: native-like object with all recording methods.
jest.mock('@siteed/audio-studio', () => ({
  AudioStudioModule: {
    startRecording: (...args: unknown[]) => mockStartRecording(...args),
    stopRecording: () => mockStopRecording(),
    pauseRecording: () => mockPauseRecording(),
    resumeRecording: () => mockResumeRecording(),
  },
}));

// ---------------------------------------------------------------------------
// Mock expo-modules-core LegacyEventEmitter — used for native audio events
// ---------------------------------------------------------------------------

type NativeListener = (event: { pcmFloat32?: Float32Array | number[]; buffer?: Float32Array }) => void;
let capturedNativeListener: NativeListener | null = null;
const mockNativeRemove = jest.fn();
const mockNativeAddListener = jest.fn().mockImplementation(
  (_event: string, cb: NativeListener) => {
    capturedNativeListener = cb;
    return { remove: mockNativeRemove };
  },
);

jest.mock('expo-modules-core', () => ({
  LegacyEventEmitter: jest.fn().mockImplementation(() => ({
    addListener: mockNativeAddListener,
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChunker(): AudioChunker {
  return new AudioChunker();
}

function makeTx() {
  return { sendFeatures: jest.fn() };
}

beforeEach(() => {
  jest.clearAllMocks();
  capturedNativeListener = null;
});

// ---------------------------------------------------------------------------
// TP-CLIENT-EXPOPIPELINE-001: start() delegates to startRecording
// ---------------------------------------------------------------------------

describe('ExpoAudioPipeline.start()', () => {
  it('TP-CLIENT-EXPOPIPELINE-001a: calls startRecording with the correct config shape', async () => {
    const pipeline = new ExpoAudioPipeline(makeChunker());
    await pipeline.start('session-001');

    expect(mockStartRecording).toHaveBeenCalledTimes(1);
    const config = mockStartRecording.mock.calls[0][0] as Record<string, unknown>;
    expect(config.sampleRate).toBe(16_000);
    expect(config.channels).toBe(1);
    expect(config.encoding).toBe('pcm_16bit');
    expect(config.streamFormat).toBe('float32');
    // onAudioStream is NOT passed in config — native delivers PCM via LegacyEventEmitter 'AudioData' events
    expect(config.onAudioStream).toBeUndefined();

    pipeline.stop();
  });

  it('TP-CLIENT-EXPOPIPELINE-001b: calling start() twice is a no-op for the second call', async () => {
    const pipeline = new ExpoAudioPipeline(makeChunker());
    await pipeline.start('session-001');
    await pipeline.start('session-002'); // should be ignored

    expect(mockStartRecording).toHaveBeenCalledTimes(1);

    pipeline.stop();
  });

  it('TP-CLIENT-EXPOPIPELINE-001c: getHealth() returns available=true after start()', async () => {
    const pipeline = new ExpoAudioPipeline(makeChunker());
    await pipeline.start('session-001');

    expect(pipeline.getHealth().available).toBe(true);
    expect(pipeline.getHealth().sessionId).toBe('session-001');

    pipeline.stop();
  });
});

// ---------------------------------------------------------------------------
// TP-CLIENT-EXPOPIPELINE-002: stop() lifecycle
// ---------------------------------------------------------------------------

describe('ExpoAudioPipeline.stop()', () => {
  it('TP-CLIENT-EXPOPIPELINE-002a: calls stopRecording after a started session', async () => {
    const pipeline = new ExpoAudioPipeline(makeChunker());
    await pipeline.start('session-001');
    pipeline.stop();

    expect(mockStopRecording).toHaveBeenCalledTimes(1);
  });

  it('TP-CLIENT-EXPOPIPELINE-002a-native-sub: stop() removes the native AudioData subscription', async () => {
    const pipeline = new ExpoAudioPipeline(makeChunker());
    await pipeline.start('session-001');
    pipeline.stop();

    expect(mockNativeRemove).toHaveBeenCalledTimes(1);
  });

  it('TP-CLIENT-EXPOPIPELINE-002b: does NOT call stopRecording when recording was never started', () => {
    const pipeline = new ExpoAudioPipeline(makeChunker());
    pipeline.stop(); // never called start()

    expect(mockStopRecording).not.toHaveBeenCalled();
  });

  it('TP-CLIENT-EXPOPIPELINE-002c: getHealth() returns available=false after stop()', async () => {
    const pipeline = new ExpoAudioPipeline(makeChunker());
    await pipeline.start('session-001');
    pipeline.stop();

    const health = pipeline.getHealth();
    expect(health.available).toBe(false);
    expect(health.sessionId).toBe('');
  });

  it('TP-CLIENT-EXPOPIPELINE-002d: stop() does not throw even if stopRecording rejects', async () => {
    mockStopRecording.mockRejectedValueOnce(new Error('native error'));

    const pipeline = new ExpoAudioPipeline(makeChunker());
    await pipeline.start('session-001');

    expect(() => pipeline.stop()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// TP-CLIENT-EXPOPIPELINE-003: pause() / resume()
// ---------------------------------------------------------------------------

describe('ExpoAudioPipeline.pause() / resume()', () => {
  it('TP-CLIENT-EXPOPIPELINE-003a: pause() calls pauseRecording when recording is active', async () => {
    const pipeline = new ExpoAudioPipeline(makeChunker());
    await pipeline.start('session-001');
    pipeline.pause();

    expect(mockPauseRecording).toHaveBeenCalledTimes(1);

    pipeline.stop();
  });

  it('TP-CLIENT-EXPOPIPELINE-003b: resume() calls resumeRecording after pause', async () => {
    const pipeline = new ExpoAudioPipeline(makeChunker());
    await pipeline.start('session-001');
    pipeline.pause();
    pipeline.resume();

    expect(mockResumeRecording).toHaveBeenCalledTimes(1);

    pipeline.stop();
  });

  it('TP-CLIENT-EXPOPIPELINE-003c: pause() is a no-op when not running', () => {
    const pipeline = new ExpoAudioPipeline(makeChunker());
    pipeline.pause(); // never started

    expect(mockPauseRecording).not.toHaveBeenCalled();
  });

  it('TP-CLIENT-EXPOPIPELINE-003d: resume() is a no-op when not paused', async () => {
    const pipeline = new ExpoAudioPipeline(makeChunker());
    await pipeline.start('session-001');
    pipeline.resume(); // not paused

    expect(mockResumeRecording).not.toHaveBeenCalled();

    pipeline.stop();
  });
});

// ---------------------------------------------------------------------------
// TP-CLIENT-EXPOPIPELINE-004: web factory path — no synchronous throws
// ---------------------------------------------------------------------------

describe('ExpoAudioPipeline web factory path', () => {
  // Re-mock AudioStudioModule as a web factory function (no recording methods
  // on the function itself — they live on the returned AudioStudioWeb instance).
  const webStartRecording = jest.fn().mockResolvedValue(undefined);
  const webStopRecording = jest.fn().mockResolvedValue(undefined);
  const webPauseRecording = jest.fn().mockResolvedValue(undefined);
  const webResumeRecording = jest.fn().mockResolvedValue(undefined);

  // Captured AudioData listener so tests can fire fake audio events
  let capturedAudioDataListener: ((e: { buffer: Float32Array }) => void) | null = null;
  const webAddListener = jest.fn().mockImplementation(
    (_event: string, cb: (e: { buffer: Float32Array }) => void) => {
      capturedAudioDataListener = cb;
      return { remove: jest.fn() };
    },
  );

  let webInstance: {
    startRecording: jest.Mock;
    stopRecording: jest.Mock;
    pauseRecording: jest.Mock;
    resumeRecording: jest.Mock;
    addListener: jest.Mock;
  };

  let originalModule: unknown;

  beforeEach(() => {
    capturedAudioDataListener = null;
    webInstance = {
      startRecording: webStartRecording,
      stopRecording: webStopRecording,
      pauseRecording: webPauseRecording,
      resumeRecording: webResumeRecording,
      addListener: webAddListener,
    };

    // Patch the module's AudioStudioModule export to the web factory shape
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@siteed/audio-studio') as { AudioStudioModule: unknown };
    originalModule = mod.AudioStudioModule;

    const factory = () => webInstance;
    // Factory has NO startRecording — matches the real web behaviour
    mod.AudioStudioModule = factory;

    jest.clearAllMocks();
    capturedAudioDataListener = null;
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@siteed/audio-studio') as { AudioStudioModule: unknown };
    mod.AudioStudioModule = originalModule;
  });

  it('TP-CLIENT-EXPOPIPELINE-004a: start() delegates to the web instance, not the factory itself', async () => {
    const pipeline = new ExpoAudioPipeline(makeChunker());
    await pipeline.start('session-web');

    expect(webStartRecording).toHaveBeenCalledTimes(1);

    pipeline.stop();
  });

  it('TP-CLIENT-EXPOPIPELINE-004b: start() subscribes to AudioData events on the web instance', async () => {
    const pipeline = new ExpoAudioPipeline(makeChunker());
    await pipeline.start('session-web');

    expect(webAddListener).toHaveBeenCalledWith('AudioData', expect.any(Function));

    pipeline.stop();
  });

  it('TP-CLIENT-EXPOPIPELINE-004c: AudioData events drive frame listeners on web', async () => {
    const pipeline = new ExpoAudioPipeline(makeChunker());
    const frames: unknown[] = [];
    pipeline.onFrame((f) => frames.push(f));

    await pipeline.start('session-web');

    // Fire the AudioData event directly — simulates what AudioStudioWeb emits
    capturedAudioDataListener?.({ buffer: new Float32Array(400).fill(0.1) });

    expect(frames).toHaveLength(1);
    const frame = frames[0] as { coefficients: number[]; energy: number };
    expect(frame.coefficients).toHaveLength(80);
    expect(typeof frame.energy).toBe('number');

    pipeline.stop();
  });

  it('TP-CLIENT-EXPOPIPELINE-004d: stop() removes the AudioData subscription', async () => {
    const removeMock = jest.fn();
    webAddListener.mockReturnValueOnce({ remove: removeMock });

    const pipeline = new ExpoAudioPipeline(makeChunker());
    await pipeline.start('session-web');
    pipeline.stop();

    expect(removeMock).toHaveBeenCalledTimes(1);
  });

  it('TP-CLIENT-EXPOPIPELINE-004e: stop() does not throw on the web factory path', async () => {
    const pipeline = new ExpoAudioPipeline(makeChunker());
    await pipeline.start('session-web');

    expect(() => pipeline.stop()).not.toThrow();
    expect(webStopRecording).toHaveBeenCalledTimes(1);
  });

  it('TP-CLIENT-EXPOPIPELINE-004f: stop() does not throw even when stopRecording is absent on the instance', async () => {
    // Edge case: instance exists but has no stopRecording (should never happen
    // in practice, but guards against partial implementations).
    webInstance = {
      startRecording: webStartRecording,
      stopRecording: undefined as unknown as jest.Mock,
      pauseRecording: undefined as unknown as jest.Mock,
      resumeRecording: undefined as unknown as jest.Mock,
      addListener: webAddListener,
    };

    const pipeline = new ExpoAudioPipeline(makeChunker());
    await pipeline.start('session-web');

    expect(() => pipeline.stop()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// TP-CLIENT-EXPOPIPELINE-005: onFrame() and chunk forwarding
// ---------------------------------------------------------------------------

describe('ExpoAudioPipeline.onFrame() and chunk forwarding', () => {
  it('TP-CLIENT-EXPOPIPELINE-005a: native AudioData event drives frame listeners via real MFCC', async () => {
    const pipeline = new ExpoAudioPipeline(makeChunker());
    const frames: unknown[] = [];
    pipeline.onFrame((f) => frames.push(f));

    await pipeline.start('session-001');

    // Native PCM is delivered via the LegacyEventEmitter 'AudioData' event,
    // not via onAudioStream in the config.
    expect(capturedNativeListener).not.toBeNull();

    // Feed exactly 400 samples (one full frame at 16 kHz / 25 ms)
    capturedNativeListener!({ pcmFloat32: new Float32Array(400).fill(0.1) });

    expect(frames).toHaveLength(1);
    const frame = frames[0] as { coefficients: number[]; energy: number; timestampMs: number };
    expect(frame.coefficients).toHaveLength(80);
    expect(typeof frame.energy).toBe('number');
    expect(isFinite(frame.energy)).toBe(true);

    pipeline.stop();
  });

  it('TP-CLIENT-EXPOPIPELINE-005a-ios: iOS number[] pcmFloat32 is accepted', async () => {
    const pipeline = new ExpoAudioPipeline(makeChunker());
    const frames: unknown[] = [];
    pipeline.onFrame((f) => frames.push(f));

    await pipeline.start('session-001');

    expect(capturedNativeListener).not.toBeNull();
    // iOS delivers pcmFloat32 as a plain number[] — must be converted to Float32Array
    capturedNativeListener!({ pcmFloat32: Array.from({ length: 400 }, () => 0.1) });

    expect(frames).toHaveLength(1);

    pipeline.stop();
  });

  it('TP-CLIENT-EXPOPIPELINE-005b: onFrame unsubscribe stops delivery', async () => {
    const pipeline = new ExpoAudioPipeline(makeChunker());
    const frames: unknown[] = [];
    const unsub = pipeline.onFrame((f) => frames.push(f));

    await pipeline.start('session-001');

    unsub();
    capturedNativeListener!({ pcmFloat32: new Float32Array(400).fill(0.05) });

    expect(frames).toHaveLength(0);

    pipeline.stop();
  });

  it('TP-CLIENT-EXPOPIPELINE-005c: chunks are forwarded to tx.sendFeatures when tx is provided', async () => {
    // Use a chunker configured for a very small window (1 frame) so we get a
    // chunk immediately on the first push without waiting for 20 frames.
    const chunker = new AudioChunker(25 /* chunkDurationMs = 1 frame */);
    const tx = makeTx();
    const pipeline = new ExpoAudioPipeline(chunker);

    await pipeline.start('session-001', {}, tx as never);

    expect(capturedNativeListener).not.toBeNull();

    // Feed a loud signal so VAD passes (energy > -40 dBFS)
    capturedNativeListener!({ pcmFloat32: new Float32Array(400).fill(0.9) });

    expect(tx.sendFeatures).toHaveBeenCalledTimes(1);

    pipeline.stop();
  });
});
