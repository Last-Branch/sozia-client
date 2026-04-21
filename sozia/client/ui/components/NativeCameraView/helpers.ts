import type { LandmarkFrame } from '@common/models';

const FACE_COUNT = 83;
const HAND_COUNT = 21;
const POSE_COUNT = 33;

function isNumberArray(value: unknown): value is number[][] {
  return (
    Array.isArray(value) &&
    value.every((row) => Array.isArray(row))
  );
}

/**
 * Extracts the monotonic seq counter from raw plugin output.
 * Returns 0 if the field is absent (e.g., legacy plugin builds).
 */
export function extractSeq(raw: unknown): number {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return 0;
  const seq = (raw as Record<string, unknown>)['seq'];
  return typeof seq === 'number' && seq > 0 ? seq : 0;
}

/**
 * Validates and normalizes raw plugin output into a typed LandmarkFrame.
 *
 * Returns null if the input is malformed, missing required fields, or
 * violates the invariant that at least one landmark array must be non-null.
 */
export function normalizeLandmarkFrame(raw: unknown): LandmarkFrame | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj['sessionId'] !== 'string') return null;
  if (typeof obj['timestampMs'] !== 'number') return null;

  const faceLandmarks = validateLandmarkArray(obj['faceLandmarks'], FACE_COUNT);
  if (faceLandmarks === false) return null;

  const leftHandLandmarks = validateLandmarkArray(obj['leftHandLandmarks'], HAND_COUNT);
  if (leftHandLandmarks === false) return null;

  const rightHandLandmarks = validateLandmarkArray(obj['rightHandLandmarks'], HAND_COUNT);
  if (rightHandLandmarks === false) return null;

  const poseLandmarks = validateLandmarkArray(obj['poseLandmarks'], POSE_COUNT);
  if (poseLandmarks === false) return null;

  if (!faceLandmarks && !leftHandLandmarks && !rightHandLandmarks && !poseLandmarks) {
    return null;
  }

  return {
    sessionId: obj['sessionId'] as string,
    timestampMs: obj['timestampMs'] as number,
    faceLandmarks,
    leftHandLandmarks,
    rightHandLandmarks,
    poseLandmarks,
  };
}

/**
 * Returns null if value is null/undefined, the array if it has the expected length,
 * or false if it is present but malformed.
 */
function validateLandmarkArray(
  value: unknown,
  expectedLength: number,
): number[][] | null | false {
  if (value === null || value === undefined) return null;
  if (!isNumberArray(value)) return false;
  if (value.length !== expectedLength) return false;
  return value;
}
