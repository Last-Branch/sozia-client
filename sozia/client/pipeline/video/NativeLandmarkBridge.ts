import type { LandmarkFrame } from '@common/models';

/**
 * Shared in-memory slot between the VisionCamera frame processor worklet
 * and the VideoPipeline setInterval polling loop.
 *
 * The frame processor calls setLatestFrame() from the JS thread (via runOnJS)
 * after native inference completes. VideoPipeline polls getLatestFrame() at 30 fps.
 */

let latestFrame: LandmarkFrame | null = null;
let modelLoaded = false;

export const NativeLandmarkBridge = {
  setLatestFrame(frame: LandmarkFrame | null): void {
    latestFrame = frame;
  },

  getLatestFrame(): LandmarkFrame | null {
    return latestFrame;
  },

  setModelLoaded(loaded: boolean): void {
    modelLoaded = loaded;
  },

  isModelLoaded(): boolean {
    return modelLoaded;
  },
};
