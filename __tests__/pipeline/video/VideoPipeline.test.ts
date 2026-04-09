/**
 * @jest-environment node
 */

import {
  LandmarkExtractor,
  type LandmarkExtractionBackend,
  type RawVideoFrame,
} from '../../../src/pipeline/video/LandmarkExtractor';
import { TrackingHealthMonitor } from '../../../src/pipeline/video/TrackingHealthMonitor';
import { VideoPipeline, type RawMediaHandle, type TransmissionManager } from '../../../src/pipeline/video/VideoPipeline';
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
      faceLandmarks: [[0.1, 0.2, 0.3] as [number, number, number]],
      leftHandLandmarks: null,
      rightHandLandmarks: null,
      poseLandmarks: [[0.4, 0.5, 0.6] as [number, number, number]],
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
});

describe('VideoPipeline lifecycle', () => {
  const txMock = (): TransmissionManager => ({
    sendFeatures: jest.fn(),
    sendHealth: jest.fn(),
  });

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('throws when extractor is not ready', async () => {
    const backend = new MockBackend(false);
    const pipeline = new VideoPipeline(new LandmarkExtractor(backend));
    expect(() => pipeline.start('s1', {}, txMock())).toThrow('Landmark extractor is not ready');
  });

  it('emits landmark frames while running', async () => {
    const backend = new MockBackend(true);
    const extractor = new LandmarkExtractor(backend);
    const pipeline = new VideoPipeline(extractor, new TrackingHealthMonitor(5000), 10);

    let ts = 1000;
    const handle: RawMediaHandle = {
      getFrame: () => ({ timestampMs: (ts += 100), width: 640, height: 480, data: null }),
    };

    const received: LandmarkFrame[] = [];
    pipeline.onFrame((f) => received.push(f));

    const tx = txMock();
    pipeline.start('session-video-1', handle, tx);
    jest.advanceTimersByTime(350);

    expect(received.length).toBeGreaterThan(0);
    expect(received[0].sessionId).toBe('session-video-1');
    expect(pipeline.getHealth().pipeline).toBe('video');
  });

  it('pause/resume toggles availability', async () => {
    const backend = new MockBackend(true);
    const pipeline = new VideoPipeline(new LandmarkExtractor(backend), new TrackingHealthMonitor(5000), 10);

    pipeline.start('s1', {}, txMock());
    jest.advanceTimersByTime(120);
    expect(pipeline.getHealth().available).toBe(true);

    pipeline.pause();
    expect(pipeline.getHealth().available).toBe(false);

    pipeline.resume();
    expect(pipeline.getHealth().available).toBe(true);
  });

  it('stop clears session and disables pipeline', async () => {
    const backend = new MockBackend(true);
    const pipeline = new VideoPipeline(new LandmarkExtractor(backend), new TrackingHealthMonitor(5000), 10);
    pipeline.start('s1', {}, txMock());
    pipeline.stop();
    const health = pipeline.getHealth();
    expect(health.sessionId).toBe('');
    expect(health.available).toBe(false);
  });
});

