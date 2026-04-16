import type { LandmarkFrame, AudioFeatureChunk, PipelineHealth, ModalityPath } from '@common/models';

function isAudioFeatureChunk(payload: unknown): payload is AudioFeatureChunk {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'featureType' in payload
  );
}

function isLandmarkFrame(payload: unknown): payload is LandmarkFrame {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'faceLandmarks' in payload
  );
}

/**
 * Serializes outbound client payloads to JSON strings with a `type`
 * discriminator field recognised by the Sozia inference server.
 *
 * Discrimination order:
 *   1. AudioFeatureChunk  — has `featureType`
 *   2. LandmarkFrame      — has `faceLandmarks`
 *   3. PipelineHealth     — everything else (has `available`)
 */
export class FeatureSerializer {
  serialize(payload: LandmarkFrame | AudioFeatureChunk | PipelineHealth): string {
    if (isAudioFeatureChunk(payload)) {
      return JSON.stringify({
        type: 'audio_feature_chunk',
        session_id: payload.sessionId,
        timestamp_ms: payload.timestampMs,
        features: payload.features,
        feature_type: payload.featureType,
        sample_rate_hz: payload.sampleRateHz,
        chunk_duration_ms: payload.chunkDurationMs,
      });
    }
    if (isLandmarkFrame(payload)) {
      return JSON.stringify({
        type: 'landmark_frame',
        session_id: payload.sessionId,
        timestamp_ms: payload.timestampMs,
        face_landmarks: payload.faceLandmarks,
        left_hand_landmarks: payload.leftHandLandmarks,
        right_hand_landmarks: payload.rightHandLandmarks,
        pose_landmarks: payload.poseLandmarks,
      });
    }
    const health = payload as PipelineHealth;
    return JSON.stringify({
      type: 'pipeline_health',
      session_id: health.sessionId,
      pipeline: health.pipeline,
      available: health.available,
      fps: health.fps,
      snr: health.snr,
      face_detected: health.faceDetected,
      last_updated_ms: health.lastUpdatedMs,
    });
  }

  sessionInit(sessionId: string, activePath: ModalityPath, apiKey: string): string {
    return JSON.stringify({ type: 'session_init', session_id: sessionId, modality_path: activePath, api_key: apiKey });
  }

  sessionEnd(sessionId: string): string {
    return JSON.stringify({ type: 'session_end', session_id: sessionId });
  }
}
