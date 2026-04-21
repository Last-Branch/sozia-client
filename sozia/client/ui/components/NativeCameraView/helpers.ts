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

  const faceMeanVisibility = readOptionalFaceMeanVisibility(obj['faceMeanVisibility']);
  const leftHandVisibilityMean = readOptionalFaceMeanVisibility(obj['leftHandVisibilityMean']);
  const rightHandVisibilityMean = readOptionalFaceMeanVisibility(obj['rightHandVisibilityMean']);
  const poseVisibilityMean = readOptionalFaceMeanVisibility(obj['poseVisibilityMean']);

  return {
    sessionId: obj['sessionId'] as string,
    timestampMs: obj['timestampMs'] as number,
    ...(faceMeanVisibility !== undefined ? { faceMeanVisibility } : {}),
    ...(leftHandVisibilityMean !== undefined ? { leftHandVisibilityMean } : {}),
    ...(rightHandVisibilityMean !== undefined ? { rightHandVisibilityMean } : {}),
    ...(poseVisibilityMean !== undefined ? { poseVisibilityMean } : {}),
    faceLandmarks,
    leftHandLandmarks,
    rightHandLandmarks,
    poseLandmarks,
  };
}

/** Undefined if absent or invalid; null if JSON null; otherwise [0, 1]. */
function readOptionalFaceMeanVisibility(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) return undefined;
  return value;
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
