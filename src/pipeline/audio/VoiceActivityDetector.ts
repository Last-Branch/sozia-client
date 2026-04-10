import type { MFCCFrame } from './AudioPipeline';

/**
 * Energy-based voice activity detector that determines whether a chunk of
 * audio frames contains speech.
 *
 * Uses the per-frame `energy` (dBFS) from MFCCFrames to classify chunks as
 * speech or silence. A chunk is considered speech when the proportion of
 * frames above the energy threshold exceeds a sensitivity-dependent ratio.
 *
 * Sensitivity levels adjust how aggressively the detector triggers:
 *   - 'low'    — requires a strong signal; fewer false positives in noisy environments.
 *   - 'medium' — balanced default.
 *   - 'high'   — triggers on quieter speech; useful in controlled/quiet environments.
 *
 * Collaborators: AudioChunker (caller), AudioPipeline (frame source).
 */
export type SensitivityLevel = 'low' | 'medium' | 'high';

const ENERGY_THRESHOLDS: Record<SensitivityLevel, number> = {
  low: -30,
  medium: -40,
  high: -50,
};

const SPEECH_RATIO_THRESHOLDS: Record<SensitivityLevel, number> = {
  low: 0.6,
  medium: 0.4,
  high: 0.25,
};

export class VoiceActivityDetector {
  private sensitivity: SensitivityLevel = 'medium';

  /**
   * Determines whether the given chunk of frames contains speech.
   *
   * @param chunk - Array of MFCCFrames from a single AudioChunker window.
   * @returns true if the chunk likely contains speech.
   */
  isSpeechPresent(chunk: MFCCFrame[]): boolean {
    if (chunk.length === 0) return false;

    const energyThreshold = ENERGY_THRESHOLDS[this.sensitivity];
    const ratioThreshold = SPEECH_RATIO_THRESHOLDS[this.sensitivity];

    const activeFrames = chunk.filter((f) => f.energy > energyThreshold).length;
    return activeFrames / chunk.length >= ratioThreshold;
  }

  /**
   * Adjusts detection sensitivity.
   *
   * @param level - 'low' (strict), 'medium' (default), or 'high' (permissive).
   */
  setSensitivity(level: SensitivityLevel): void {
    this.sensitivity = level;
  }

  getSensitivity(): SensitivityLevel {
    return this.sensitivity;
  }
}
