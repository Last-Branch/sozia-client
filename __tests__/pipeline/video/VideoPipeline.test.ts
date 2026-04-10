/**
 * @jest-environment node
 */

import {
  LandmarkExtractor,
  type LandmarkExtractionBackend,
  type RawVideoFrame,
} from '../../../src/pipeline/video/LandmarkExtractor';
import { TrackingHealthMonitor } from '../../../src/pipeline/video/TrackingHealthMonitor';
import { VideoPipeline, type RawMediaHandle } from '../../../src/pipeline/video/VideoPipeline';
import type { LandmarkFrame } from '../../../src/common/models';

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
  });

  it('reports faceDetected=false when landmarks are null', () => {
    const monitor = new TrackingHealthMonitor(5000);
    monitor.update(null);

    const health = monitor.getHealth('s1');
    expect(health.faceDetected).toBe(false);
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
});
