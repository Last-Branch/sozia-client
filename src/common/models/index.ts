/**
 * Shared models for Sozia client/server wire compatibility.
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

export interface PipelineHealth {
  sessionId: string;
  pipeline: 'audio' | 'video';
  available: boolean;
  fps: number | null;
  snr: number | null;
  faceDetected: boolean | null;
  lastUpdatedMs: number;
}

export interface LandmarkFrame {
  sessionId: string;
  timestampMs: number;
  faceLandmarks: [number, number, number][] | null;
  leftHandLandmarks: [number, number, number][] | null;
  rightHandLandmarks: [number, number, number][] | null;
  poseLandmarks: [number, number, number][] | null;
}

export interface AudioFeatureChunk {
  sessionId: string;
  timestampMs: number;
  features: number[][];
  featureType: 'mfcc' | 'mel_spectrogram';
  sampleRateHz: number;
  chunkDurationMs: number;
}

export interface ModalityResult {
  modalityType: ModalityType;
  text: string;
  confidence: number;
  timestampMs: number;
  durationMs: number;
  inferenceLatencyMs: number;
}

export interface TranscriptSegment {
  segmentId: string;
  sessionId: string;
  status: SegmentStatus;
  text: string;
  source: ModalityType;
  confidence: number;
  timestampMs: number;
  durationMs: number;
  createdAtMs: number;
  replacesSegmentId: string | null;
}
