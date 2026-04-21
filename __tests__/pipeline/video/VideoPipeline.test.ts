/**
 * @jest-environment node
 */

import {
  LandmarkExtractor,
  type LandmarkExtractionBackend,
  type RawVideoFrame,
} from '@/pipeline/video/LandmarkExtractor';
import { TrackingHealthMonitor } from '@/pipeline/video/TrackingHealthMonitor';
import { VideoPipeline, type RawMediaHandle } from '@/pipeline/video/VideoPipeline';
import type { LandmarkFrame } from '@common/models';

function makeMockTx(): { sendFeatures: jest.Mock } {
  return { sendFeatures: jest.fn() };
}

class MockBackend implements LandmarkExtractionBackend {
  private readonly ready: boolean;
  private emitLandmarks = true;

  constructor(ready = true) {
    this.ready = ready;
  }

  setEmit(enabled: boolean): void {
    this.emitLandmarks = enabled;
  }

  extract(_rawInput: RawVideoFrame): LandmarkFrame | null {
    if (!this.emitLandmarks) return null;
    return {
      sessionId: '',
      timestampMs: _rawInput.timestampMs,
      faceLandmarks: [[0.1, 0.2, 0.3]],
      leftHandLandmarks: null,
      rightHandLandmarks: null,
      poseLandmarks: [[0.4, 0.5, 0.6]],
    };
  }

  isReady(): boolean {
    return this.ready;
  }
}

