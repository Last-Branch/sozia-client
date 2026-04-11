import { Audio } from 'expo-av';

import type { AudioFeatureChunk, PipelineHealth } from '../../common/models';
import type { IAudioPipeline, MFCCFrame } from './AudioPipeline';
import { AudioChunker } from './AudioChunker';
import type { SensitivityLevel } from './VoiceActivityDetector';

const FRAME_INTERVAL_MS = 25; // 40 Hz frame rate
const NUM_MFCC_COEFFICIENTS = 13;
const NOISE_FLOOR_DBFS = -60; // assumed noise floor for SNR estimation

/**
 * Concrete implementation of IAudioPipeline for Expo (React Native) environments.
 *
 * Uses expo-av for microphone capture and Android/iOS permission management.
 *
 * MFCC extraction is a placeholder based on expo-av's dBFS metering values;
 * it will be replaced with a proper Mel filterbank + DCT computation once raw
 * PCM sample buffers are accessible (expo-av does not expose PCM in managed
 * workflow). See `_placeholderMfcc()` for details.
 */
export class ExpoAudioPipeline implements IAudioPipeline {
  private sessionId = '';
  private sessionStartMs = 0;
  private available = false;
  private paused = false;
  private lastUpdatedMs = 0;
  private currentSnr: number | null = null;

  private recording: Audio.Recording | null = null;
  private frameTimer: ReturnType<typeof setInterval> | null = null;
  private frameListeners = new Set<(frame: MFCCFrame) => void>();

  /** Most recent dBFS metering value from expo-av status updates. */
  private lastMeteringDbfs = NOISE_FLOOR_DBFS;

  /**
   * Internal chunker that batches MFCC frames into AudioFeatureChunks.
   * The chunker owns its own VAD and feature extractor; the pipeline drives
   * it on every extracted frame and exposes its output via onChunk().
   */
  private readonly chunker: AudioChunker;

  constructor(chunker: AudioChunker = new AudioChunker()) {
    this.chunker = chunker;
  }

  async start(sessionId: string): Promise<void> {
    if (this.available || this.paused) return;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording } = await Audio.Recording.createAsync({
      ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
      isMeteringEnabled: true,
    });

    recording.setOnRecordingStatusUpdate((status) => {
      if (status.metering != null) {
        this.lastMeteringDbfs = status.metering;
      }
    });
    recording.setProgressUpdateInterval(FRAME_INTERVAL_MS);

    this.recording = recording;
    this.sessionId = sessionId;
    this.sessionStartMs = Date.now();
    this.available = true;
    this.paused = false;
    this.chunker.start(sessionId);

    this._startFrameTimer();
  }

  pause(): void {
    if (!this.available || this.paused) return;
    this.paused = true;
    this.available = false;
    this._stopFrameTimer();
    this.recording?.pauseAsync().catch(() => {});
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.available = true;
    // expo-av: startAsync() resumes a paused recording
    this.recording?.startAsync().catch(() => {});
    this._startFrameTimer();
  }

  stop(): void {
    this._stopFrameTimer();
    this.frameListeners.clear();
    this.chunker.clearListeners();
    this.chunker.stop();
    this.available = false;
    this.paused = false;
    this.sessionId = '';
    this.currentSnr = null;

    const rec = this.recording;
    this.recording = null;
    rec?.stopAndUnloadAsync().catch(() => {});
  }

  getHealth(): PipelineHealth {
    return {
      sessionId: this.sessionId,
      pipeline: 'audio',
      available: this.available,
      fps: null,
      faceDetected: null,
      snr: this.currentSnr,
      lastUpdatedMs: this.lastUpdatedMs,
    };
  }

  onFrame(callback: (frame: MFCCFrame) => void): () => void {
    this.frameListeners.add(callback);
    return () => this.frameListeners.delete(callback);
  }

  onChunk(callback: (chunk: AudioFeatureChunk) => void): () => void {
    return this.chunker.onChunk(callback);
  }

  setVadSensitivity(level: SensitivityLevel): void {
    this.chunker.getVoiceActivityDetector().setSensitivity(level);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _startFrameTimer(): void {
    this.frameTimer = setInterval(() => {
      const frame = this._extractFrame();
      this.lastUpdatedMs = frame.timestampMs;
      this.currentSnr = Math.max(0, this.lastMeteringDbfs - NOISE_FLOOR_DBFS);
      this.chunker.push(frame);
      this.frameListeners.forEach((cb) => cb(frame));
    }, FRAME_INTERVAL_MS);
  }

  private _stopFrameTimer(): void {
    if (this.frameTimer !== null) {
      clearInterval(this.frameTimer);
      this.frameTimer = null;
    }
  }

  private _extractFrame(): MFCCFrame {
    const timestampMs = Date.now() - this.sessionStartMs;
    const energy = this.lastMeteringDbfs;
    const linearEnergy = Math.pow(10, energy / 20);
    return {
      timestampMs,
      energy,
      coefficients: this._placeholderMfcc(linearEnergy),
    };
  }

  /**
   * Produces 13 synthetic MFCC coefficients from the current linear energy level
   * via a deterministic cosine transform of a flat log-Mel spectrum.
   *
   * PLACEHOLDER — must be replaced with a proper Mel filterbank + DCT pipeline
   * once expo-av (or an alternative module) exposes raw PCM sample buffers.
   * The output satisfies the MFCCFrame contract (13 finite floats) and enables
   * full pipeline wiring and device-level testing without PCM access.
   */
  private _placeholderMfcc(linearEnergy: number): number[] {
    const logEnergy = Math.log(linearEnergy + 1e-10);
    return Array.from(
      { length: NUM_MFCC_COEFFICIENTS },
      (_, k) => logEnergy * Math.cos((Math.PI / NUM_MFCC_COEFFICIENTS) * (k + 0.5))
    );
  }
}
