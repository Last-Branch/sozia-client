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

export type BridgeFrame = {
  frame: LandmarkFrame;
  /**
   * Wall-clock ms stamped in Kotlin immediately after holistic.detect returns,
   * before the result is dispatched to JS. Used by the D1 staleness guard so
   * the age is measured from when inference actually produced the result —
   * not from the capture timestamp (which precedes the ~100 ms inference).
   * Falls back to frame.timestampMs (capture time) when the native field is
   * absent, preserving backwards compatibility with older plugin builds.
   */
  inferenceCompletedAtMs: number;
  seq: number;
};

type BridgeEntry = BridgeFrame | null;

let latestEntry: BridgeEntry = null;
let lastConsumedSeq = -1;
let modelLoaded = false;

export const NativeLandmarkBridge = {
  setLatestFrame(
    frame: LandmarkFrame | null,
    seq: number,
    inferenceCompletedAtMs = 0,
  ): void {
    if (frame === null) {
      latestEntry = null;
      lastConsumedSeq = -1;
    } else {
      latestEntry = {
        frame,
        seq,
        inferenceCompletedAtMs:
          inferenceCompletedAtMs > 0 ? inferenceCompletedAtMs : frame.timestampMs,
      };
    }
  },

  /**
   * Returns the latest frame only if its seq is newer than the last consumed seq.
   * Returns null if the frame has already been consumed (stale) or no frame exists.
   */
  consumeFreshFrame(): BridgeFrame | null {
    if (latestEntry === null) return null;
    if (latestEntry.seq <= lastConsumedSeq) return null;
    lastConsumedSeq = latestEntry.seq;
    return latestEntry;
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
