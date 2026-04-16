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
      return JSON.stringify({ type: 'audio_feature_chunk', ...payload });
    }
    if (isLandmarkFrame(payload)) {
      return JSON.stringify({ type: 'landmark_frame', ...payload });
    }
    return JSON.stringify({ type: 'pipeline_health', ...payload });
  }

  sessionInit(sessionId: string, activePath: ModalityPath, apiKey: string): string {
    return JSON.stringify({ type: 'session_init', sessionId, activePath, api_key: apiKey });
  }

  sessionEnd(sessionId: string): string {
    return JSON.stringify({ type: 'session_end', sessionId });
  }
}
