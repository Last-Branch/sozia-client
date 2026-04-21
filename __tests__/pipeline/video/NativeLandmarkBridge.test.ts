import { NativeLandmarkBridge } from '@/pipeline/video/NativeLandmarkBridge';
import type { LandmarkFrame } from '@common/models';

const makeFrame = (overrides: Partial<LandmarkFrame> = {}): LandmarkFrame => ({
  sessionId: 'test-session',
  timestampMs: 1000,
  faceLandmarks: null,
  leftHandLandmarks: null,
  rightHandLandmarks: null,
  poseLandmarks: null,
  ...overrides,
});

describe('NativeLandmarkBridge', () => {
  beforeEach(() => {
    // setLatestFrame(null) resets both latestEntry and lastConsumedSeq.
    NativeLandmarkBridge.setLatestFrame(null, 0);
    NativeLandmarkBridge.setModelLoaded(false);
  });

  describe('consumeFreshFrame()', () => {
    it('returns null when no frame has been set', () => {
      expect(NativeLandmarkBridge.consumeFreshFrame()).toBeNull();
    });

    it('returns the entry on the first consume after a new seq', () => {
      const frame = makeFrame({ timestampMs: 5000 });
      NativeLandmarkBridge.setLatestFrame(frame, 1, 5100);
      const entry = NativeLandmarkBridge.consumeFreshFrame();
      expect(entry?.frame).toBe(frame);
      expect(entry?.inferenceCompletedAtMs).toBe(5100);
      expect(entry?.seq).toBe(1);
    });

    it('falls back to frame.timestampMs when inferenceCompletedAtMs is omitted', () => {
      const frame = makeFrame({ timestampMs: 5000 });
      NativeLandmarkBridge.setLatestFrame(frame, 1);
      expect(NativeLandmarkBridge.consumeFreshFrame()?.inferenceCompletedAtMs).toBe(5000);
    });

    it('returns null on subsequent consumes with the same seq (dedup)', () => {
      const frame = makeFrame({ timestampMs: 5000 });
      NativeLandmarkBridge.setLatestFrame(frame, 1, 5100);
      NativeLandmarkBridge.consumeFreshFrame();
      expect(NativeLandmarkBridge.consumeFreshFrame()).toBeNull();
    });

    it('returns the new entry after seq advances', () => {
      const first = makeFrame({ timestampMs: 100 });
      const second = makeFrame({ timestampMs: 200 });
      NativeLandmarkBridge.setLatestFrame(first, 1, 150);
      NativeLandmarkBridge.consumeFreshFrame();
      NativeLandmarkBridge.setLatestFrame(second, 2, 250);
      expect(NativeLandmarkBridge.consumeFreshFrame()?.frame).toBe(second);
    });

    it('returns null after bridge is cleared with setLatestFrame(null)', () => {
      NativeLandmarkBridge.setLatestFrame(makeFrame(), 1, 100);
      NativeLandmarkBridge.setLatestFrame(null, 0);
      expect(NativeLandmarkBridge.consumeFreshFrame()).toBeNull();
    });

    it('returns entry again after clear and re-set even with seq=1', () => {
      NativeLandmarkBridge.setLatestFrame(makeFrame(), 1, 100);
      NativeLandmarkBridge.consumeFreshFrame();
      NativeLandmarkBridge.setLatestFrame(null, 0);
      const fresh = makeFrame({ timestampMs: 999 });
      NativeLandmarkBridge.setLatestFrame(fresh, 1, 1000);
      expect(NativeLandmarkBridge.consumeFreshFrame()?.frame).toBe(fresh);
    });
  });

  describe('peekLatestFrame()', () => {
    it('returns the current frame without advancing lastConsumedSeq', () => {
      const frame = makeFrame({ timestampMs: 5000 });
      NativeLandmarkBridge.setLatestFrame(frame, 1, 5100);
      NativeLandmarkBridge.peekLatestFrame();
      expect(NativeLandmarkBridge.consumeFreshFrame()?.frame).toBe(frame);
    });

    it('returns null when bridge is empty', () => {
      expect(NativeLandmarkBridge.peekLatestFrame()).toBeNull();
    });
  });

  describe('model loaded flag', () => {
    it('starts as false', () => {
      expect(NativeLandmarkBridge.isModelLoaded()).toBe(false);
    });

    it('reflects setModelLoaded(true)', () => {
      NativeLandmarkBridge.setModelLoaded(true);
      expect(NativeLandmarkBridge.isModelLoaded()).toBe(true);
    });

    it('reflects setModelLoaded(false) after true', () => {
      NativeLandmarkBridge.setModelLoaded(true);
      NativeLandmarkBridge.setModelLoaded(false);
      expect(NativeLandmarkBridge.isModelLoaded()).toBe(false);
    });
  });
});