describe('TrackingHealthMonitor', () => {
  it('computes available=true when detection ratio is above 50%', () => {
    const monitor = new TrackingHealthMonitor(5000);
    const frame = (ts: number, detected: boolean): LandmarkFrame | null =>
      detected
        ? {
            sessionId: 's1',
            timestampMs: ts,
            faceLandmarks: [[0, 0, 0]],
            leftHandLandmarks: null,
            rightHandLandmarks: null,
            poseLandmarks: null,
          }
        : null;

    monitor.update(frame(1000, true));
    monitor.update(frame(1033, true));
    monitor.update(frame(1066, false));

    const health = monitor.getHealth('s1');
    expect(health.pipeline).toBe('video');
    expect(health.available).toBe(true);
    expect(health.snr).toBeNull();
    expect(health.faceFrameRatio).toBeCloseTo(2 / 3, 5);
  });

  it('reports faceDetected=false when landmarks are null', () => {
    const monitor = new TrackingHealthMonitor(5000);
    monitor.update(null);

    const health = monitor.getHealth('s1');
    expect(health.faceDetected).toBe(false);
  });

  it('sets signVisibilitySustainedLow after both hands stay low for SIGN_VISIBILITY_LOW_MIN_MS', () => {
    const monitor = new TrackingHealthMonitor(5000);
    const base = 10_000;
    const mk = (ts: number, l: number, r: number, p: number): LandmarkFrame => ({
      sessionId: 's1',
      timestampMs: ts,
      faceLandmarks: [[0, 0, 0]],
      leftHandLandmarks: [[0, 0, 0]],
      rightHandLandmarks: [[0, 0, 0]],
      poseLandmarks: [[0, 0, 0]],
      leftHandVisibilityMean: l,
      rightHandVisibilityMean: r,
      poseVisibilityMean: p,
    });
    for (let i = 0; i < 50; i++) {
      monitor.update(mk(base + i * 34, 0.2, 0.2, 0.95));
    }
    const health = monitor.getHealth('s1');
    expect(health.signVisibilitySustainedLow).toBe(true);
    expect(health.signVisibilityMessageKeys).toEqual(['health.signLowHands']);
  });

  it('hands-only alert when pose is above pose threshold but hands are low', () => {
    const monitor = new TrackingHealthMonitor(5000);
    const base = 15_000;
    const mk = (ts: number): LandmarkFrame => ({
      sessionId: 's1',
      timestampMs: ts,
      faceLandmarks: [[0, 0, 0]],
      leftHandLandmarks: [[0, 0, 0]],
      rightHandLandmarks: [[0, 0, 0]],
      poseLandmarks: [[0, 0, 0]],
      leftHandVisibilityMean: 0.2,
      rightHandVisibilityMean: 0.2,
      poseVisibilityMean: 0.95,
    });
    for (let i = 0; i < 50; i++) {
      monitor.update(mk(base + i * 34));
    }
    expect(monitor.getHealth('s1').signVisibilityMessageKeys).toEqual(['health.signLowHands']);
  });

  it('hands-only alert when a single detected hand is below threshold', () => {
    const monitor = new TrackingHealthMonitor(5000);
    const base = 16_000;
    const mk = (ts: number): LandmarkFrame => ({
      sessionId: 's1',
      timestampMs: ts,
      faceLandmarks: [[0, 0, 0]],
      leftHandLandmarks: [[0, 0, 0]],
      rightHandLandmarks: null,
      poseLandmarks: [[0, 0, 0]],
      leftHandVisibilityMean: 0.2,
      poseVisibilityMean: 0.95,
    });
    for (let i = 0; i < 50; i++) {
      monitor.update(mk(base + i * 34));
    }
    expect(monitor.getHealth('s1').signVisibilityMessageKeys).toEqual(['health.signLowHands']);
  });

  it('hands alert when pose is tracked but neither hand mesh is present', () => {
    const monitor = new TrackingHealthMonitor(5000);
    const base = 50_000;
    const mk = (ts: number): LandmarkFrame => ({
      sessionId: 's1',
      timestampMs: ts,
      faceLandmarks: [[0, 0, 0]],
      leftHandLandmarks: null,
      rightHandLandmarks: null,
      poseLandmarks: [[0, 0, 0]],
      poseVisibilityMean: 0.9,
    });
    for (let i = 0; i < 50; i++) {
      monitor.update(mk(base + i * 34));
    }
    expect(monitor.getHealth('s1').signVisibilityMessageKeys).toEqual(['health.signLowHands']);
  });

  it('general framing when no hands detected and pose visibility is low', () => {
    const monitor = new TrackingHealthMonitor(5000);
    const base = 60_000;
    const mk = (ts: number): LandmarkFrame => ({
      sessionId: 's1',
      timestampMs: ts,
      faceLandmarks: [[0, 0, 0]],
      leftHandLandmarks: null,
      rightHandLandmarks: null,
      poseLandmarks: [[0, 0, 0]],
      poseVisibilityMean: 0.2,
    });
    for (let i = 0; i < 50; i++) {
      monitor.update(mk(base + i * 34));
    }
    expect(monitor.getHealth('s1').signVisibilityMessageKeys).toEqual(['health.signLowSigningFraming']);
  });

  it('sets signVisibility from pose-only sustained low visibility', () => {
    const monitor = new TrackingHealthMonitor(5000);
    const base = 20_000;
    const mk = (ts: number): LandmarkFrame => ({
      sessionId: 's1',
      timestampMs: ts,
      faceLandmarks: [[0, 0, 0]],
      leftHandLandmarks: [[0, 0, 0]],
      rightHandLandmarks: [[0, 0, 0]],
      poseLandmarks: [[0, 0, 0]],
      leftHandVisibilityMean: 0.95,
      rightHandVisibilityMean: 0.95,
      poseVisibilityMean: 0.2,
    });
    for (let i = 0; i < 50; i++) {
      monitor.update(mk(base + i * 34));
    }
    const health = monitor.getHealth('s1');
    expect(health.signVisibilitySustainedLow).toBe(true);
    expect(health.signVisibilityMessageKeys).toEqual(['health.signLowUpperBody']);
  });

  it('returns a general framing key when both hands and pose stay low', () => {
    const monitor = new TrackingHealthMonitor(5000);
    const base = 40_000;
    const mk = (ts: number): LandmarkFrame => ({
      sessionId: 's1',
      timestampMs: ts,
      faceLandmarks: [[0, 0, 0]],
      leftHandLandmarks: [[0, 0, 0]],
      rightHandLandmarks: [[0, 0, 0]],
      poseLandmarks: [[0, 0, 0]],
      leftHandVisibilityMean: 0.2,
      rightHandVisibilityMean: 0.2,
      poseVisibilityMean: 0.2,
    });
    for (let i = 0; i < 50; i++) {
      monitor.update(mk(base + i * 34));
    }
    expect(monitor.getHealth('s1').signVisibilityMessageKeys).toEqual(['health.signLowSigningFraming']);
  });

  it('clears sign sustained low when visibility recovers', () => {
    const monitor = new TrackingHealthMonitor(5000);
    const base = 30_000;
    const low = (ts: number): LandmarkFrame => ({
      sessionId: 's1',
      timestampMs: ts,
      faceLandmarks: [[0, 0, 0]],
      leftHandLandmarks: [[0, 0, 0]],
      rightHandLandmarks: [[0, 0, 0]],
      poseLandmarks: [[0, 0, 0]],
      leftHandVisibilityMean: 0.2,
      rightHandVisibilityMean: 0.2,
      poseVisibilityMean: 0.95,
    });
    const ok = (ts: number): LandmarkFrame => ({
      sessionId: 's1',
      timestampMs: ts,
      faceLandmarks: [[0, 0, 0]],
      leftHandLandmarks: [[0, 0, 0]],
      rightHandLandmarks: [[0, 0, 0]],
      poseLandmarks: [[0, 0, 0]],
      leftHandVisibilityMean: 0.95,
      rightHandVisibilityMean: 0.95,
      poseVisibilityMean: 0.95,
    });
    for (let i = 0; i < 50; i++) monitor.update(low(base + i * 34));
    expect(monitor.getHealth('s1').signVisibilitySustainedLow).toBe(true);
    monitor.update(ok(base + 50 * 34));
    const health = monitor.getHealth('s1');
    expect(health.signVisibilitySustainedLow).toBe(false);
    expect(health.signVisibilityMessageKeys).toBeNull();
  });
});

