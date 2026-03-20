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

/**
 * Persisted application configuration. Loaded at app start; changes are
 * written to local storage immediately.
 * See LLD Section 3.2.7 — Configuration.
 */
export interface AppConfig {
  /** User-selected microphone device ID, or null if not yet chosen. */
  selectedMicId: string | null;
  /** User-selected camera device ID, or null if not yet chosen. */
  selectedCameraId: string | null;
  /** Default modality path used when starting a new session. */
  defaultPath: ModalityPath;
  /** Transcript display font size in pixels. */
  fontSize: number;
  /** Minimum confidence for fusion; results below this are suppressed. */
  confidenceThreshold: number;
  /** Audio chunk duration in milliseconds. */
  chunkDurationMs: number;
  /** WebSocket endpoint URL. */
  serverUrl: string;
  /** Maximum WebSocket reconnection attempts before signalling ERROR. */
  maxReconnectAttempts: number;
  /** Opt-in diagnostic logging. */
  diagnosticsEnabled: boolean;
}

/**
 * Reads and persists application configuration.
 * Leaf package with no upstream dependencies.
 * Implemented by: src/config/
 */
export interface IConfigurationManager {
  /** Read persisted config from local storage. */
  load(): Promise<void>;
  /** Write current config to local storage. */
  save(): Promise<void>;

  /** Type-safe getter for a config value. */
  get<K extends keyof AppConfig>(key: K): AppConfig[K];

  /** Set a value and trigger save. */
  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void;

  /** Restore all values to defaults. */
  reset(): void;
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
