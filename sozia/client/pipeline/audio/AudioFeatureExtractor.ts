import type { FeatureExtractor } from '@common/interfaces';
import type { AudioFeatureChunk } from '@common/models';
import type { MFCCFrame } from './AudioPipeline';

/**
 * Converts a batch of MFCCFrames into an AudioFeatureChunk ready for
 * transmission to the inference server.
 *
 * Implements the FeatureExtractor contract from LLD Section 3.2.3.
 * Acts as the boundary between local audio processing and the network
 * layer — raw audio never passes through this class, only anonymized
 * numerical features.
 *
 * Collaborators: AudioChunker (provides frame batches),
 *                TransmissionManager (consumes chunks).
 */
export class AudioFeatureExtractor
  implements FeatureExtractor<MFCCFrame[], AudioFeatureChunk>
{
  private ready = false;
  private sessionId = '';
  private sampleRateHz: number;

  constructor(sampleRateHz = 16000) {
    this.sampleRateHz = sampleRateHz;
  }

  /**
   * Initialise the extractor for a new session.
   * Must be called before `extract()` will produce output.
   */
  init(sessionId: string): void {
    this.sessionId = sessionId;
    this.ready = true;
  }

  /**
   * Release resources and mark the extractor as not ready.
   */
  teardown(): void {
    this.ready = false;
    this.sessionId = '';
  }

  /**
   * Converts an array of MFCCFrames into a single AudioFeatureChunk.
   *
   * Returns null if the extractor has not been initialised or the input
   * is empty — callers should silently skip null results.
   *
   * @param rawInput - Batch of MFCCFrames from a single chunker window.
   */
  extract(rawInput: MFCCFrame[]): AudioFeatureChunk | null {
    if (!this.ready || rawInput.length === 0) return null;

    const firstTimestamp = rawInput[0].timestampMs;
    const lastTimestamp = rawInput[rawInput.length - 1].timestampMs;
    const frameDuration = rawInput.length > 1
      ? (lastTimestamp - firstTimestamp) / (rawInput.length - 1)
      : 25; // fallback to default frame interval

    return {
      sessionId: this.sessionId,
      timestampMs: firstTimestamp,
      features: rawInput.map((f) => f.coefficients),
      featureType: 'mfcc',
      sampleRateHz: this.sampleRateHz,
      chunkDurationMs: Math.round(rawInput.length * frameDuration),
    };
  }

  isReady(): boolean {
    return this.ready;
  }
}
