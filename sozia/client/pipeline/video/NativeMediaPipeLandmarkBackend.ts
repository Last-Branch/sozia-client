import type { LandmarkFrame } from '@common/models';
import type { LandmarkExtractionBackend, RawVideoFrame } from './LandmarkExtractor';
import { NativeLandmarkBridge } from './NativeLandmarkBridge';

/**
 * Native MediaPipe landmark extraction backend.
 *
 * Reads asynchronously-populated landmark data from NativeLandmarkBridge.
 * The bridge is populated by the VisionCamera JSI frame processor plugin
 * (SoziaMediaPipePlugin) running inference on a dedicated native thread.
 *
 * This backend does NOT perform any inference itself — it is a thin reader
 * that decouples the VideoPipeline polling rate from the native inference rate.
 */
export class NativeMediaPipeLandmarkBackend implements LandmarkExtractionBackend {
  extract(_rawInput: RawVideoFrame): LandmarkFrame | null {
    return NativeLandmarkBridge.getLatestFrame();
  }

  isReady(): boolean {
    // Native models load asynchronously after the session starts.
    // The frame processor returns null frames until ready — the pipeline
    // handles null gracefully, so we report ready as soon as this backend is instantiated.
    return true;
  }
}
