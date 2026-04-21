/**
 * Shared models for Sozia client/server wire compatibility.
 * Each DTO documents field name, type, unit, and invariant per LLD §1.2.5.
 */

export enum SessionState {
  IDLE = 'IDLE',
  INITIALIZING = 'INITIALIZING',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  DEGRADED = 'DEGRADED',
  ERROR = 'ERROR',
}

export enum ModalityPath {
  SPEECH = 'SPEECH',
  SIGN = 'SIGN',
}

export enum ModalityType {
  ASR = 'ASR',
  LIP_READING = 'LIP_READING',
  TSL_RECOGNITION = 'TSL_RECOGNITION',
  GLOSS_TO_TEXT = 'GLOSS_TO_TEXT',
}

export enum SegmentStatus {
  PARTIAL = 'PARTIAL',
  FINAL = 'FINAL',
}

/** Real-time health of a client-side pipeline (LLD §3.1.2). */
export interface PipelineHealth {
  /** UUID v4. Non-empty. */
  sessionId: string;
  /** Which pipeline this report describes. */
  pipeline: 'audio' | 'video';
  /** false if the pipeline cannot produce features (device lost, permission denied, etc.). */
  available: boolean;
  /** Frames per second. Video pipeline only; null for audio. */
  fps: number | null;
  /** Signal-to-noise ratio in dB. Audio pipeline only; null for video. */
  snr: number | null;
  /** Whether a face is currently detected. Video pipeline only; null for audio. */
  faceDetected: boolean | null;
  /**
   * Video only: rolling fraction of recent samples (same window as `available`)
   * where `faceLandmarks` was non-null. null if no samples yet. Client-only for
   * SPEECH lip UX; not sent on the wire.
   */
  faceFrameRatio?: number | null;
  /**
   * Video, SIGN: true when (any detected hand below `SIGN_HAND_VISIBILITY_MIN`) or (pose below
   * `SIGN_POSE_VISIBILITY_MIN`) or (pose tracked but neither hand detected), continuously
   * for ≥ `SIGN_VISIBILITY_LOW_MIN_MS`. Client-only; not on wire.
   */
  signVisibilitySustainedLow?: boolean;
  /**
   * Video, SIGN: i18n keys for degraded copy (hands-only, upper-body-only, or combined general).
   * Set when sustained. Client-only; not on wire.
   */
  signVisibilityMessageKeys?: string[] | null;
  /** Milliseconds since session start. ≥ 0. */
  lastUpdatedMs: number;
}

/** Single timestamped frame of body landmarks (LLD §3.1.2). */
export interface LandmarkFrame {
  /** UUID v4. Non-empty. */
  sessionId: string;
  /** Milliseconds since session start. ≥ 0, monotonically increasing within a session. */
  timestampMs: number;
  /**
   * [0, 1] face framing / confidence proxy over the 83-point subset (mean per landmark).
   * Web: MediaPipe Face Landmarker usually leaves `visibility` at 0, so we use that when
   * non-zero; otherwise a geometric score from normalized x/y (in-frame vs clipped edges).
   * Missing mesh indices count as 0. null when no face mesh was detected this frame.
   * Client-only: not serialized to the server (`FeatureSerializer` strips it).
   */
  faceMeanVisibility?: number | null;
  /** 83 linguistically-relevant face points, each [x, y, z] normalised to [0.0, 1.0]. null if not detected. */
  faceLandmarks: number[][] | null;
  /** 21 points, each [x, y, z]. null if not detected. */
  leftHandLandmarks: number[][] | null;
  /** 21 points, each [x, y, z]. null if not detected. */
  rightHandLandmarks: number[][] | null;
  /** 33 points, each [x, y, z]. null if not detected. */
  poseLandmarks: number[][] | null;
  /**
   * Mean visibility-style score [0,1] for hands this tick (web: MediaPipe visibility or
   * geometric framing). Client-only; not serialized to server.
   */
  leftHandVisibilityMean?: number | null;
  rightHandVisibilityMean?: number | null;
  /**
   * Mean visibility-style score for pose (web: torso-only subset of MediaPipe Pose,
   * indices 11,12,23,24 shoulders+hips to keep this signal independent from hand visibility).
   * Client-only.
   */
  poseVisibilityMean?: number | null;
}

