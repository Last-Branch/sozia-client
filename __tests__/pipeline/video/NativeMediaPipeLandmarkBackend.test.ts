import { NativeLandmarkBridge } from '@/pipeline/video/NativeLandmarkBridge';
import { NativeMediaPipeLandmarkBackend } from '@/pipeline/video/NativeMediaPipeLandmarkBackend';
import type { LandmarkFrame } from '@common/models';
import type { RawVideoFrame } from '@/pipeline/video/LandmarkExtractor';

const makeFrame = (overrides: Partial<LandmarkFrame> = {}): LandmarkFrame => ({
  sessionId: 'test-session',
  timestampMs: Date.now(),
  faceLandmarks: [[0.1, 0.2, 0.3]],
  leftHandLandmarks: null,
  rightHandLandmarks: null,
  poseLandmarks: null,
  ...overrides,
});

const makeRawInput = (overrides: Partial<RawVideoFrame> = {}): RawVideoFrame => ({
  timestampMs: Date.now(),
  width: 640,
  height: 480,
  data: null,
  ...overrides,
});

describe('NativeMediaPipeLandmarkBackend', () => {
  let backend: NativeMediaPipeLandmarkBackend;

  beforeEach(() => {
    NativeLandmarkBridge.setLatestFrame(null, 0);
    NativeLandmarkBridge.setModelLoaded(false);
    backend = new NativeMediaPipeLandmarkBackend();
  });

  describe('isReady()', () => {
    it('always returns true — native models warm up in the background', () => {
      expect(backend.isReady()).toBe(true);
    });
  });

  describe('extract() — deduplication', () => {
    it('returns null when bridge has no frame', () => {
      expect(backend.extract(makeRawInput())).toBeNull();
    });

    it('returns the frame on first extract after a new seq', () => {
      const frame = makeFrame();
      NativeLandmarkBridge.setLatestFrame(frame, 1, Date.now());
      expect(backend.extract(makeRawInput())).toBe(frame);
    });

    it('returns null on the second extract call with the same seq (dedup)', () => {
      const frame = makeFrame();
      NativeLandmarkBridge.setLatestFrame(frame, 1, Date.now());
      backend.extract(makeRawInput());
      expect(backend.extract(makeRawInput())).toBeNull();
    });

    it('returns the new frame after seq advances', () => {
      const first = makeFrame({ timestampMs: Date.now() });
      const second = makeFrame({ timestampMs: Date.now() });
      NativeLandmarkBridge.setLatestFrame(first, 1, Date.now());
      backend.extract(makeRawInput());
      NativeLandmarkBridge.setLatestFrame(second, 2, Date.now());
      expect(backend.extract(makeRawInput())).toBe(second);
    });

    it('returns null after bridge is cleared', () => {
      NativeLandmarkBridge.setLatestFrame(makeFrame(), 1, Date.now());
      NativeLandmarkBridge.setLatestFrame(null, 0);
      expect(backend.extract(makeRawInput())).toBeNull();
    });
  });

  describe('extract() — staleness guard', () => {
    it('returns null for a frame whose inferenceCompletedAtMs is too old', () => {
      // Default targetFps=30 → intervalMs≈33 → threshold = 33 * 3 = ~100 ms
      const frame = makeFrame({ timestampMs: Date.now() - 1000 });
      NativeLandmarkBridge.setLatestFrame(frame, 1, Date.now() - 500);
      expect(backend.extract(makeRawInput())).toBeNull();
    });

    it('returns a frame whose inference completed recently even if capture time is older', () => {
      // Simulates the real-world case: capture happened 150 ms ago (before inference
      // started), but inference just completed — the frame should pass the guard.
      const frame = makeFrame({ timestampMs: Date.now() - 150 });
      NativeLandmarkBridge.setLatestFrame(frame, 1, Date.now() - 10);
      expect(backend.extract(makeRawInput())).toBe(frame);
    });

    it('returns a recent frame', () => {
      const freshFrame = makeFrame({ timestampMs: Date.now() - 10 });
      NativeLandmarkBridge.setLatestFrame(freshFrame, 1, Date.now() - 5);
      expect(backend.extract(makeRawInput())).toBe(freshFrame);
    });
  });
});
