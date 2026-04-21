/**
 * Web-only MediaPipe landmark extraction backend.
 *
 * Uses @mediapipe/tasks-vision (Google's official JS SDK) to run
 * FaceLandmarker, HandLandmarker, and PoseLandmarker in the browser
 * via WASM. Models are loaded from Google's CDN on first use.
 *
 * This backend implements LandmarkExtractionBackend and is swappable
 * with NullLandmarkBackend or a future native backend.
 */

import {
  FaceLandmarker,
  HandLandmarker,
  PoseLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
  type HandLandmarkerResult,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision';

import type { LandmarkFrame } from '@common/models';
import { FACE_LANDMARK_INDICES } from '@common/models';
import type { LandmarkExtractionBackend, RawVideoFrame } from './LandmarkExtractor';

const VISION_WASM_CDN =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';

const MODEL_URLS = {
  face: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
  hand: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task',
  pose: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task',
};


type ImageSource = HTMLVideoElement | HTMLCanvasElement | HTMLImageElement;

function toImageSource(data: unknown): ImageSource | null {
  if (
    data instanceof HTMLVideoElement ||
    data instanceof HTMLCanvasElement ||
    data instanceof HTMLImageElement
  ) {
    return data;
  }
  return null;
}

function toLandmarkArray(
  landmarks: Array<{ x: number; y: number; z: number }> | undefined,
): number[][] | null {
  if (!landmarks || landmarks.length === 0) return null;
  return landmarks.map((lm) => [lm.x, lm.y, lm.z]);
}

/**
 * Face Landmarker commonly reports `visibility === 0` for all points (WASM / Tasks API;
 * see https://github.com/google-ai-edge/mediapipe/issues/5450). Above this threshold we
 * trust the model; otherwise we use a geometric proxy from normalized x/y.
 */
const FACE_VISIBILITY_MODEL_TRUST_EPS = 1e-3;

/** [0, 1]: 1 near frame edges inward, ~0 on the normalized border (cropping). */
function geometricFaceEdgeScore(x: number, y: number): number {
  const edgeDist = Math.min(x, 1 - x, y, 1 - y);
  return Math.min(1, 4 * Math.max(0, edgeDist));
}

/** [0, 1]: 1 near image center; helps when the face sits mid-frame but some ring points hug the outline. */
function geometricFaceCenterScore(x: number, y: number): number {
  const d = Math.hypot(x - 0.5, y - 0.5);
  return Math.max(0, Math.min(1, 1 - 1.85 * d));
}

function geometricFaceFramingScore(x: number, y: number): number {
  return Math.max(geometricFaceEdgeScore(x, y), geometricFaceCenterScore(x, y));
}

function isFiniteLandmarkXY(lm: { x?: unknown; y?: unknown }): boolean {
  return (
    typeof lm.x === 'number' &&
    typeof lm.y === 'number' &&
    Number.isFinite(lm.x) &&
    Number.isFinite(lm.y)
  );
}

type RawNormLm = { x?: number; y?: number; z?: number; visibility?: number };

/**
 * Mean visibility-style score for a full landmark set (hands, pose).
 * Same model-vs-geometry rule as the face mesh (`FACE_VISIBILITY_MODEL_TRUST_EPS`).
 */
function meanLandmarkSetVisibility(landmarks: RawNormLm[] | null | undefined): number | null {
  if (!landmarks || landmarks.length === 0) return null;
  let visSum = 0;
  let presentCount = 0;
  for (const lm of landmarks) {
    if (!lm || !isFiniteLandmarkXY(lm)) continue;
    presentCount += 1;
    const modelVis =
      typeof lm.visibility === 'number' && Number.isFinite(lm.visibility) ? lm.visibility : 0;
    const geom = geometricFaceFramingScore(lm.x!, lm.y!);
    const v = modelVis > FACE_VISIBILITY_MODEL_TRUST_EPS ? modelVis : geom;
    visSum += v;
  }
  if (presentCount === 0) return null;
  const meshCoverage = presentCount / landmarks.length;
  return (visSum / presentCount) * meshCoverage;
}

/**
 * Torso-only pose anchors in MediaPipe Pose 33-pt layout.
 * We intentionally exclude wrist/hand-adjacent indices so visible hands do not
 * inflate `poseVisibilityMean` when body framing is poor.
 */
const POSE_UPPER_BODY_VISIBILITY_INDICES: readonly number[] = [11, 12, 23, 24];

function meanLandmarkSubsetVisibility(
  landmarks: RawNormLm[] | null | undefined,
  indices: readonly number[],
): number | null {
  if (!landmarks || landmarks.length === 0 || indices.length === 0) return null;
  let visSum = 0;
  let presentCount = 0;
  for (const idx of indices) {
    if (idx < 0 || idx >= landmarks.length) continue;
    const lm = landmarks[idx];
    if (!lm || !isFiniteLandmarkXY(lm)) continue;
    presentCount += 1;
    const modelVis =
      typeof lm.visibility === 'number' && Number.isFinite(lm.visibility) ? lm.visibility : 0;
    const geom = geometricFaceFramingScore(lm.x!, lm.y!);
    const v = modelVis > FACE_VISIBILITY_MODEL_TRUST_EPS ? modelVis : geom;
    visSum += v;
  }
  if (presentCount === 0) return null;
  const meshCoverage = presentCount / indices.length;
  return (visSum / presentCount) * meshCoverage;
}

export class WebMediaPipeLandmarkBackend implements LandmarkExtractionBackend {
  private faceLandmarker: FaceLandmarker | null = null;
  private handLandmarker: HandLandmarker | null = null;
  private poseLandmarker: PoseLandmarker | null = null;
  private ready = false;
  private initializing = false;
  private lastTimestampMs = -1;

  async init(): Promise<void> {
    if (this.ready || this.initializing) return;
    this.initializing = true;

    try {
      const vision = await FilesetResolver.forVisionTasks(VISION_WASM_CDN);

      const [face, hand, pose] = await Promise.all([
        FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URLS.face, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.3,
          minFacePresenceConfidence: 0.3,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        }),
        HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URLS.hand, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.3,
          minHandPresenceConfidence: 0.3,
        }),
        PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URLS.pose, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        }),
      ]);

      this.faceLandmarker = face;
      this.handLandmarker = hand;
      this.poseLandmarker = pose;
      this.ready = true;
    } catch (err) {
      console.error('WebMediaPipeLandmarkBackend: failed to initialize', err);
      this.ready = false;
    } finally {
      this.initializing = false;
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  extract(rawInput: RawVideoFrame): LandmarkFrame | null {
    if (!this.ready || !this.faceLandmarker || !this.handLandmarker || !this.poseLandmarker) {
      return null;
    }

    const source = toImageSource(rawInput.data);
    if (!source) return null;

    if (source instanceof HTMLVideoElement && source.readyState < 2) {
      return null;
    }

    const now = performance.now();
    const ts = Math.max(Math.round(now), this.lastTimestampMs + 1);
    this.lastTimestampMs = ts;

    let faceResult: FaceLandmarkerResult;
    let handResult: HandLandmarkerResult;
    let poseResult: PoseLandmarkerResult;
    try {
      faceResult = this.faceLandmarker.detectForVideo(source, ts);
      handResult = this.handLandmarker.detectForVideo(source, ts);
      poseResult = this.poseLandmarker.detectForVideo(source, ts);
    } catch {
      return null;
    }

    // `[]` is truthy in JS — guard length so we do not fabricate an all-zero mesh and visibility 0.
    const rawFace = faceResult.faceLandmarks?.[0];
    const faceLandmarksRaw =
      Array.isArray(rawFace) && rawFace.length > 0 ? (rawFace as { x: number; y: number; z: number; visibility?: number }[]) : null;

    let faceLandmarks: number[][] | null = null;
    let faceMeanVisibility: number | null = null;
    if (faceLandmarksRaw) {
      let visSum = 0;
      let presentCount = 0;
      faceLandmarks = FACE_LANDMARK_INDICES.map((idx) => {
        const lm = faceLandmarksRaw[idx];
        if (lm && isFiniteLandmarkXY(lm)) {
          presentCount += 1;
          const modelVis =
            typeof lm.visibility === 'number' && Number.isFinite(lm.visibility) ? lm.visibility : 0;
          const geom = geometricFaceFramingScore(lm.x, lm.y);
          const v = modelVis > FACE_VISIBILITY_MODEL_TRUST_EPS ? modelVis : geom;
          visSum += v;
          const z = typeof lm.z === 'number' && Number.isFinite(lm.z) ? lm.z : 0;
          return [lm.x, lm.y, z];
        }
        return [0, 0, 0];
      });

      if (presentCount === 0) {
        faceLandmarks = null;
        faceMeanVisibility = null;
      } else {
        const meshCoverage = presentCount / FACE_LANDMARK_INDICES.length;
        faceMeanVisibility = (visSum / presentCount) * meshCoverage;
      }
    }

    let leftHandLandmarks: number[][] | null = null;
    let rightHandLandmarks: number[][] | null = null;
    let leftHandVisibilityMean: number | null = null;
    let rightHandVisibilityMean: number | null = null;
    if (handResult.landmarks && handResult.handedness) {
      for (let i = 0; i < handResult.landmarks.length; i++) {
        const label = handResult.handedness[i]?.[0]?.categoryName?.toLowerCase();
        const rawHand = handResult.landmarks[i] as RawNormLm[] | undefined;
        const lm = toLandmarkArray(rawHand as Array<{ x: number; y: number; z: number }> | undefined);
        const meanVis = meanLandmarkSetVisibility(rawHand);
        if (label === 'left' && !leftHandLandmarks) {
          leftHandLandmarks = lm;
          leftHandVisibilityMean = meanVis;
        } else if (label === 'right' && !rightHandLandmarks) {
          rightHandLandmarks = lm;
          rightHandVisibilityMean = meanVis;
        }
      }
    }

    const rawPose = poseResult.landmarks?.[0] as RawNormLm[] | undefined;
    const poseLandmarks =
      Array.isArray(rawPose) && rawPose.length > 0
        ? toLandmarkArray(rawPose as Array<{ x: number; y: number; z: number }>)
        : null;
    const poseVisibilityMean = meanLandmarkSubsetVisibility(rawPose, POSE_UPPER_BODY_VISIBILITY_INDICES);

    if (!faceLandmarks && !leftHandLandmarks && !rightHandLandmarks && !poseLandmarks) {
      return null;
    }

    return {
      sessionId: '',
      timestampMs: ts,
      faceMeanVisibility,
      faceLandmarks,
      leftHandLandmarks,
      rightHandLandmarks,
      poseLandmarks,
      leftHandVisibilityMean,
      rightHandVisibilityMean,
      poseVisibilityMean,
    };
  }

  async dispose(): Promise<void> {
    this.faceLandmarker?.close();
    this.handLandmarker?.close();
    this.poseLandmarker?.close();
    this.faceLandmarker = null;
    this.handLandmarker = null;
    this.poseLandmarker = null;
    this.ready = false;
  }
}
