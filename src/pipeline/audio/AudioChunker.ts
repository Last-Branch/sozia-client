import type { AudioFeatureChunk } from '../../common/models';
import type { MFCCFrame } from './AudioPipeline';
import { AudioFeatureExtractor } from './AudioFeatureExtractor';
import { VoiceActivityDetector } from './VoiceActivityDetector';

/** Duration in ms of each captured frame — must match ExpoAudioPipeline.FRAME_INTERVAL_MS. */
const FRAME_INTERVAL_MS = 25;

/**
 * Accumulates MFCCFrames from the audio pipeline and emits AudioFeatureChunks
 * at regular intervals for transmission to the inference server.
 *
 * The chunker owns the VAD and feature-extractor stages: each completed frame
 * batch is first gated by VoiceActivityDetector — silent windows are dropped
 * before they ever become chunks — and then passed through AudioFeatureExtractor
 * to produce the transmission-ready AudioFeatureChunk.
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
  private listeners = new Set<(chunk: AudioFeatureChunk) => void>();
  private vad: VoiceActivityDetector;
  private extractor: AudioFeatureExtractor;

  /**
   * @param chunkDurationMs - Duration of each chunk (default: 500 ms).
   * @param sampleRateHz - Audio sample rate (default: 16 000 Hz).
   * @param vad - Voice activity detector used to drop silent windows.
   * @param extractor - Feature extractor that builds the AudioFeatureChunk.
   */
  constructor(
    chunkDurationMs = 500,
    sampleRateHz = 16000,
    vad: VoiceActivityDetector = new VoiceActivityDetector(),
    extractor: AudioFeatureExtractor = new AudioFeatureExtractor(sampleRateHz),
  ) {
    this.chunkDurationMs = chunkDurationMs;
    this.sampleRateHz = sampleRateHz;
    this.framesPerChunk = Math.round(chunkDurationMs / FRAME_INTERVAL_MS);
    this.vad = vad;
    this.extractor = extractor;
  }

  start(sessionId: string): void {
    this.buffer = [];
    this.extractor.init(sessionId);
  }

  push(frame: MFCCFrame): void {
    this.buffer.push(frame);
    if (this.buffer.length >= this.framesPerChunk) {
      this._flush();
    }
  }

  stop(): void {
    this.buffer = [];
    this.extractor.teardown();
  }

  /**
   * Register a callback to receive completed chunks.
   * Returns an unsubscribe function.
   */
  onChunk(callback: (chunk: AudioFeatureChunk) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /** Exposes the internal VAD so higher layers can adjust sensitivity from Configuration. */
  getVoiceActivityDetector(): VoiceActivityDetector {
    return this.vad;
  }

  // ---------------------------------------------------------------------------

  private _flush(): void {
    const frames = this.buffer.splice(0, this.framesPerChunk);
    if (!this.vad.isSpeechPresent(frames)) return;
    const chunk = this.extractor.extract(frames);
    if (chunk === null) return;
    this.listeners.forEach((cb) => cb(chunk));
  }
}
