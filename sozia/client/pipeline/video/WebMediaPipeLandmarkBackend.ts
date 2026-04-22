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

function toPoseLandmarkArray(
  landmarks: Array<{ x: number; y: number; z: number; visibility: number }> | undefined,
): number[][] | null {
  if (!landmarks || landmarks.length === 0) return null;
  return landmarks.map((lm) => [lm.x, lm.y, lm.z, lm.visibility]);
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

    const faceLandmarksRaw = faceResult.faceLandmarks?.[0];
    const faceLandmarks = faceLandmarksRaw
      ? FACE_LANDMARK_INDICES.map((idx) => {
          const lm = faceLandmarksRaw[idx];
          return lm ? [lm.x, lm.y, lm.z] : [0, 0, 0];
        })
      : null;

    let leftHandLandmarks: number[][] | null = null;
    let rightHandLandmarks: number[][] | null = null;
    if (handResult.landmarks && handResult.handedness) {
      for (let i = 0; i < handResult.landmarks.length; i++) {
        const label = handResult.handedness[i]?.[0]?.categoryName?.toLowerCase();
        const lm = toLandmarkArray(handResult.landmarks[i]);
        if (label === 'left' && !leftHandLandmarks) leftHandLandmarks = lm;
        else if (label === 'right' && !rightHandLandmarks) rightHandLandmarks = lm;
      }
    }

    const poseLandmarks = poseResult.landmarks?.[0]
      ? toPoseLandmarkArray(poseResult.landmarks[0])
      : null;

    if (!faceLandmarks && !leftHandLandmarks && !rightHandLandmarks && !poseLandmarks) {
      return null;
    }

    return {
      sessionId: '',
      timestampMs: ts,
      faceLandmarks,
      leftHandLandmarks,
      rightHandLandmarks,
      poseLandmarks,
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
