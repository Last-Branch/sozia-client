import type { LandmarkFrame } from '@common/models';
import type { LandmarkExtractionBackend, RawVideoFrame } from './LandmarkExtractor';
import { NativeLandmarkBridge } from './NativeLandmarkBridge';

const STALE_THRESHOLD_MULTIPLIER = 3;

/**
 * Native MediaPipe landmark extraction backend.
 *
 * Reads asynchronously-populated landmark data from NativeLandmarkBridge.
 * The bridge is populated by the VisionCamera JSI frame processor plugin
 * (SoziaMediaPipePlugin) running inference on a dedicated native thread.
 *
 * consumeFreshFrame() ensures each inference result is forwarded at most once,
 * preventing the 30 Hz poll loop from re-broadcasting stale landmark frames
 * to the server while the native thread is still busy.
 */
export class NativeMediaPipeLandmarkBackend implements LandmarkExtractionBackend {
  private readonly targetIntervalMs: number;

  constructor(targetFps = 30) {
    this.targetIntervalMs = 1000 / targetFps;
  }

  extract(_rawInput: RawVideoFrame): LandmarkFrame | null {
    const frame = NativeLandmarkBridge.consumeFreshFrame();
    if (frame === null) return null;

    // Guard against a frozen inference thread re-emitting an ancient frame.
    const ageMs = Date.now() - frame.timestampMs;
    if (ageMs > this.targetIntervalMs * STALE_THRESHOLD_MULTIPLIER) return null;

    return frame;
  }

  isReady(): boolean {
    // Native models load asynchronously after the session starts.
    // The frame processor returns null frames until ready — the pipeline
    // handles null gracefully, so we report ready as soon as this backend is instantiated.
    return true;
  }
}
