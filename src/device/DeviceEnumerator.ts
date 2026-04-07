/**
 * Device enumeration contract and Expo-compatible concrete implementation.
 *
 * Source: Sozia Low-Level Design, Section 3.3 (sozia.client.device).
 */

import { Platform } from 'react-native';
import type { DeviceHandle } from './DeviceHandle';

/**
 * Abstract contract for enumerating available input devices.
 * Implementations are platform-specific (web vs. native).
 */
export interface IDeviceEnumerator {
  /** Returns all available audio and video input devices. */
  list(): Promise<DeviceHandle[]>;
  /**
   * Registers a callback that fires whenever the set of available devices
   * changes (e.g. a headset is plugged in or removed).
   * On native platforms this is a no-op — device changes are rare and not
   * exposed by expo-av.
   *
   * Returns a cleanup function that removes the listener.
   */
  onDeviceChange(callback: (devices: DeviceHandle[]) => void): () => void;
}

/**
 * Concrete enumerator that works on both web and React Native (Expo) targets.
 *
 * - **Web**: delegates to `navigator.mediaDevices.enumerateDevices()`.
 * - **Native (iOS / Android)**: expo-av does not expose device enumeration;
 *   returns two synthetic default entries so the rest of the system can
 *   operate without branching.
 */
export class ExpoDeviceEnumerator implements IDeviceEnumerator {
  async list(): Promise<DeviceHandle[]> {
    if (Platform.OS === 'web') {
      return this._listWeb();
    }
    return this._listNative();
  }

  onDeviceChange(callback: (devices: DeviceHandle[]) => void): () => void {
    if (Platform.OS !== 'web') return () => {};

    const handler = () => {
      this._listWeb().then(callback).catch(() => {});
    };

    navigator.mediaDevices.addEventListener('devicechange', handler);
    return () => navigator.mediaDevices.removeEventListener('devicechange', handler);
  }

  private async _listWeb(): Promise<DeviceHandle[]> {
    const infos = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = infos.filter((d) => d.kind === 'audioinput');
    const videoInputs = infos.filter((d) => d.kind === 'videoinput');

    const toHandle = (d: MediaDeviceInfo, index: number): DeviceHandle => ({
      deviceId: d.deviceId || `default-${d.kind}-${index}`,
      label: d.label || `${d.kind === 'audioinput' ? 'Microphone' : 'Camera'} ${index + 1}`,
      kind: d.kind as 'audioinput' | 'videoinput',
      isDefault: d.deviceId === 'default' || index === 0,
    });

    return [
      ...audioInputs.map((d, i) => toHandle(d, i)),
      ...videoInputs.map((d, i) => toHandle(d, i)),
    ];
  }

  private _listNative(): DeviceHandle[] {
    return [
      { deviceId: 'default', label: 'Microphone', kind: 'audioinput', isDefault: true },
      { deviceId: 'default', label: 'Camera', kind: 'videoinput', isDefault: true },
    ];
  }
}
