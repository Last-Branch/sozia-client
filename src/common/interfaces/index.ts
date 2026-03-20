/**
 * Client-side service contracts for Sozia.
 *
 * Each interface maps to a package defined in the Git Repository Plan (Section 2.3).
 * Implementations live in their respective package directories; this module only
 * defines the behavioural contracts so that packages can depend on abstractions
 * rather than concrete implementations.
 *
 * Note: IAudioPipeline, TranscriptStore, and TranscriptExporter are already
 * implemented as concrete classes in src/pipeline/audio/ and src/store/.
 * This file covers the remaining packages that have no implementation yet.
 */

import {
  DeviceInfo,
  DeviceKind,
  ModalityPath,
  PipelineHealth,
  SessionState,
  TranscriptSegment,
} from '../models';

// ---------------------------------------------------------------------------
// sozia.client.device — Device Manager
// ---------------------------------------------------------------------------

/**
 * Enumerates and manages hardware input devices (cameras and microphones).
 * Implemented by: src/device/
 */
export interface IDeviceManager {
  /** Discover all available input devices of the given kind. */
  enumerateDevices(kind: DeviceKind): Promise<DeviceInfo[]>;

  /**
   * Request OS-level permission for the given device kind.
   * Resolves to true if permission was granted, false otherwise.
   */
  requestPermission(kind: DeviceKind): Promise<boolean>;

  /** Return the currently selected device for the given kind, or null. */
  getActiveDevice(kind: DeviceKind): DeviceInfo | null;

  /** Set the active device. Throws if the device ID is not found. */
  setActiveDevice(kind: DeviceKind, deviceId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// sozia.client.transmission — Transmission Manager
// ---------------------------------------------------------------------------

/** Callback invoked when the server streams a transcript segment to the client. */
export type TranscriptSegmentCallback = (segment: TranscriptSegment) => void;

/** Callback invoked when the WebSocket connection state changes. */
export type ConnectionStateCallback = (connected: boolean) => void;

/**
 * Single bidirectional WebSocket chokepoint between client and server (Rule R4).
 * All cross-tier communication flows through this interface.
 * Implemented by: src/transmission/
 *
 * Note: sendAudioFeatures and sendLandmarkFrame signatures will be added
 * when LandmarkFrame and AudioFeatureChunk DTOs are introduced alongside
 * their respective pipeline implementations.
 */
export interface ITransmissionManager {
  connect(serverUrl: string): Promise<void>;
  disconnect(): Promise<void>;

  /** Send a pipeline health report to the server. */
  sendHealthReport(report: PipelineHealth): void;

  /** Register a listener for incoming transcript segments. */
  onTranscriptSegment(callback: TranscriptSegmentCallback): void;

  /** Register a listener for connection state changes. */
  onConnectionStateChange(callback: ConnectionStateCallback): void;

  readonly isConnected: boolean;
}

// ---------------------------------------------------------------------------
// sozia.client.config — Configuration & Diagnostics
// ---------------------------------------------------------------------------

/** Persisted user preferences. */
export interface AppConfig {
  language: 'TR' | 'EN';
  darkMode: boolean;
  /** Subtitle text size as a percentage (e.g., 80, 100, 130). */
  textSizePercent: number;
  /** Last-selected modality path, or null if never chosen. */
  preferredPath: ModalityPath | null;
}

/**
 * Reads and persists application configuration.
 * Leaf package with no upstream dependencies.
 * Implemented by: src/config/
 */
export interface IConfigurationManager {
  load(): Promise<AppConfig>;
  save(config: AppConfig): Promise<void>;

  /** Return a single config value. */
  get<K extends keyof AppConfig>(key: K): AppConfig[K];

  /** Update a single config value and persist. */
  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): Promise<void>;
}

// ---------------------------------------------------------------------------
// sozia.client.ui — Session Controller (behavioural contract)
// ---------------------------------------------------------------------------

/**
 * Orchestrates the session lifecycle from the UI layer.
 * The concrete implementation already exists in src/ui/SessionController.tsx;
 * this interface captures its public contract for type-safe consumption.
 */
export interface ISessionController {
  readonly sessionId: string | null;
  readonly state: SessionState;
  readonly activePath: ModalityPath | null;

  startSession(path: ModalityPath): void;
  pauseSession(): void;
  resumeSession(): void;
  stopSession(): void;
  getState(): SessionState;
}
