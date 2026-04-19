import { NativeLandmarkBridge } from '@/pipeline/video/NativeLandmarkBridge';
import { NativeMediaPipeLandmarkBackend } from '@/pipeline/video/NativeMediaPipeLandmarkBackend';
import type { LandmarkFrame } from '@common/models';
import type { RawVideoFrame } from '@/pipeline/video/LandmarkExtractor';

const makeFrame = (overrides: Partial<LandmarkFrame> = {}): LandmarkFrame => ({
  sessionId: 'test-session',
  timestampMs: 1000,
  faceLandmarks: [[0.1, 0.2, 0.3]],
  leftHandLandmarks: null,
  rightHandLandmarks: null,
  poseLandmarks: null,
  ...overrides,
});

const makeRawInput = (overrides: Partial<RawVideoFrame> = {}): RawVideoFrame => ({
  timestampMs: 1000,
  width: 640,
  height: 480,
  data: null,
  ...overrides,
});

describe('NativeMediaPipeLandmarkBackend', () => {
  let backend: NativeMediaPipeLandmarkBackend;

  beforeEach(() => {
    NativeLandmarkBridge.setLatestFrame(null);
    NativeLandmarkBridge.setModelLoaded(false);
    backend = new NativeMediaPipeLandmarkBackend();
  });

  describe('isReady()', () => {
    it('always returns true regardless of bridge model state', () => {
      // Native models load asynchronously; the session starts immediately
      // and the frame processor returns null frames until models warm up.
      expect(backend.isReady()).toBe(true);
    });
  });

  describe('extract()', () => {
    it('returns null when bridge has no frame', () => {
      expect(backend.extract(makeRawInput())).toBeNull();
    });

    it('returns the frame stored in the bridge', () => {
      const frame = makeFrame({ timestampMs: 9999 });
      NativeLandmarkBridge.setLatestFrame(frame);
      expect(backend.extract(makeRawInput())).toBe(frame);
    });

    it('returns updated frame after bridge is overwritten', () => {
      const first = makeFrame({ timestampMs: 100 });
      const second = makeFrame({ timestampMs: 200 });
      NativeLandmarkBridge.setLatestFrame(first);
      NativeLandmarkBridge.setLatestFrame(second);
      expect(backend.extract(makeRawInput())).toBe(second);
    });

    it('returns null after bridge is cleared', () => {
      NativeLandmarkBridge.setLatestFrame(makeFrame());
      NativeLandmarkBridge.setLatestFrame(null);
      expect(backend.extract(makeRawInput())).toBeNull();
    });
  });
});
