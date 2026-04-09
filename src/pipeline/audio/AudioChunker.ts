import type { AudioFeatureChunk } from '../../common/models';
import type { MFCCFrame } from './AudioPipeline';

/** Duration in ms of each captured frame — must match ExpoAudioPipeline.FRAME_INTERVAL_MS. */
const FRAME_INTERVAL_MS = 25;

/**
 * Accumulates MFCCFrames from the audio pipeline and emits AudioFeatureChunks
 * at regular intervals for transmission to the inference server.
 *
 * Collaborators: ExpoAudioPipeline (produces frames), TransmissionManager (consumes chunks).
 *
 * Thread/concurrency: single-threaded, safe from any async context.
 *
 * @example
 *   chunker.start(sessionId)
 *   pipeline.onFrame((f) => chunker.push(f))
 *   chunker.onChunk((c) => transmissionManager.send(c))
 *   chunker.stop()
 */
export class AudioChunker {
  /** Duration of each emitted chunk in milliseconds. Configurable via Configuration. */
  readonly chunkDurationMs: number;
  /** Audio sample rate in Hz. Configurable via Configuration. */
  readonly sampleRateHz: number;

  private framesPerChunk: number;
  private buffer: MFCCFrame[] = [];
  private sessionId = '';
  private listeners = new Set<(chunk: AudioFeatureChunk) => void>();

  /**
   * @param chunkDurationMs - Duration of each chunk (default: 500 ms).
   * @param sampleRateHz - Audio sample rate (default: 16 000 Hz).
   */
  constructor(chunkDurationMs = 500, sampleRateHz = 16000) {
    this.chunkDurationMs = chunkDurationMs;
    this.sampleRateHz = sampleRateHz;
    this.framesPerChunk = Math.round(chunkDurationMs / FRAME_INTERVAL_MS);
  }

  start(sessionId: string): void {
    this.sessionId = sessionId;
    this.buffer = [];
  }

  push(frame: MFCCFrame): void {
    this.buffer.push(frame);
    if (this.buffer.length >= this.framesPerChunk) {
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
    const frames = this.buffer.splice(0, this.framesPerChunk);
    const chunk: AudioFeatureChunk = {
      sessionId: this.sessionId,
      timestampMs: frames[0].timestampMs,
      features: frames.map((f) => f.coefficients),
      featureType: 'mfcc',
      sampleRateHz: this.sampleRateHz,
      chunkDurationMs: frames.length * FRAME_INTERVAL_MS,
    };
    this.listeners.forEach((cb) => cb(chunk));
  }
}
