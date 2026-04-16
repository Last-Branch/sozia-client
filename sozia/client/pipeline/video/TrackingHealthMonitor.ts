import type { LandmarkFrame, PipelineHealth } from '@common/models';

type RecentFrame = {
  timestampMs: number;
  detected: boolean;
  faceDetected: boolean;
};

/**
 * Computes rolling health metrics for the video pipeline.
 */
export class TrackingHealthMonitor {
  private readonly windowSizeMs: number;
  private recentFrames: RecentFrame[] = [];

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
        lastUpdatedMs: 0,
      };
    }

    const first = this.recentFrames[0];
    const last = this.recentFrames[this.recentFrames.length - 1];
    const spanMs = Math.max(1, last.timestampMs - first.timestampMs);
    const fps = Math.round((this.recentFrames.length / (spanMs / 1000)) * 10) / 10;
    const detectedCount = this.recentFrames.filter((f) => f.detected).length;
    const available = detectedCount / this.recentFrames.length > 0.5;

    return {
      sessionId,
      pipeline: 'video',
      available,
      fps,
      snr: null,
      faceDetected: last.faceDetected,
      lastUpdatedMs: last.timestampMs,
    };
  }

  private trim(nowMs: number): void {
    const cutoff = nowMs - this.windowSizeMs;
    this.recentFrames = this.recentFrames.filter((f) => f.timestampMs >= cutoff);
  }
}

