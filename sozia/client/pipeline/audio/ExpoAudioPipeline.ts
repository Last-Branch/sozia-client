import { LegacyEventEmitter } from 'expo-modules-core';
import { AudioStudioModule } from '@siteed/audio-studio';

import type { PipelineHealth } from '@common/models';
import type { TransmissionManager } from '@/transmission/TransmissionManager';
import type { IAudioPipeline, MelFrame, RawAudioHandle } from './AudioPipeline';
import { AudioChunker } from './AudioChunker';
import { MelComputer, frameLogEnergy } from './MelComputer';
import type { SensitivityLevel } from './VoiceActivityDetector';

const SAMPLE_RATE = 16_000;
const WINDOW_SIZE_SAMPLES = 400; // 25 ms window at 16 kHz
const HOP_SIZE_SAMPLES = 160; // 10 ms hop → 100 Hz frame rate (matches Whisper)
const NOISE_FLOOR_DBFS = -60;
const AUDIO_STALE_TIMEOUT_MS = 2500;

/**
 * Minimal interface covering the recording methods we call on the underlying
 * audio module. On native the NativeModule satisfies this directly; on web we
 * obtain the AudioStudioWeb singleton instance via the factory call.
 */
interface AudioRecorder {
  startRecording(config: unknown): Promise<void>;
  stopRecording?(): Promise<void>;
  pauseRecording?(): Promise<void>;
  resumeRecording?(): Promise<void>;
}

/**
 * Concrete implementation of IAudioPipeline using @siteed/audio-studio.
 *
 * PCM delivery differs by platform:
 * - Web:    `AudioStudioWeb` emits `'AudioData'` events (via its own `LegacyEventEmitter`)
 *           with `event.buffer: Float32Array`. Subscribed via `instance.addListener()`.
 * - Native: `cleanNativeOptions` JSON-serialises the startRecording config before it
 *           reaches the bridge, silently dropping all function fields including
 *           `onAudioStream`. PCM is delivered instead via a `LegacyEventEmitter` wrapping
 *           `AudioStudioModule`, emitting `'AudioData'` with `event.pcmFloat32`
 *           (Android = `Float32Array`, iOS = `number[]`).
 *
 * `MelComputer` performs Hann window → FFT → 80-bin Mel filterbank → log10.
 * Frames are sliced from a rolling sample accumulator with a 160-sample hop
 * (10 ms, 100 Hz) matching Whisper's expected frame rate.
 *
 * Platform normalisation: `_resolveRecorder()` returns the object that carries
 * `startRecording`/`stopRecording`/etc. On web this is the `AudioStudioWeb` singleton
 * (obtained by calling the factory). On native it is `AudioStudioModule` directly.
 */
export class ExpoAudioPipeline implements IAudioPipeline {
  private sessionId = '';
  private sessionStartMs = 0;
  private available = false;
  private paused = false;
  private recordingActive = false;
  private lastUpdatedMs = 0;
  private currentSnr: number | null = null;
  private staleWatchdog: ReturnType<typeof setInterval> | null = null;

  private sampleAccumulator = new Float32Array(0);
  private frameListeners = new Set<(frame: MelFrame) => void>();

  private readonly chunker: AudioChunker;
  private readonly mel: MelComputer;
  private tx: TransmissionManager | null = null;
  private unsubscribeChunker: (() => void) | null = null;
  private audioSubscription: { remove: () => void } | null = null;

  constructor(chunker: AudioChunker = new AudioChunker()) {
    this.chunker = chunker;
    this.mel = new MelComputer();
  }

  async start(
    sessionId: string,
    _micHandle: RawAudioHandle = {},
    tx?: TransmissionManager,
  ): Promise<void> {
    if (this.available || this.paused) return;

    this.sessionId = sessionId;
    this.sessionStartMs = Date.now();
    this.available = true;
    this.paused = false;
    this.tx = tx ?? null;
    this.sampleAccumulator = new Float32Array(0);

    this.chunker.start(sessionId);
    this.unsubscribeChunker = this.chunker.onChunk((chunk) => {
      this.tx?.sendFeatures(chunk);
    });

    const recorder = this._resolveRecorder();
    this.recordingActive = true;

    const isWeb =
      typeof AudioStudioModule === 'function' && !('startRecording' in AudioStudioModule);

    const recordingConfig = {
      sampleRate: SAMPLE_RATE,
      channels: 1,
      encoding: 'pcm_16bit',
      streamFormat: 'float32',
      interval: 10,
      output: { primary: { enabled: false } },
    };

    if (isWeb) {
      // On web, AudioStudioWeb emits 'AudioData' events via its own LegacyEventEmitter.
      // The onAudioStream config field is native-only and never called on web.
      type WebInstance = { addListener: (event: string, cb: (e: { buffer: Float32Array }) => void) => { remove: () => void } };
      this.audioSubscription = (recorder as unknown as WebInstance).addListener(
        'AudioData',
        (event) => {
          if (!this.available || this.paused) return;
          this._processBuffer(event.buffer);
        },
      );
    } else {
      // On native, startRecording config is JSON-serialised by cleanNativeOptions before reaching
      // the bridge — all function fields (including onAudioStream) are silently stripped.
      // PCM data is delivered via a LegacyEventEmitter 'AudioData' event instead.
      type NativeAudioEvent = { pcmFloat32?: Float32Array | number[]; buffer?: Float32Array };
      const emitter = new LegacyEventEmitter(AudioStudioModule as never);
      this.audioSubscription = emitter.addListener('AudioData', (event: NativeAudioEvent) => {
        if (!this.available || this.paused) return;
        const raw = event.pcmFloat32 ?? event.buffer;
        if (!raw || raw.length === 0) return;
        const samples = raw instanceof Float32Array ? raw : new Float32Array(raw);
        this._processBuffer(samples);
      });
    }

    await recorder.startRecording(recordingConfig);
    this.startWatchdog();
  }

