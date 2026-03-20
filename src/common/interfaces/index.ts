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
  AudioFeatureChunk,
  DeviceInfo,
  DeviceKind,
  LandmarkFrame,
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
// sozia.client.pipeline.video — Video Pipeline
// ---------------------------------------------------------------------------

/** Callback invoked each time the video pipeline produces a landmark frame. */
export type LandmarkFrameCallback = (frame: LandmarkFrame) => void;

/**
 * Captures video from the active camera, runs MediaPipe landmark extraction,
 * and emits LandmarkFrame objects.
 * Implemented by: src/pipeline/video/
 *
 * Follows the same lifecycle pattern as IAudioPipeline:
 *   start() → (running: emitting LandmarkFrames)
 *           → pause() → resume() → stop()
 */
export interface IVideoPipeline {
  /**
   * Begin camera capture and landmark extraction for the given session.
   * Resolves once the pipeline is ready to emit frames.
   * Rejects if camera permission is denied or the device is unavailable.
   */
  start(sessionId: string): Promise<void>;

  /** Suspend frame emission without releasing the camera. */
  pause(): void;

  /** Resume frame emission after a pause. */
  resume(): void;

  /** Stop capture and release the camera. Safe to call from any state. */
  stop(): void;

  /**
   * Returns a snapshot of the current video pipeline health for upstream reporting.
   */
  getHealth(): PipelineHealth;

  /**
   * Register a callback to receive landmark frames as they are extracted.
   * Returns an unsubscribe function.
   */
  onFrame(callback: LandmarkFrameCallback): () => void;
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
 */
export interface ITransmissionManager {
  connect(serverUrl: string): Promise<void>;
  disconnect(): Promise<void>;

  /** Send an audio feature chunk to the server for inference. */
  sendAudioFeatures(chunk: AudioFeatureChunk): void;

  /** Send a video landmark frame to the server for inference. */
  sendLandmarkFrame(frame: LandmarkFrame): void;

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

  startSession(path: ModalityPath): Promise<void>;
  pauseSession(): void;
  resumeSession(): void;
  stopSession(): void;
  getState(): SessionState;
}
