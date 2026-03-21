import type { AudioFeatureChunk } from '../../common/models';
import type { MFCCFrame } from './AudioPipeline';

/** Number of MFCC frames to accumulate before emitting a chunk (20 × 25 ms = 500 ms). */
const FRAMES_PER_CHUNK = 20;
/** Assumed sample rate of the underlying audio capture (expo-av default for HIGH_QUALITY). */
const SAMPLE_RATE_HZ = 16000;
/** Duration in ms of each captured frame — must match ExpoAudioPipeline.FRAME_INTERVAL_MS. */
const FRAME_INTERVAL_MS = 25;

/**
 * Accumulates MFCCFrames from the audio pipeline and emits AudioFeatureChunks
 * at regular intervals for transmission to the inference server.
 *
 * Usage:
 *   chunker.start(sessionId)
 *   pipeline.onFrame((f) => chunker.push(f))
 *   chunker.onChunk((c) => transmissionManager.send(c))
 *   chunker.stop()
 */
export class AudioChunker {
  private buffer: MFCCFrame[] = [];
  private sessionId = '';
  private listeners = new Set<(chunk: AudioFeatureChunk) => void>();

  start(sessionId: string): void {
    this.sessionId = sessionId;
    this.buffer = [];
  }

  push(frame: MFCCFrame): void {
    this.buffer.push(frame);
    if (this.buffer.length >= FRAMES_PER_CHUNK) {
      this._flush();
    }
  }

  stop(): void {
    this.buffer = [];
    this.sessionId = '';
  }

  /**
   * Register a callback to receive completed chunks.
   * Returns an unsubscribe function.
   */
  onChunk(callback: (chunk: AudioFeatureChunk) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // ---------------------------------------------------------------------------

  private _flush(): void {
    const frames = this.buffer.splice(0, FRAMES_PER_CHUNK);
    const chunk: AudioFeatureChunk = {
      sessionId: this.sessionId,
      timestampMs: frames[0].timestampMs,
      features: frames.map((f) => f.coefficients),
      featureType: 'mfcc',
      sampleRateHz: SAMPLE_RATE_HZ,
      chunkDurationMs: frames.length * FRAME_INTERVAL_MS,
    };
    this.listeners.forEach((cb) => cb(chunk));
  }
}
