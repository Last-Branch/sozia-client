import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  type AudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import { Platform } from 'react-native';

import type { PipelineHealth } from '@common/models';
import type { TransmissionManager } from '@/transmission/TransmissionManager';
import type { IAudioPipeline, MFCCFrame, RawAudioHandle } from './AudioPipeline';
import { AudioChunker } from './AudioChunker';
import type { SensitivityLevel } from './VoiceActivityDetector';

const FRAME_INTERVAL_MS = 25; // 40 Hz frame rate
const NUM_MFCC_COEFFICIENTS = 13;
const NOISE_FLOOR_DBFS = -60; // assumed noise floor for SNR estimation

// Mirrors expo-audio@1.1.x internal `createRecordingOptions`. Revisit on upgrade.
// See TP-CLIENT-AUDIO-007 for shape assertion.
function flattenRecordingOptions(options: RecordingOptions): Record<string, unknown> {
  const common = {
    extension: options.extension,
    sampleRate: options.sampleRate,
    numberOfChannels: options.numberOfChannels,
    bitRate: options.bitRate,
    isMeteringEnabled: options.isMeteringEnabled ?? false,
  };
  if (Platform.OS === 'ios') return { ...common, ...options.ios };
  if (Platform.OS === 'android') return { ...common, ...options.android };
  return { ...common, ...options.web };
}

/**
 * Concrete implementation of IAudioPipeline for Expo (React Native) environments.
 *
 * Uses `expo-audio` for microphone capture. Owns an internal AudioChunker that
 * batches MFCC frames through VAD + feature extraction; completed chunks are
 * pushed directly to the TransmissionManager supplied at `start()` time,
 * matching LLD §3.2.3.
 *
 * MFCC extraction is a placeholder based on expo-audio's dBFS metering values;
 * it will be replaced with a proper Mel filterbank + DCT computation once raw
 * PCM sample buffers are accessible. See `_placeholderMfcc()` for details.
 */
export class ExpoAudioPipeline implements IAudioPipeline {
  private sessionId = '';
  private sessionStartMs = 0;
  private available = false;
  private paused = false;
  private lastUpdatedMs = 0;
  private currentSnr: number | null = null;

  private recorder: AudioRecorder | null = null;
  private frameTimer: ReturnType<typeof setInterval> | null = null;
  private frameListeners = new Set<(frame: MFCCFrame) => void>();

  /** Most recent dBFS metering value polled from the recorder. */
  private lastMeteringDbfs = NOISE_FLOOR_DBFS;

  private readonly chunker: AudioChunker;
  private tx: TransmissionManager | null = null;
  private unsubscribeChunker: (() => void) | null = null;

  constructor(chunker: AudioChunker = new AudioChunker()) {
    this.chunker = chunker;
  }

  async start(
    sessionId: string,
    _micHandle: RawAudioHandle = {},
    tx?: TransmissionManager,
  ): Promise<void> {
    if (this.available || this.paused) return;

    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });

    const options = flattenRecordingOptions({
      ...RecordingPresets.HIGH_QUALITY,
      isMeteringEnabled: true,
    });
    const recorder = new AudioModule.AudioRecorder(options);
    await recorder.prepareToRecordAsync();
    recorder.record();

    this.recorder = recorder;
    this.sessionId = sessionId;
    this.sessionStartMs = Date.now();
    this.available = true;
    this.paused = false;
    this.tx = tx ?? null;

    this.chunker.start(sessionId);
    this.unsubscribeChunker = this.chunker.onChunk((chunk) => {
      this.tx?.sendFeatures(chunk);
    });

    this._startFrameTimer();
  }

  pause(): void {
    if (!this.available || this.paused) return;
    this.paused = true;
    this.available = false;
    this._stopFrameTimer();
    this.recorder?.pause();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.available = true;
    // expo-audio: record() also resumes a paused recorder.
    this.recorder?.record();
    this._startFrameTimer();
  }

  stop(): void {
    this._stopFrameTimer();
    this.frameListeners.clear();
    this.unsubscribeChunker?.();
    this.unsubscribeChunker = null;
    this.chunker.stop();
    this.tx = null;
    this.available = false;
    this.paused = false;
    this.sessionId = '';
    this.currentSnr = null;

    const rec = this.recorder;
    this.recorder = null;
    rec
      ?.stop()
      .then(() => setAudioModeAsync({ allowsRecording: false }))
      .catch((err: unknown) => {
        console.warn('[ExpoAudioPipeline] stop cleanup failed:', err);
      });
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

  setVadSensitivity(level: SensitivityLevel): void {
    this.chunker.getVoiceActivityDetector().setSensitivity(level);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _startFrameTimer(): void {
    this.frameTimer = setInterval(() => {
      if (this.recorder) {
        const status = this.recorder.getStatus();
        if (typeof status.metering === 'number') {
          this.lastMeteringDbfs = status.metering;
        }
      }
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
   * once raw PCM sample buffers are accessible. The output satisfies the
   * MFCCFrame contract (13 finite floats) and enables full pipeline wiring
   * and device-level testing without PCM access.
   */
  private _placeholderMfcc(linearEnergy: number): number[] {
    const logEnergy = Math.log(linearEnergy + 1e-10);
    return Array.from(
      { length: NUM_MFCC_COEFFICIENTS },
      (_, k) => logEnergy * Math.cos((Math.PI / NUM_MFCC_COEFFICIENTS) * (k + 0.5))
    );
  }
}
