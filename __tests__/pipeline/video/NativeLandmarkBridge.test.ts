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

    it('returns the frame on the first consume after a new seq', () => {
      const frame = makeFrame({ timestampMs: 5000 });
      NativeLandmarkBridge.setLatestFrame(frame, 1);
      expect(NativeLandmarkBridge.consumeFreshFrame()).toBe(frame);
    });

    it('returns null on subsequent consumes with the same seq (dedup)', () => {
      const frame = makeFrame({ timestampMs: 5000 });
      NativeLandmarkBridge.setLatestFrame(frame, 1);
      NativeLandmarkBridge.consumeFreshFrame();
      expect(NativeLandmarkBridge.consumeFreshFrame()).toBeNull();
    });

    it('returns the new frame after seq advances', () => {
      const first = makeFrame({ timestampMs: 100 });
      const second = makeFrame({ timestampMs: 200 });
      NativeLandmarkBridge.setLatestFrame(first, 1);
      NativeLandmarkBridge.consumeFreshFrame();
      NativeLandmarkBridge.setLatestFrame(second, 2);
      expect(NativeLandmarkBridge.consumeFreshFrame()).toBe(second);
    });

    it('returns null after bridge is cleared with setLatestFrame(null)', () => {
      NativeLandmarkBridge.setLatestFrame(makeFrame(), 1);
      NativeLandmarkBridge.setLatestFrame(null, 0);
      expect(NativeLandmarkBridge.consumeFreshFrame()).toBeNull();
    });

    it('returns frame again after clear and re-set even with seq=1', () => {
      NativeLandmarkBridge.setLatestFrame(makeFrame(), 1);
      NativeLandmarkBridge.consumeFreshFrame();
      NativeLandmarkBridge.setLatestFrame(null, 0);
      const fresh = makeFrame({ timestampMs: 999 });
      NativeLandmarkBridge.setLatestFrame(fresh, 1);
      expect(NativeLandmarkBridge.consumeFreshFrame()).toBe(fresh);
    });
  });

  describe('peekLatestFrame()', () => {
    it('returns the current frame without advancing lastConsumedSeq', () => {
      const frame = makeFrame({ timestampMs: 5000 });
      NativeLandmarkBridge.setLatestFrame(frame, 1);
      NativeLandmarkBridge.peekLatestFrame();
      expect(NativeLandmarkBridge.consumeFreshFrame()).toBe(frame);
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
