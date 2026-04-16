/**
 * @jest-environment node
 */
/**
 * Unit tests — FeatureSerializer
 *
 * Verifies that all three payload types are serialized to JSON strings
 * with the correct type discriminator and all fields preserved.
 *
 * Test plan reference: TP-CLIENT-TX-001
 */

import { FeatureSerializer } from '@/transmission/FeatureSerializer';
import { ModalityPath } from '@common/models';
import type { LandmarkFrame, AudioFeatureChunk, PipelineHealth } from '@common/models';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLandmarkFrame(): LandmarkFrame {
  return {
    sessionId: 'session-1',
    timestampMs: 1000,
    faceLandmarks: [[0.1, 0.2, 0.3]],
    leftHandLandmarks: null,
    rightHandLandmarks: [[0.4, 0.5, 0.6]],
    poseLandmarks: null,
  };
}

function makeAudioChunk(): AudioFeatureChunk {
  return {
    sessionId: 'session-1',
    timestampMs: 2000,
    features: [[1, 2, 3], [4, 5, 6]],
    featureType: 'mfcc',
    sampleRateHz: 16000,
    chunkDurationMs: 500,
  };
}

function makePipelineHealth(): PipelineHealth {
  return {
    sessionId: 'session-1',
    pipeline: 'audio',
    available: true,
    fps: null,
    snr: 30,
    faceDetected: null,
    lastUpdatedMs: 1000,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FeatureSerializer', () => {
  let serializer: FeatureSerializer;

  beforeEach(() => {
    serializer = new FeatureSerializer();
  });

  // -- serialize() -----------------------------------------------------------

  describe('serialize()', () => {
    it('produces valid JSON for a LandmarkFrame', () => {
      expect(() => JSON.parse(serializer.serialize(makeLandmarkFrame()))).not.toThrow();
    });

    it('produces valid JSON for an AudioFeatureChunk', () => {
      expect(() => JSON.parse(serializer.serialize(makeAudioChunk()))).not.toThrow();
    });

    it('produces valid JSON for a PipelineHealth', () => {
      expect(() => JSON.parse(serializer.serialize(makePipelineHealth()))).not.toThrow();
    });

    it('adds type discriminator "landmark_frame" for LandmarkFrame', () => {
      const result = JSON.parse(serializer.serialize(makeLandmarkFrame()));
      expect(result.type).toBe('landmark_frame');
    });

    it('adds type discriminator "audio_feature_chunk" for AudioFeatureChunk', () => {
      const result = JSON.parse(serializer.serialize(makeAudioChunk()));
      expect(result.type).toBe('audio_feature_chunk');
    });

    it('adds type discriminator "pipeline_health" for PipelineHealth', () => {
      const result = JSON.parse(serializer.serialize(makePipelineHealth()));
      expect(result.type).toBe('pipeline_health');
    });

    it('preserves all LandmarkFrame fields as snake_case', () => {
      const frame = makeLandmarkFrame();
      const result = JSON.parse(serializer.serialize(frame));
      expect(result.session_id).toBe(frame.sessionId);
      expect(result.timestamp_ms).toBe(frame.timestampMs);
      expect(result.face_landmarks).toEqual(frame.faceLandmarks);
      expect(result.left_hand_landmarks).toBeNull();
      expect(result.right_hand_landmarks).toEqual(frame.rightHandLandmarks);
      expect(result.pose_landmarks).toBeNull();
    });

    it('preserves all AudioFeatureChunk fields as snake_case', () => {
      const chunk = makeAudioChunk();
      const result = JSON.parse(serializer.serialize(chunk));
      expect(result.session_id).toBe(chunk.sessionId);
      expect(result.timestamp_ms).toBe(chunk.timestampMs);
      expect(result.features).toEqual(chunk.features);
      expect(result.feature_type).toBe(chunk.featureType);
      expect(result.sample_rate_hz).toBe(chunk.sampleRateHz);
      expect(result.chunk_duration_ms).toBe(chunk.chunkDurationMs);
    });

    it('preserves all PipelineHealth fields as snake_case', () => {
      const health = makePipelineHealth();
      const result = JSON.parse(serializer.serialize(health));
      expect(result.session_id).toBe(health.sessionId);
      expect(result.pipeline).toBe(health.pipeline);
      expect(result.available).toBe(health.available);
      expect(result.fps).toBeNull();
      expect(result.snr).toBe(health.snr);
      expect(result.face_detected).toBeNull();
      expect(result.last_updated_ms).toBe(health.lastUpdatedMs);
    });

    it('correctly identifies PipelineHealth over LandmarkFrame when faceLandmarks is absent', () => {
      const health = makePipelineHealth();
      const result = JSON.parse(serializer.serialize(health));
      expect(result.type).toBe('pipeline_health');
    });
  });

  // -- sessionInit() ---------------------------------------------------------

  describe('sessionInit()', () => {
    it('produces type "session_init"', () => {
      const result = JSON.parse(serializer.sessionInit('session-1', ModalityPath.SPEECH, ''));
      expect(result.type).toBe('session_init');
    });

    it('includes session_id', () => {
      const result = JSON.parse(serializer.sessionInit('session-abc', ModalityPath.SPEECH, ''));
      expect(result.session_id).toBe('session-abc');
    });

    it('includes modality_path for SPEECH', () => {
      const result = JSON.parse(serializer.sessionInit('s', ModalityPath.SPEECH, ''));
      expect(result.modality_path).toBe(ModalityPath.SPEECH);
    });

    it('includes modality_path for SIGN', () => {
      const result = JSON.parse(serializer.sessionInit('s', ModalityPath.SIGN, ''));
      expect(result.modality_path).toBe(ModalityPath.SIGN);
    });

    it('includes api_key in the payload', () => {
      const result = JSON.parse(serializer.sessionInit('s', ModalityPath.SPEECH, 'my-secret-key'));
      expect(result.api_key).toBe('my-secret-key');
    });

    it('includes api_key as empty string when not set', () => {
      const result = JSON.parse(serializer.sessionInit('s', ModalityPath.SPEECH, ''));
      expect(result.api_key).toBe('');
    });
  });

  // -- sessionEnd() ----------------------------------------------------------

  describe('sessionEnd()', () => {
    it('produces type "session_end"', () => {
      const result = JSON.parse(serializer.sessionEnd('session-1'));
      expect(result.type).toBe('session_end');
    });

    it('includes session_id', () => {
      const result = JSON.parse(serializer.sessionEnd('session-xyz'));
      expect(result.session_id).toBe('session-xyz');
    });
  });
});
