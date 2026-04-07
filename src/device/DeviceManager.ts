/**
 * Coordinates device selection, permission requests, and pipeline lifecycle.
 *
 * Source: Sozia Low-Level Design, Section 3.3 (sozia.client.device).
 *
 * Dependency rule R5: only sozia.client.pipeline.audio and .video access raw
 * media handles. DeviceManager is the coordination layer that requests
 * permissions and delegates capture to the pipeline instances it holds.
 */

import { Audio } from 'expo-av';
import type { IAudioPipeline } from '../pipeline/audio';
import type { IDeviceEnumerator } from './DeviceEnumerator';
import type { DeviceHandle } from './DeviceHandle';

export class DeviceManager {
  private enumerator: IDeviceEnumerator;
  private audioPipeline: IAudioPipeline | null;
  /** IVideoPipeline — not yet implemented; reserved for future video support. */
  private videoPipeline: null = null;

  private selectedMicId: string | null = null;
  private selectedCameraId: string | null = null;
  private micAvailable = false;
  private cameraAvailable = false;

  constructor(enumerator: IDeviceEnumerator, audioPipeline: IAudioPipeline | null = null) {
    this.enumerator = enumerator;
    this.audioPipeline = audioPipeline;
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
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      this.micAvailable = false;
      throw new Error(
        'Microphone permission denied. Grant microphone access in device settings to use speech recognition.'
      );
    }
    this.micAvailable = true;
  }

  /**
   * Camera activation stub — video pipeline is not yet implemented.
   * Resolves without throwing so the rest of the session start flow is unaffected.
   */
  async activateCamera(): Promise<void> {
    // Video pipeline not yet implemented.
    this.cameraAvailable = false;
  }

  /**
   * Starts the audio capture pipeline for the given session.
   * Requires `activateMicrophone()` to have been called and granted first.
   */
  async startAudioPipeline(sessionId: string): Promise<void> {
    if (!this.micAvailable) {
      throw new Error('Cannot start audio pipeline: microphone has not been activated.');
    }
    if (!this.audioPipeline) {
      throw new Error('Cannot start audio pipeline: no IAudioPipeline configured.');
    }
    await this.audioPipeline.start(sessionId);
  }

  /**
   * Video pipeline start stub — not yet implemented.
   * Resolves without throwing.
   */
  async startVideoPipeline(_sessionId: string): Promise<void> {
    // Video pipeline not yet implemented.
  }

  /**
   * Stops all active pipelines and resets availability flags.
   * Safe to call from any state, including when no pipelines are running.
   */
  stopAllPipelines(): void {
    this.audioPipeline?.stop();
    this.micAvailable = false;
    this.cameraAvailable = false;
  }

  /** True if microphone permission was granted and `activateMicrophone()` succeeded. */
  isMicrophoneAvailable(): boolean {
    return this.micAvailable;
  }

  /** True if camera is ready. Always false until the video pipeline is implemented. */
  isCameraAvailable(): boolean {
    return this.cameraAvailable;
  }
}
