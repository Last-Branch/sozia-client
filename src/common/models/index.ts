/**
 * Shared models for Sozia client/server wire compatibility.
 *
 * Source: Sozia Low-Level Design (LLD), Section 3.1 (sozia.common).
 * Note: This module must remain free of runtime logic.
 */

/**
 * Represents the lifecycle state of a transcription session, driven by SessionController
 * (client) and observed by the UI.
 */
export enum SessionState {
  /** Application is running; no active session. */
  IDLE = 'IDLE',
  /**
   * User has pressed Start. System is warming up models, allocating resources, and
   * establishing the WebSocket connection.
   */
  INITIALIZING = 'INITIALIZING',
  /** Active session. Feature streams are flowing; transcript segments are being produced. */
  RUNNING = 'RUNNING',
  /**
   * User has paused the session. Capture and inference are suspended; the WebSocket
   * connection remains open.
   */
  PAUSED = 'PAUSED',
  /**
   * One modality within the active path is unavailable; the system continues with the
   * remaining modality.
   */
  DEGRADED = 'DEGRADED',
  /** Unrecoverable failure; user is prompted to restart. */
  ERROR = 'ERROR',
}

/**
 * Identifies which inference pipeline path is active for the session.
 * The system is modal-exclusive — only one path is active at a time.
 */
export enum ModalityPath {
  /** ASR (Whisper) + Lip-Reading */
  SPEECH = 'SPEECH',
  /** TSL Recognition + Gloss-to-Text (LLM) */
  SIGN = 'SIGN',
}

/**
 * Identifies the specific inference modality that produced a result.
 * Used for source labelling in transcript segments and for fusion logic.
 */
export enum ModalityType {
  /** Automatic Speech Recognition (Whisper or equivalent). */
  ASR = 'ASR',
  /** Visual speech recognition from lip landmarks. */
  LIP_READING = 'LIP_READING',
  /** Turkish Sign Language gesture classification (outputs gloss). */
  TSL_RECOGNITION = 'TSL_RECOGNITION',
  /** LLM-based conversion of gloss sequence to natural-language Turkish. */
  GLOSS_TO_TEXT = 'GLOSS_TO_TEXT',
}

/** Indicates whether a transcript segment is tentative (may be revised) or finalised. */
export enum SegmentStatus {
  /** Preliminary result; may be replaced by a FINAL segment. */
  PARTIAL = 'PARTIAL',
  /** Fused / post-processed result; will not be revised further. */
  FINAL = 'FINAL',
}

/** Classifies a hardware device available on the user's device. */
export enum DeviceKind {
  MICROPHONE = 'MICROPHONE',
  CAMERA = 'CAMERA',
}

/** Describes a single input device discovered by the DeviceManager. */
export interface DeviceInfo {
  /** Platform-specific opaque identifier (e.g., MediaDevices deviceId). */
  id: string;
  /** Human-readable label provided by the OS (may be empty). */
  label: string;
  kind: DeviceKind;
}

/**
 * A single frame of MediaPipe landmark data produced by the video pipeline.
 * Only numerical coordinates are transmitted — no raw pixels cross the network.
 */
export interface LandmarkFrame {
  sessionId: string;
  /** Zero-based frame counter within the session. */
  frameIndex: number;
  /**
   * 478 facial landmarks from MediaPipe Face Mesh.
   * Each landmark is [x, y, z] normalised to [0, 1]. Null when face is not detected.
   */
  faceLandmarks: [number, number, number][] | null;
  /** 21 left-hand landmarks. Null when left hand is not detected. */
  leftHandLandmarks: [number, number, number][] | null;
  /** 21 right-hand landmarks. Null when right hand is not detected. */
  rightHandLandmarks: [number, number, number][] | null;
  /** 33 pose landmarks. Null when pose is not detected. */
  poseLandmarks: [number, number, number][] | null;
  /** Milliseconds since session start. */
  timestampMs: number;
}

