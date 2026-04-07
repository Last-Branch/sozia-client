/**
 * Represents a single enumerated hardware input device (microphone or camera).
 *
 * Source: Sozia Low-Level Design, Section 3.3 (sozia.client.device).
 */
export interface DeviceHandle {
  /** Platform-specific unique identifier for the device. */
  deviceId: string;
  /** Human-readable device name (may be empty before permissions are granted). */
  label: string;
  /** Indicates whether this is an audio input or video input device. */
  kind: 'audioinput' | 'videoinput';
  /** True if this is the system default for its kind. */
  isDefault: boolean;
}
