import type { LandmarkFrame, PipelineHealth } from '../../common/models';
import type { TransmissionManager } from '../../transmission/TransmissionManager';
import {
  LandmarkExtractor,
  type RawVideoFrame,
} from './LandmarkExtractor';
import { TrackingHealthMonitor } from './TrackingHealthMonitor';

const DEFAULT_TARGET_FPS = 30;

/** Opaque camera handle. Concrete camera APIs are hidden behind this shape. */
export interface RawMediaHandle {
  getFrame?: () => RawVideoFrame | null;
}

export interface IVideoPipeline {
  start(sessionId: string, cameraHandle: RawMediaHandle, tx?: TransmissionManager): void;
  setCameraHandle(handle: RawMediaHandle): void;
  pause(): void;
  resume(): void;
  stop(): void;
  getHealth(): PipelineHealth;
}

/**
 * Client-side video capture and landmark extraction loop.
 * Emits anonymized landmarks only; raw frames never leave this package.
 * Sends assembled LandmarkFrames to TransmissionManager if one is provided.
 */
export class VideoPipeline implements IVideoPipeline {
  private readonly extractor: LandmarkExtractor;
  private readonly healthMonitor: TrackingHealthMonitor;
  private readonly targetFps: number;

  private sessionId = '';
  private isRunning = false;
  private paused = false;
  private cameraHandle: RawMediaHandle | null = null;
  private transmissionManager: TransmissionManager | null = null;
  private frameTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    extractor: LandmarkExtractor = new LandmarkExtractor(),
    healthMonitor: TrackingHealthMonitor = new TrackingHealthMonitor(),
    targetFps = DEFAULT_TARGET_FPS
  ) {
    this.extractor = extractor;
    this.healthMonitor = healthMonitor;
    this.targetFps = targetFps;
  }

  start(sessionId: string, cameraHandle: RawMediaHandle, tx?: TransmissionManager): void {
    if (this.isRunning || this.paused) return;
    if (!this.extractor.isReady()) {
      throw new Error('Landmark extractor is not ready');
    }

    this.sessionId = sessionId;
    this.cameraHandle = cameraHandle;
    this.transmissionManager = tx ?? null;
    this.isRunning = true;
    this.paused = false;
    this.startLoop();
  }

  setCameraHandle(handle: RawMediaHandle): void {
    this.cameraHandle = handle;
  }

  pause(): void {
    if (!this.isRunning || this.paused) return;
    this.paused = true;
    this.isRunning = false;
    this.stopLoop();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.isRunning = true;
    this.startLoop();
  }

  stop(): void {
    this.stopLoop();
    this.isRunning = false;
    this.paused = false;
    this.sessionId = '';
    this.cameraHandle = null;
    this.transmissionManager = null;
  }

  getHealth(): PipelineHealth {
    if (!this.sessionId) {
      return {
        sessionId: '',
        pipeline: 'video',
        available: false,
        fps: 0,
        snr: null,
        faceDetected: null,
        lastUpdatedMs: 0,
      };
    }

    const rolling = this.healthMonitor.getHealth(this.sessionId);
    return {
      ...rolling,
      available: this.isRunning && rolling.available,
    };
  }

  private startLoop(): void {
    const intervalMs = Math.max(1, Math.round(1000 / this.targetFps));
    this.frameTimer = setInterval(() => {
      const rawFrame = this.captureFrame();
      const extracted = this.extractor.extract(rawFrame);
      const landmarkFrame = this.toLandmarkFrame(extracted, rawFrame.timestampMs);

      this.healthMonitor.update(landmarkFrame);
      if (landmarkFrame !== null) {
        if (__DEV__) {
          console.log('[VideoPipeline] landmark detected', {
            face: landmarkFrame.faceLandmarks?.length ?? 0,
            leftHand: landmarkFrame.leftHandLandmarks?.length ?? 0,
            rightHand: landmarkFrame.rightHandLandmarks?.length ?? 0,
            pose: landmarkFrame.poseLandmarks?.length ?? 0,
            faceSample: landmarkFrame.faceLandmarks?.slice(0, 3),
            poseSample: landmarkFrame.poseLandmarks?.slice(0, 3),
          });
        }
        this.transmissionManager?.sendFeatures(landmarkFrame);
      }
    }, intervalMs);
  }

  private stopLoop(): void {
    if (this.frameTimer !== null) {
      clearInterval(this.frameTimer);
      this.frameTimer = null;
    }
  }

  private captureFrame(): RawVideoFrame {
    const captured = this.cameraHandle?.getFrame?.();
    if (captured) return captured;
    return {
      timestampMs: Date.now(),
      width: 0,
      height: 0,
      data: null,
    };
  }

  private toLandmarkFrame(extracted: LandmarkFrame | null, timestampMs: number): LandmarkFrame | null {
    if (!extracted) return null;
    return {
      sessionId: extracted.sessionId || this.sessionId,
      timestampMs,
      faceLandmarks: extracted.faceLandmarks,
      leftHandLandmarks: extracted.leftHandLandmarks,
      rightHandLandmarks: extracted.rightHandLandmarks,
      poseLandmarks: extracted.poseLandmarks,
    };
  }
}
