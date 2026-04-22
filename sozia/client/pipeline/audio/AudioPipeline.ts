import type { PipelineHealth } from '@common/models';
import type { TransmissionManager } from '@/transmission/TransmissionManager';
import type { SensitivityLevel } from './VoiceActivityDetector';

/**
 * Platform-specific microphone handle passed into the audio pipeline.
 * On web, `deviceId` is forwarded to the recording backend so the correct
 * physical microphone is used. On native the field is ignored — expo-audio
 * manages the microphone internally and does not expose device selection.
 */
export type RawAudioHandle = { deviceId?: string };

/**
 * A single frame of extracted audio features, produced by the audio pipeline
 * at regular intervals during an active session.
 *
 * Frames are consumed locally by the audio pipeline and transmitted to the
 * server as anonymized feature vectors — raw audio is never sent.
 */
export interface MelFrame {
  /** Milliseconds elapsed since the session started (monotonically increasing). */
  timestampMs: number;
  /**
   * Log10-mel spectogram values for a single audio frame(80 or 128 bins depending 
   * on the deployed Whisper model). Primary input for Whisper ASR.
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
 *   start() → (running: emitting MelFrames)
 *             → pause() → resume() → stop()
 *
 * Only one session is active at a time. Calling start() while already running
 * is a no-op. Callers must call stop() to release the microphone.
 */
export interface IAudioPipeline {
  /**
   * Begin microphone capture and mel spectrogram extraction for the given session.
   * Resolves once the pipeline is ready to emit frames.
   * Rejects if the device is unavailable.
   *
   * Assembled `AudioFeatureChunk`s are pushed directly to `tx.sendFeatures()`
   * as soon as they are produced. Frames are exposed separately via `onFrame`
   * for local telemetry and testing.
   *
   * @param sessionId - UUID v4 of the active session.
   * @param micHandle - Platform-specific microphone handle. Empty object on
   *   Expo — kept for symmetry with `IVideoPipeline.start`.
   * @param tx - Optional transmission manager. When provided, completed chunks
   *   are forwarded to `tx.sendFeatures(chunk)` without an intermediate
   *   listener. Omit in tests that only need the frame stream.
   */
  start(sessionId: string, micHandle: RawAudioHandle, tx?: TransmissionManager): Promise<void>;

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
   * Register a callback to receive mel frames as they are extracted.
   * Returns an unsubscribe function; call it to stop receiving frames.
   * Multiple listeners may be registered simultaneously.
   */
  onFrame(callback: (frame: MelFrame) => void): () => void;

  /**
   * Adjust the sensitivity of the internal Voice Activity Detector.
   *
   * LLD deviation: §3.2.3 does not expose VAD configuration on the public
   * pipeline interface. It lives here because `Configuration.load()` is
   * async — the initial sensitivity has to be applied after pipeline
   * construction, and routing it through the pipeline is the only way to
   * reach the VAD without re-introducing an external chunker/VAD ref in
   * `SessionController` (which §3.2.1 does not permit).
   */
  setVadSensitivity(level: SensitivityLevel): void;
}
