import type { LandmarkFrame } from '@common/models';

/**
 * Shared in-memory slot between the VisionCamera frame processor worklet
 * and the VideoPipeline setInterval polling loop.
 *
 * The frame processor calls setLatestFrame() from the JS thread (via runOnJS)
 * after native inference completes. VideoPipeline polls consumeFreshFrame() at 30 fps.
 *
 * consumeFreshFrame() returns a frame only when its seq has advanced since the last
 * consumption, preventing VideoPipeline from re-broadcasting a stale inference result
 * across multiple poll ticks.
 */

type BridgeEntry = { frame: LandmarkFrame; seq: number } | null;

let latestEntry: BridgeEntry = null;
let lastConsumedSeq = -1;
let modelLoaded = false;

export const NativeLandmarkBridge = {
  setLatestFrame(frame: LandmarkFrame | null, seq: number): void {
    if (frame === null) {
      latestEntry = null;
      lastConsumedSeq = -1;
    } else {
      latestEntry = { frame, seq };
    }
  },

  /**
   * Returns the latest frame only if its seq is newer than the last consumed seq.
   * Returns null if the frame has already been consumed (stale) or no frame exists.
   */
  consumeFreshFrame(): LandmarkFrame | null {
    if (latestEntry === null) return null;
    if (latestEntry.seq <= lastConsumedSeq) return null;
    lastConsumedSeq = latestEntry.seq;
    return latestEntry.frame;
  },

  /** Read-only peek for health/debug — does not advance lastConsumedSeq. */
  peekLatestFrame(): LandmarkFrame | null {
    return latestEntry?.frame ?? null;
  },

  setModelLoaded(loaded: boolean): void {
    modelLoaded = loaded;
  },

  isModelLoaded(): boolean {
    return modelLoaded;
  },
};
