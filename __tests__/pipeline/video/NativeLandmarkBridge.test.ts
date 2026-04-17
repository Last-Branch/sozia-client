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
    NativeLandmarkBridge.setLatestFrame(null);
    NativeLandmarkBridge.setModelLoaded(false);
  });

  it('starts with null frame', () => {
    expect(NativeLandmarkBridge.getLatestFrame()).toBeNull();
  });

  it('starts with model not loaded', () => {
    expect(NativeLandmarkBridge.isModelLoaded()).toBe(false);
  });

  it('setLatestFrame stores frame and getLatestFrame retrieves it', () => {
    const frame = makeFrame({ timestampMs: 5000 });
    NativeLandmarkBridge.setLatestFrame(frame);
    expect(NativeLandmarkBridge.getLatestFrame()).toBe(frame);
  });

  it('setLatestFrame(null) clears the stored frame', () => {
    NativeLandmarkBridge.setLatestFrame(makeFrame());
    NativeLandmarkBridge.setLatestFrame(null);
    expect(NativeLandmarkBridge.getLatestFrame()).toBeNull();
  });

  it('setModelLoaded(true) makes isModelLoaded() return true', () => {
    NativeLandmarkBridge.setModelLoaded(true);
    expect(NativeLandmarkBridge.isModelLoaded()).toBe(true);
  });

  it('setModelLoaded(false) makes isModelLoaded() return false after true', () => {
    NativeLandmarkBridge.setModelLoaded(true);
    NativeLandmarkBridge.setModelLoaded(false);
    expect(NativeLandmarkBridge.isModelLoaded()).toBe(false);
  });

  it('overwrites previous frame on successive setLatestFrame calls', () => {
    const first = makeFrame({ timestampMs: 100 });
    const second = makeFrame({ timestampMs: 200 });
    NativeLandmarkBridge.setLatestFrame(first);
    NativeLandmarkBridge.setLatestFrame(second);
    expect(NativeLandmarkBridge.getLatestFrame()).toBe(second);
  });
});