/**
 * A timestamped chunk of preprocessed audio features (MFCC or Mel-spectrogram).
 * Transmitted upstream to the server. Never contains raw PCM audio.
 *
 * Wire format: JSON. Field names must match the Python mirror in sozia-server exactly.
 * See LLD Section 3.1.2 — AudioFeatureChunk.
 */
export interface AudioFeatureChunk {
  /** UUID v4 of the active session. */
  sessionId: string;
  /** Milliseconds since session start (>= 0). */
  timestampMs: number;
  /** 2D array of shape [T, D] — T temporal frames, D feature dimensions. T >= 1, D >= 1. */
  features: number[][];
  /** Which feature representation this chunk contains. Must match the server's expected input. */
  featureType: 'mfcc' | 'mel_spectrogram';
  /** Audio sample rate in Hertz. Positive integer (e.g., 16 000). */
  sampleRateHz: number;
  /** Duration of this chunk in milliseconds (> 0; typical values 500–2 000 ms). */
  chunkDurationMs: number;
}

/**
 * The output of a single inference engine. Produced server-side and consumed by
 * FusionOrchestrator. Not sent directly to the client — the fusion layer wraps
 * it into a TranscriptSegment first.
 *
 * Wire format: JSON. Field names must match the Python mirror exactly.
 * See LLD Section 3.1.2 — ModalityResult.
 */
export interface ModalityResult {
  /** The inference modality that produced this result. */
  modalityType: ModalityType;
  /** Raw text hypothesis produced by the inference engine. May be empty for silence. */
  text: string;
  /** Engine-reported confidence in [0.0, 1.0]. */
  confidence: number;
  /** Milliseconds since session start. Corresponds to the input feature's timestamp. */
  timestampMs: number;
  /** Duration of the segment this result covers, in milliseconds. */
  durationMs: number;
  /** Wall-clock time the engine took to produce this result. Used for latency budget monitoring. */
  inferenceLatencyMs: number;
}

/**
 * Reports the real-time health of a client-side pipeline.
 * Sent upstream periodically so the server can apply degraded-mode logic.
 */
export interface PipelineHealth {
  /** UUID v4 of the active session (non-empty). */
  sessionId: string;
  /** Which pipeline the report describes. */
  pipeline: 'audio' | 'video';
  /**
   * False if the pipeline cannot produce features (device lost, permission denied, etc.).
   */
  available: boolean;
  /** Frames per second (video only). Null for audio. */
  fps: number | null;
  /** Signal-to-noise ratio in dB (audio only). Null for video. */
  snr: number | null;
  /** Whether a face is detected (video only). Null for audio. */
  faceDetected: boolean | null;
  /** Milliseconds since session start (>= 0). */
  lastUpdatedMs: number;
}

/**
 * The primary output of the system — a time-aligned piece of transcript text with metadata.
 * Produced by the server, streamed to the client, stored locally, and rendered by the UI.
 */
export interface TranscriptSegment {
  /** Globally unique UUID v4. */
  segmentId: string;
  /** UUID v4; must match the active session. */
  sessionId: string;
  /** PARTIAL segments may be revised; FINAL segments are never revised. */
  status: SegmentStatus;
  /**
   * Display-ready text.
   * - For PARTIAL sign segments: raw gloss (e.g., "MERHABA DÜNYA")
   * - For FINAL segments: natural-language Turkish.
   */
  text: string;
  /** Primary modality that produced this text. */
  source: ModalityType;
  /** Fused confidence score in [0.0, 1.0]. */
  confidence: number;
  /** Position in subtitle timeline; milliseconds since session start. */
  timestampMs: number;
  /** Duration spanned by this segment in milliseconds. */
  durationMs: number;
  /** Wall-clock creation time on the server; Unix epoch milliseconds. */
  createdAtMs: number;
  /**
   * If non-null, this segment revises the segment with the given ID.
   * Client-side stores must replace the referenced PARTIAL segment when possible.
   */
  replacesSegmentId: string | null;
}