/** Timestamped chunk of preprocessed audio features (LLD §3.1.2). */
export interface AudioFeatureChunk {
  /** UUID v4. Non-empty. */
  sessionId: string;
  /** Milliseconds since session start. ≥ 0. */
  timestampMs: number;
  /** 2D array [T, D] — T temporal frames, D feature dimensions. T ≥ 1, D ≥ 1. */
  features: number[][];
  /** Must match the server's expected input format. */
  featureType: 'mel_spectrogram';
  /** Positive integer in Hertz (e.g., 16 000). */
  sampleRateHz: number;
  /** Duration in milliseconds. > 0; typical 500–2 000 ms. */
  chunkDurationMs: number;
}

/** Configuration payload for loading a concrete model implementation (LLD UML DTO). */
export interface ModelConfig {
  /** Stable identifier such as `whisper-small-tr` or `gemma-9b-gloss-tr`. */
  model_id: string;
  /** Filesystem or remote path to the model weights/artifact. */
  weights_path: string;
  /** Compute device. Server validation constrains this to values such as `cpu` or `cuda`. */
  device: string;
  /** Engine-specific parameters mirrored from the server-side dataclass. */
  params: Record<string, unknown>;
}

/** Output of a single inference engine (LLD §3.1.2). Server-side, consumed by FusionOrchestrator. */
export interface ModalityResult {
  modalityType: ModalityType;
  /** UTF-8. May be empty if inference produced no output (e.g., silence). */
  text: string;
  /** [0.0, 1.0]. 0.0 = no confidence; 1.0 = maximum. */
  confidence: number;
  /** Milliseconds since session start. Corresponds to the input feature's timestamp. */
  timestampMs: number;
  /** Duration in milliseconds of the segment this result covers. */
  durationMs: number;
  /** Wall-clock inference time in milliseconds. Used for latency budget monitoring. */
  inferenceLatencyMs: number;
}

/** Server→client lifecycle notification (DEV-01). */
export interface SessionStatusMessage {
  /** UUID v4. Matches the active session. */
  session_id: string;
  /** Current state reported by the server. */
  state: SessionState;
  /** Human-readable description (e.g. warm-up progress, auth rejection). */
  message: string;
}

/** Server→client error notification (DEV-01). Codes 4001–4004. */
export interface ErrorMessage {
  /** UUID v4. Matches the active session. */
  session_id: string;
  /** Numeric error code (4001–4004). */
  code: number;
  /** Human-readable error description. */
  message: string;
}

/**
 * 83 linguistically-relevant face landmark indices from the full 478-point
 * MediaPipe Face Mesh. Mirrors tsl_recognition/config.py FACE_LANDMARK_INDICES.
 * Shared by web and native backends so both filter identically.
 */
export const FACE_LANDMARK_INDICES: readonly number[] = [
  0, 1, 4, 5, 13, 14, 17, 33, 37, 39, 40, 46, 52, 53, 55, 61, 65,
  78, 80, 81, 82, 84, 87, 88, 91, 95, 133, 144, 145, 146, 152, 157,
  158, 159, 160, 175, 178, 181, 185, 191, 199, 200, 263, 267, 269,
  270, 276, 282, 283, 285, 291, 295, 308, 310, 311, 312, 314, 317,
  318, 321, 324, 362, 373, 374, 375, 384, 385, 386, 387, 402, 405,
  409, 415, 468, 469, 470, 471, 472, 473, 474, 475, 476, 477,
];

/** Time-aligned transcript text with metadata (LLD §3.1.2). */
export interface TranscriptSegment {
  /** UUID v4. Globally unique. */
  segmentId: string;
  /** UUID v4. Matches the active session. */
  sessionId: string;
  /** A FINAL segment is never revised. */
  status: SegmentStatus;
  /** Display-ready UTF-8 text. For PARTIAL sign segments this is raw gloss; for FINAL it is natural-language Turkish. */
  text: string;
  /** The primary modality that produced this text. */
  source: ModalityType;
  /** [0.0, 1.0]. Fused confidence score. */
  confidence: number;
  /** Milliseconds since session start. Position in the subtitle timeline. */
  timestampMs: number;
  /** Duration in milliseconds. */
  durationMs: number;
  /** Unix epoch milliseconds. Server-assigned creation time. */
  createdAtMs: number;
  /** UUID v4 of the segment this one replaces, or null. */
  replacesSegmentId: string | null;
}
