import { normalizeLandmarkFrame } from '@/ui/components/NativeCameraView/helpers';

/** Build a valid raw landmark dict matching LandmarkFrame shape */
const makeValidRaw = (overrides: Record<string, unknown> = {}): unknown => ({
  sessionId: 'sess-1',
  timestampMs: 1234,
  faceLandmarks: Array.from({ length: 83 }, (_, i) => [i * 0.01, 0, 0]),
  leftHandLandmarks: Array.from({ length: 21 }, () => [0.1, 0.2, 0.3]),
  rightHandLandmarks: null,
  poseLandmarks: null,
  ...overrides,
});

describe('normalizeLandmarkFrame', () => {
  it('returns null for null input', () => {
    expect(normalizeLandmarkFrame(null)).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(normalizeLandmarkFrame('string')).toBeNull();
    expect(normalizeLandmarkFrame(42)).toBeNull();
    expect(normalizeLandmarkFrame([])).toBeNull();
  });

  it('returns null when faceLandmarks is present but has wrong length (not 83)', () => {
    const raw = makeValidRaw({
      faceLandmarks: Array.from({ length: 50 }, () => [0, 0, 0]),
    });
    expect(normalizeLandmarkFrame(raw)).toBeNull();
  });

  it('returns null when leftHandLandmarks is present but has wrong length (not 21)', () => {
    const raw = makeValidRaw({
      leftHandLandmarks: Array.from({ length: 10 }, () => [0, 0, 0]),
    });
    expect(normalizeLandmarkFrame(raw)).toBeNull();
  });

  it('returns null when rightHandLandmarks is present but has wrong length (not 21)', () => {
    const raw = makeValidRaw({
      rightHandLandmarks: Array.from({ length: 5 }, () => [0, 0, 0]),
    });
    expect(normalizeLandmarkFrame(raw)).toBeNull();
  });

  it('returns null when poseLandmarks is present but has wrong length (not 33)', () => {
    const raw = makeValidRaw({
      poseLandmarks: Array.from({ length: 20 }, () => [0, 0, 0]),
    });
    expect(normalizeLandmarkFrame(raw)).toBeNull();
  });

  it('returns null when all landmark arrays are null (invariant: at least one must be non-null)', () => {
    const raw = makeValidRaw({
      faceLandmarks: null,
      leftHandLandmarks: null,
      rightHandLandmarks: null,
      poseLandmarks: null,
    });
    expect(normalizeLandmarkFrame(raw)).toBeNull();
  });

  it('returns a valid LandmarkFrame for correct input with only face landmarks', () => {
    const raw = makeValidRaw({
      leftHandLandmarks: null,
    });
    const result = normalizeLandmarkFrame(raw);
    expect(result).not.toBeNull();
    expect(result!.sessionId).toBe('sess-1');
    expect(result!.timestampMs).toBe(1234);
    expect(result!.faceLandmarks).toHaveLength(83);
    expect(result!.leftHandLandmarks).toBeNull();
    expect(result!.rightHandLandmarks).toBeNull();
    expect(result!.poseLandmarks).toBeNull();
  });

  it('returns a valid LandmarkFrame with all non-null arrays', () => {
    const raw = makeValidRaw({
      rightHandLandmarks: Array.from({ length: 21 }, () => [0.5, 0.5, 0]),
      poseLandmarks: Array.from({ length: 33 }, () => [0.1, 0.2, 0.3]),
    });
    const result = normalizeLandmarkFrame(raw);
    expect(result).not.toBeNull();
    expect(result!.rightHandLandmarks).toHaveLength(21);
    expect(result!.poseLandmarks).toHaveLength(33);
  });

  it('accepts a frame with only pose landmarks (no face/hands)', () => {
    const raw = makeValidRaw({
      faceLandmarks: null,
      leftHandLandmarks: null,
      rightHandLandmarks: null,
      poseLandmarks: Array.from({ length: 33 }, () => [0, 0, 0]),
    });
    const result = normalizeLandmarkFrame(raw);
    expect(result).not.toBeNull();
    expect(result!.poseLandmarks).toHaveLength(33);
  });

  it('returns null when sessionId is missing', () => {
    const raw = makeValidRaw({ sessionId: undefined });
    expect(normalizeLandmarkFrame(raw)).toBeNull();
  });

  it('returns null when timestampMs is missing', () => {
    const raw = makeValidRaw({ timestampMs: undefined });
    expect(normalizeLandmarkFrame(raw)).toBeNull();
  });
});
