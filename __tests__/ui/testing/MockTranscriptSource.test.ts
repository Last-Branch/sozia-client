/**
 * @jest-environment node
 */
import { TranscriptStore } from '../../../src/store/TranscriptStore';
import { MockTranscriptSource } from '../../../src/ui/testing/MockTranscriptSource';
import { SegmentStatus } from '../../../src/common/models';

describe('MockTranscriptSource', () => {
  let store: TranscriptStore;
  let source: MockTranscriptSource;

  beforeEach(() => {
    jest.useFakeTimers();
    store = new TranscriptStore();
    source = new MockTranscriptSource(store, 'test-session');
  });

  afterEach(() => {
    source.stop();
    jest.useRealTimers();
  });

  it('starts in stopped state', () => {
    expect(source.isRunning()).toBe(false);
  });

  it('isRunning returns true after start', () => {
    source.start();
    expect(source.isRunning()).toBe(true);
  });

  it('isRunning returns false after stop', () => {
    source.start();
    source.stop();
    expect(source.isRunning()).toBe(false);
  });

  it('emits a PARTIAL segment after the first interval', () => {
    source.start();
    jest.advanceTimersByTime(2000);
    const segments = store.getAll();
    expect(segments.length).toBeGreaterThanOrEqual(1);
    expect(segments[0].status).toBe(SegmentStatus.PARTIAL);
    expect(segments[0].sessionId).toBe('test-session');
  });

  it('emits a FINAL that replaces the PARTIAL after the second interval', () => {
    source.start();
    // First tick: PARTIAL
    jest.advanceTimersByTime(2000);
    const partialId = store.getAll()[0].segmentId;

    // Second tick: FINAL replacing the partial
    jest.advanceTimersByTime(1500);
    const segments = store.getAll();
    const finalSeg = segments.find((s) => s.status === SegmentStatus.FINAL);
    expect(finalSeg).toBeDefined();
    expect(finalSeg!.replacesSegmentId).toBe(partialId);
  });

  it('stops emitting after stop is called', () => {
    source.start();
    jest.advanceTimersByTime(2000);
    const countAfterFirst = store.getAll().length;

    source.stop();
    jest.advanceTimersByTime(10000);
    expect(store.getAll().length).toBe(countAfterFirst);
  });

  it('varies source modality across emissions', () => {
    source.start();
    // Run enough ticks to cycle through multiple lines
    for (let i = 0; i < 12; i++) {
      jest.advanceTimersByTime(2000);
    }
    const sources = store.getAll().map((s) => s.source);
    const uniqueSources = new Set(sources);
    expect(uniqueSources.size).toBeGreaterThan(1);
  });

  it('includes some segments with confidence below 0.50', () => {
    source.start();
    for (let i = 0; i < 20; i++) {
      jest.advanceTimersByTime(2000);
    }
    const hasLowConfidence = store.getAll().some((s) => s.confidence < 0.5);
    expect(hasLowConfidence).toBe(true);
  });

  it('start is idempotent — calling start twice does not double emissions', () => {
    source.start();
    source.start();
    jest.advanceTimersByTime(2000);
    expect(store.getAll().length).toBe(1);
  });
});
