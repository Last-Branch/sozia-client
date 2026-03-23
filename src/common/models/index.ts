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
 * A batch of audio feature vectors ready for transmission to the inference server.
 * Produced by AudioChunker from raw MFCCFrames; sent over WebSocket by TransmissionManager.
 *
 * Privacy note: contains only anonymized numerical feature data — no raw audio.
 */
export interface AudioFeatureChunk {
  /** UUID v4 of the active session. */
  sessionId: string;
  /** Milliseconds since session start; taken from the first frame in the batch. */
  timestampMs: number;
  /**
   * Array of feature vectors — one per captured frame.
   * For 'mfcc': each inner array has 13 coefficients.
   */
  features: number[][];
  /** Identifies the feature extraction method. */
  featureType: 'mfcc' | 'landmarks';
  /** Sample rate of the underlying audio signal in Hz. */
  sampleRateHz: number;
  /** Wall-clock duration covered by this chunk in milliseconds. */
  chunkDurationMs: number;
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

