import type { LandmarkFrame, PipelineHealth } from '@common/models';
import {
  SIGN_HAND_VISIBILITY_MIN,
  SIGN_POSE_VISIBILITY_MIN,
  SIGN_VISIBILITY_LOW_MIN_MS,
} from '@/ui/healthThresholds';
import { signVisibilityBannerKeys } from './signVisibilityBanner';

type RecentFrame = {
  timestampMs: number;
  detected: boolean;
  faceDetected: boolean;
};

type SignParts = {
  handsAnyBad: boolean;
  handsBothMissing: boolean;
  poseBad: boolean;
  combinedBad: boolean;
};

/**
 * Computes rolling health metrics for the video pipeline.
 */
export class TrackingHealthMonitor {
  private readonly windowSizeMs: number;
  private recentFrames: RecentFrame[] = [];
  /** Start of current continuous interval where SIGN combined visibility is low. */
  private combinedLowSinceMs: number | null = null;
  private lastSignSustained = false;
  private lastSignMessageKeys: string[] | null = null;

  constructor(windowSizeMs = 2000) {
    this.windowSizeMs = windowSizeMs;
  }

  update(landmarks: LandmarkFrame | null): void {
    const ts =
      landmarks?.timestampMs ??
      (this.recentFrames.length > 0
        ? this.recentFrames[this.recentFrames.length - 1].timestampMs + 33
        : Date.now());
    const entry: RecentFrame = {
      timestampMs: ts,
      detected: landmarks !== null,
      faceDetected: landmarks !== null && landmarks.faceLandmarks !== null,
    };

    this.recentFrames.push(entry);
    this.trim(ts);

    const sign = this.evaluateSignParts(landmarks);
    if (sign.combinedBad) {
      if (this.combinedLowSinceMs === null) this.combinedLowSinceMs = ts;
    } else {
      this.combinedLowSinceMs = null;
    }

    const sustained =
      this.combinedLowSinceMs !== null &&
      ts - this.combinedLowSinceMs >= SIGN_VISIBILITY_LOW_MIN_MS;

    this.lastSignSustained = sustained;
    this.lastSignMessageKeys = sustained
      ? signVisibilityBannerKeys(sign.handsAnyBad, sign.poseBad, sign.handsBothMissing)
      : null;
  }

  getHealth(sessionId: string): PipelineHealth {
    if (this.recentFrames.length === 0) {
      return {
        sessionId,
        pipeline: 'video',
        available: false,
        fps: 0,
        snr: null,
        faceDetected: null,
        faceFrameRatio: null,
        signVisibilitySustainedLow: false,
        signVisibilityMessageKeys: null,
        lastUpdatedMs: 0,
      };
    }

    const first = this.recentFrames[0];
    const last = this.recentFrames[this.recentFrames.length - 1];
    const spanMs = Math.max(1, last.timestampMs - first.timestampMs);
    const fps = Math.round((this.recentFrames.length / (spanMs / 1000)) * 10) / 10;
    const detectedCount = this.recentFrames.filter((f) => f.detected).length;
    const available = detectedCount / this.recentFrames.length > 0.5;
    const faceDetectedCount = this.recentFrames.filter((f) => f.faceDetected).length;
    const faceFrameRatio = faceDetectedCount / this.recentFrames.length;

    return {
      sessionId,
      pipeline: 'video',
      available,
      fps,
      snr: null,
      faceDetected: last.faceDetected,
      faceFrameRatio,
      signVisibilitySustainedLow: this.lastSignSustained,
      signVisibilityMessageKeys: this.lastSignSustained ? this.lastSignMessageKeys : null,
      lastUpdatedMs: last.timestampMs,
    };
  }

  /**
   * SIGN: hands use `SIGN_HAND_VISIBILITY_MIN`; pose uses `SIGN_POSE_VISIBILITY_MIN`.
   * `handsBothMissing`: pose mesh present but neither hand mesh — user should bring hands in frame.
   * Any detected hand below threshold is treated as a hand issue.
   * Missing visibility means on a detected part (e.g. native) default to OK so we do not false-degrade.
   */
  private evaluateSignParts(landmarks: LandmarkFrame | null): SignParts {
    const gn = (v: unknown): number | null =>
      typeof v === 'number' && Number.isFinite(v) ? v : null;

    const hasLeft = landmarks?.leftHandLandmarks !== null;
    const hasRight = landmarks?.rightHandLandmarks !== null;
    const hasPose = landmarks?.poseLandmarks !== null;

    const left = gn(landmarks?.leftHandVisibilityMean);
    const right = gn(landmarks?.rightHandVisibilityMean);
    const pose = gn(landmarks?.poseVisibilityMean);

    const leftScore = hasLeft ? (left ?? 1) : null;
    const rightScore = hasRight ? (right ?? 1) : null;
    const poseScore = hasPose ? (pose ?? 1) : null;

    const leftBad = hasLeft && leftScore !== null && leftScore < SIGN_HAND_VISIBILITY_MIN;
    const rightBad = hasRight && rightScore !== null && rightScore < SIGN_HAND_VISIBILITY_MIN;
    const poseBad = hasPose && poseScore !== null && poseScore < SIGN_POSE_VISIBILITY_MIN;

    const handsAnyBad = leftBad || rightBad;
    const handsBothMissing = hasPose && !hasLeft && !hasRight;
    const combinedBad = handsAnyBad || poseBad || handsBothMissing;

    return { handsAnyBad, handsBothMissing, poseBad, combinedBad };
  }

  private trim(nowMs: number): void {
    const cutoff = nowMs - this.windowSizeMs;
    this.recentFrames = this.recentFrames.filter((f) => f.timestampMs >= cutoff);
  }
}
