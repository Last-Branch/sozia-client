import type { AudioFeatureChunk, PipelineHealth } from '../../common/models';
import type { SensitivityLevel } from './VoiceActivityDetector';

/**
 * A single frame of extracted audio features, produced by the audio pipeline
 * at regular intervals during an active session.
 *
 * Frames are consumed locally by the audio pipeline and transmitted to the
 * server as anonymized feature vectors — raw audio is never sent.
 */
export interface MFCCFrame {
  /** Milliseconds elapsed since the session started (monotonically increasing). */
  timestampMs: number;
  /**
   * Mel-frequency cepstral coefficients — 13 values representing the spectral
   * envelope of the audio frame. Primary input for ASR and lip-reading fusion.
   */
  coefficients: number[];
  /**
   * Log-energy of the frame. Used to estimate the signal-to-noise ratio (SNR)
   * reported in PipelineHealth.
   */
  energy: number;
}

/**
 * Public contract for the audio capture and feature-extraction pipeline.
 *
 * Lifecycle:
 *   start() → (running: emitting MFCCFrames)
 *             → pause() → resume() → stop()
 *
 * Only one session is active at a time. Calling start() while already running
 * is a no-op. Callers must call stop() to release the microphone.
 */
export interface IAudioPipeline {
  /**
   * Begin microphone capture and MFCC extraction for the given session.
   * Resolves once the pipeline is ready to emit frames.
   * Rejects if the device is unavailable.
   *
   * @param sessionId - UUID v4 of the active session.
   */
  start(sessionId: string): Promise<void>;

  /**
   * Suspend frame emission without releasing the microphone.
   * No-op if already paused or not started.
   */
  pause(): void;

  /**
   * Resume frame emission after a pause.
   * No-op if not paused.
   */
  resume(): void;

  /**
   * Stop capture and release the microphone.
   * Safe to call from any state.
   */
  stop(): void;

  /**
   * Returns a snapshot of the current audio pipeline health for upstream reporting.
   * Must always return a valid PipelineHealth — before start() is called,
   * `available` is false and `sessionId` is an empty string.
   */
  getHealth(): PipelineHealth;

  /**
   * Register a callback to receive MFCC frames as they are extracted.
   * Returns an unsubscribe function; call it to stop receiving frames.
   * Multiple listeners may be registered simultaneously.
   */
  onFrame(callback: (frame: MFCCFrame) => void): () => void;

  /**
   * Register a callback to receive assembled AudioFeatureChunks — the
   * transmission-ready output of the VAD + feature-extraction stages that
   * the pipeline drives internally. Silent windows are gated out before
   * reaching this callback.
   *
   * Returns an unsubscribe function; multiple listeners may be registered
   * simultaneously. Subscriptions are cleared by stop().
   */
  onChunk(callback: (chunk: AudioFeatureChunk) => void): () => void;

  /**
   * Adjust the sensitivity of the internal voice activity detector so
   * callers can wire Configuration.vadSensitivity through a single entry
   * point on the pipeline rather than reaching into its internals.
   */
  setVadSensitivity(level: SensitivityLevel): void;
}