describe('VideoPipeline lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('throws when extractor is not ready', () => {
    const backend = new MockBackend(false);
    const pipeline = new VideoPipeline(new LandmarkExtractor(backend));
    expect(() => pipeline.start('s1', {})).toThrow('Landmark extractor is not ready');
  });

  it('extracts landmarks and reports healthy while running', () => {
    const backend = new MockBackend(true);
    const extractor = new LandmarkExtractor(backend);
    const pipeline = new VideoPipeline(extractor, new TrackingHealthMonitor(5000), 10);

    const handle: RawMediaHandle = {
      getFrame: () => ({ timestampMs: Date.now(), width: 640, height: 480, data: null }),
    };

    pipeline.start('session-video-1', handle);
    jest.advanceTimersByTime(350);

    const health = pipeline.getHealth();
    expect(health.pipeline).toBe('video');
    expect(health.sessionId).toBe('session-video-1');
    expect(health.available).toBe(true);
    expect(health.faceDetected).toBe(true);

    pipeline.stop();
  });

  it('pause/resume toggles availability', () => {
    const backend = new MockBackend(true);
    const pipeline = new VideoPipeline(new LandmarkExtractor(backend), new TrackingHealthMonitor(5000), 10);

    pipeline.start('s1', {});
    jest.advanceTimersByTime(120);
    expect(pipeline.getHealth().available).toBe(true);

    pipeline.pause();
    expect(pipeline.getHealth().available).toBe(false);

    pipeline.resume();
    expect(pipeline.getHealth().available).toBe(true);

    pipeline.stop();
  });

  it('stop clears session and disables pipeline', () => {
    const backend = new MockBackend(true);
    const pipeline = new VideoPipeline(new LandmarkExtractor(backend), new TrackingHealthMonitor(5000), 10);
    pipeline.start('s1', {});
    pipeline.stop();
    const health = pipeline.getHealth();
    expect(health.sessionId).toBe('');
    expect(health.available).toBe(false);
  });

  it('reports unavailable health when backend emits null', () => {
    const backend = new MockBackend(true);
    backend.setEmit(false);
    const pipeline = new VideoPipeline(new LandmarkExtractor(backend), new TrackingHealthMonitor(5000), 10);

    pipeline.start('s1', {});
    jest.advanceTimersByTime(350);

    expect(pipeline.getHealth().available).toBe(false);

    pipeline.stop();
  });

  it('delivers extracted landmark frames to tx.sendFeatures', () => {
    const backend = new MockBackend(true);
    const pipeline = new VideoPipeline(new LandmarkExtractor(backend), new TrackingHealthMonitor(5000), 10);
    const tx = makeMockTx();

    pipeline.start('s1', {}, tx as never);
    jest.advanceTimersByTime(350);
    pipeline.stop();

    expect(tx.sendFeatures).toHaveBeenCalled();
    const arg = (tx.sendFeatures.mock.calls[0] as [LandmarkFrame])[0];
    expect(arg.sessionId).toBe('s1');
    expect(arg.faceLandmarks).toBeDefined();
  });

  it('does not deliver null frames to tx.sendFeatures', () => {
    const backend = new MockBackend(true);
    backend.setEmit(false);
    const pipeline = new VideoPipeline(new LandmarkExtractor(backend), new TrackingHealthMonitor(5000), 10);
    const tx = makeMockTx();

    pipeline.start('s1', {}, tx as never);
    jest.advanceTimersByTime(350);
    pipeline.stop();

    expect(tx.sendFeatures).not.toHaveBeenCalled();
  });
});
