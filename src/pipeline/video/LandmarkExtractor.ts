/**
 * LandmarkExtractor contracts and default implementation for sozia.client.pipeline.video.
 *
 * This module intentionally exposes only anonymized coordinate arrays; raw frames
 * remain local to the video pipeline package.
 */

import type { FeatureExtractor } from '../../common/interfaces';
import type { LandmarkFrame } from '../../common/models';

/** Opaque raw frame payload captured from the camera runtime. */
export interface RawVideoFrame {
  timestampMs: number;
  width: number;
  height: number;
  data: unknown;
}

/**
 * Abstract backend so extraction engines can be swapped (mock, MediaPipe, native).
 */
export interface LandmarkExtractionBackend {
  extract(rawInput: RawVideoFrame): LandmarkFrame | null;
  isReady(): boolean;
}

/**
 * Placeholder backend: produces no landmarks until a real runtime extractor is wired.
 */
export class NullLandmarkBackend implements LandmarkExtractionBackend {
  extract(_rawInput: RawVideoFrame): LandmarkFrame | null {
    return null;
  }

  isReady(): boolean {
    return true;
  }
}

/**
 * Wrapper around a concrete landmark backend.
 */
export class LandmarkExtractor implements FeatureExtractor<RawVideoFrame, LandmarkFrame> {
  private readonly backend: LandmarkExtractionBackend;

  constructor(backend: LandmarkExtractionBackend = new NullLandmarkBackend()) {
    this.backend = backend;
  }

  extract(rawInput: RawVideoFrame): LandmarkFrame | null {
    return this.backend.extract(rawInput);
  }

  isReady(): boolean {
    return this.backend.isReady();
  }
}