  pause(): void {
    if (!this.available || this.paused) return;
    this.paused = true;
    this.available = false;
    if (this.recordingActive) {
      this._resolveRecorder().pauseRecording?.().catch((err: unknown) => {
        console.warn('[ExpoAudioPipeline] pauseRecording failed:', err);
      });
    }
    this.stopWatchdog();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.available = true;
    if (this.recordingActive) {
      this._resolveRecorder().resumeRecording?.().catch((err: unknown) => {
        console.warn('[ExpoAudioPipeline] resumeRecording failed:', err);
      });
    }
    this.startWatchdog();
  }

  stop(): void {
    this.audioSubscription?.remove();
    this.audioSubscription = null;
    this.frameListeners.clear();
    this.unsubscribeChunker?.();
    this.unsubscribeChunker = null;
    this.chunker.stop();
    this.tx = null;
    this.available = false;
    this.paused = false;
    this.sessionId = '';
    this.currentSnr = null;
    this.sampleAccumulator = new Float32Array(0);
    this.lastUpdatedMs = 0;
    this.stopWatchdog();

    if (this.recordingActive) {
      this.recordingActive = false;
      this._resolveRecorder().stopRecording?.().catch((err: unknown) => {
        console.warn('[ExpoAudioPipeline] stopRecording failed:', err);
      });
    }
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

  onFrame(callback: (frame: MelFrame) => void): () => void {
    this.frameListeners.add(callback);
    return () => this.frameListeners.delete(callback);
  }

  setVadSensitivity(level: SensitivityLevel): void {
    this.chunker.getVoiceActivityDetector().setSensitivity(level);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns the object that exposes `startRecording`, `stopRecording`, etc.
   *
   * On native: `AudioStudioModule` IS that object (NativeModule).
   * On web:    `AudioStudioModule` is a factory function — invoking it (with no
   *            arguments) returns the `AudioStudioWeb` singleton, which carries
   *            all recording methods as instance methods.
   */
  private _resolveRecorder(): AudioRecorder {
    if (typeof AudioStudioModule === 'function' && !('startRecording' in AudioStudioModule)) {
      return (AudioStudioModule as unknown as (opts: Record<string, never>) => AudioRecorder)({} as Record<string, never>);
    }
    return AudioStudioModule as unknown as AudioRecorder;
  }

  /**
   * Append incoming PCM samples to the rolling accumulator and emit
   * overlapping mel frames (400-sample window, 160-sample hop).
   */
  private _processBuffer(incoming: Float32Array): void {
    const prev = this.sampleAccumulator;
    const combined = new Float32Array(prev.length + incoming.length);
    combined.set(prev);
    combined.set(incoming, prev.length);

    let offset = 0;
    while (offset + WINDOW_SIZE_SAMPLES <= combined.length) {
      const frameSamples = combined.subarray(offset, offset + WINDOW_SIZE_SAMPLES);
      this._emitFrame(frameSamples);
      offset += HOP_SIZE_SAMPLES;
    }

    this.sampleAccumulator = combined.slice(offset);
  }

  private _emitFrame(samples: Float32Array): void {
    const timestampMs = Date.now() - this.sessionStartMs;
    const coefficients = this.mel.compute(samples);
    const energy = frameLogEnergy(samples);
    const frame: MelFrame = { timestampMs, coefficients, energy };

    this.available = true;
    this.lastUpdatedMs = Date.now();
    this.currentSnr = Math.max(0, energy - NOISE_FLOOR_DBFS);
    this.chunker.push(frame);
    this.frameListeners.forEach((cb) => cb(frame));
  }

  private startWatchdog(): void {
    this.stopWatchdog();
    this.staleWatchdog = setInterval(() => {
      if (!this.recordingActive || this.paused) return;
      if (this.lastUpdatedMs === 0) return;
      if (Date.now() - this.lastUpdatedMs > AUDIO_STALE_TIMEOUT_MS) {
        this.available = false;
      }
    }, 500);
  }

  private stopWatchdog(): void {
    if (this.staleWatchdog) {
      clearInterval(this.staleWatchdog);
      this.staleWatchdog = null;
    }
  }
}
