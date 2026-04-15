/**
 * Coordinates device selection, permission requests, and pipeline lifecycle.
 *
 * Source: Sozia Low-Level Design, Section 3.3 (sozia.client.device).
 *
 * Dependency rule R5: only sozia.client.pipeline.audio and .video access raw
 * media handles. DeviceManager is the coordination layer that requests
 * permissions and delegates capture to the pipeline instances it holds.
 */

import { requestRecordingPermissionsAsync } from 'expo-audio';
import { Camera as ExpoCamera } from 'expo-camera';
import type { PipelineHealth } from '@common/models';
import type { IAudioPipeline, RawAudioHandle, SensitivityLevel } from '@/pipeline/audio';
import type { IVideoPipeline, RawMediaHandle } from '@/pipeline/video';
import type { TransmissionManager } from '@/transmission/TransmissionManager';
import type { IDeviceEnumerator } from './DeviceEnumerator';
import type { DeviceHandle } from './DeviceHandle';

export class DeviceManager {
  private enumerator: IDeviceEnumerator;
  private audioPipeline: IAudioPipeline | null;
  private videoPipeline: IVideoPipeline | null;

  private selectedMicId: string | null = null;
  private selectedCameraId: string | null = null;
  private micAvailable = false;
  private cameraAvailable = false;

  constructor(
    enumerator: IDeviceEnumerator,
    audioPipeline: IAudioPipeline | null = null,
    videoPipeline: IVideoPipeline | null = null,
  ) {
    this.enumerator = enumerator;
    this.audioPipeline = audioPipeline;
    this.videoPipeline = videoPipeline;
  }

  /** Returns all enumerated input devices from the underlying enumerator. */
  enumerateDevices(): Promise<DeviceHandle[]> {
    return this.enumerator.list();
  }

  /** Records the user's microphone selection. Does not request permission. */
  selectMicrophone(id: string): void {
    this.selectedMicId = id;
  }

  /** Records the user's camera selection. Does not request permission. */
  selectCamera(id: string): void {
    this.selectedCameraId = id;
  }

  /**
   * Requests microphone permission from the OS.
   * Sets `isMicrophoneAvailable()` to true on success.
   * Throws with an actionable message if permission is denied.
   */
  async activateMicrophone(): Promise<void> {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      this.micAvailable = false;
      throw new Error(
        'Microphone permission denied. Grant microphone access in device settings to use speech recognition.'
      );
    }
    this.micAvailable = true;
  }

  /**
   * Requests camera permission from the OS via expo-camera.
   * Sets `isCameraAvailable()` to true on success.
   * Throws with an actionable message if permission is denied.
   */
  async activateCamera(): Promise<void> {
    const { granted } = await ExpoCamera.requestCameraPermissionsAsync();
    if (!granted) {
      this.cameraAvailable = false;
      throw new Error(
        'Camera permission denied. Grant camera access in device settings to use sign language recognition.'
      );
    }
    this.cameraAvailable = true;
  }

  /**
   * Starts the audio capture pipeline for the given session.
   * Requires `activateMicrophone()` to have been called and granted first.
   *
   * The optional `tx` is forwarded to the pipeline, which pushes assembled
   * AudioFeatureChunks directly to `tx.sendFeatures()`. DeviceManager does
   * not hold the chunks itself (dependency rule R5).
   */
  async startAudioPipeline(
    sessionId: string,
    micHandle?: RawAudioHandle,
    tx?: TransmissionManager,
  ): Promise<void> {
    if (!this.micAvailable) {
      throw new Error('Cannot start audio pipeline: microphone has not been activated.');
    }
    if (!this.audioPipeline) {
      throw new Error('Cannot start audio pipeline: no IAudioPipeline configured.');
    }
    await this.audioPipeline.start(sessionId, micHandle ?? {}, tx);
  }

  /**
   * Starts the video capture pipeline for the given session.
   * Requires `activateCamera()` to have been called first.
   */
  async startVideoPipeline(sessionId: string, cameraHandle?: RawMediaHandle, tx?: TransmissionManager): Promise<void> {
    if (!this.cameraAvailable) {
      throw new Error('Cannot start video pipeline: camera has not been activated.');
    }
    if (!this.videoPipeline) {
      throw new Error('Cannot start video pipeline: no IVideoPipeline configured.');
    }
    this.videoPipeline.start(sessionId, cameraHandle ?? {}, tx);
  }

  /**
   * Pauses all active pipelines. No-op for pipelines that are not running.
   */
  pauseAllPipelines(): void {
    this.audioPipeline?.pause();
    this.videoPipeline?.pause();
  }

  /**
   * Resumes all paused pipelines. No-op for pipelines that are not paused.
   */
  resumeAllPipelines(): void {
    this.audioPipeline?.resume();
    this.videoPipeline?.resume();
  }

  /**
   * Stops all active pipelines and resets availability flags.
   * Safe to call from any state, including when no pipelines are running.
   */
  stopAllPipelines(): void {
    this.audioPipeline?.stop();
    this.videoPipeline?.stop();
    this.micAvailable = false;
    this.cameraAvailable = false;
  }

  /**
   * Applies a VAD sensitivity level to the audio pipeline. No-op when no
   * audio pipeline is configured. Wired by SessionController after
   * Configuration.load() resolves.
   */
  setAudioVadSensitivity(level: SensitivityLevel): void {
    this.audioPipeline?.setVadSensitivity(level);
  }

  /**
   * Returns the current health snapshot of the audio pipeline.
   * Returns a zeroed-out health object if no pipeline is configured.
   */
  getAudioHealth(): PipelineHealth {
    if (!this.audioPipeline) {
      return {
        sessionId: '',
        pipeline: 'audio',
        available: false,
        fps: null,
        snr: null,
        faceDetected: null,
        lastUpdatedMs: 0,
      };
    }
    return this.audioPipeline.getHealth();
  }

  /**
   * Returns the current health snapshot of the video pipeline.
   * Returns a zeroed-out health object if no pipeline is configured.
   */
  getVideoHealth(): PipelineHealth {
    if (!this.videoPipeline) {
      return {
        sessionId: '',
        pipeline: 'video',
        available: false,
        fps: null,
        snr: null,
        faceDetected: null,
        lastUpdatedMs: 0,
      };
    }
    return this.videoPipeline.getHealth();
  }

  /** True if microphone permission was granted and `activateMicrophone()` succeeded. */
  isMicrophoneAvailable(): boolean {
    return this.micAvailable;
  }

  /** True if camera permission was granted and `activateCamera()` succeeded. */
  isCameraAvailable(): boolean {
    return this.cameraAvailable;
  }
}
