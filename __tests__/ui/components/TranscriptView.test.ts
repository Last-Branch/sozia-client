/**
 * @jest-environment node
 */
import { ModalityType, SegmentStatus, type TranscriptSegment } from '../../../src/common/models';
import { TranscriptStore } from '../../../src/store/TranscriptStore';

describe('TranscriptStore contract (methods used by TranscriptView)', () => {
  it('getSegments returns current segments', () => {
    const store = new TranscriptStore();
    expect(typeof store.getSegments).toBe('function');
    expect(store.getSegments()).toEqual([]);
  });

  it('subscribe fires callback and returns unsubscribe', () => {
    const store = new TranscriptStore();
    const cb = jest.fn();
    const unsub = store.subscribe(cb);
    expect(typeof unsub).toBe('function');

    store.receiveSegment({
      segmentId: 'x',
      sessionId: 's',
      status: SegmentStatus.FINAL,
      text: 'hi',
      source: ModalityType.ASR,
      confidence: 0.9,
      timestampMs: 1,
      durationMs: 100,
      createdAtMs: 1,
      replacesSegmentId: null,
    });

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0]).toHaveLength(1);

    unsub();
    store.clear();
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
import {
  mapSourceLabel,
  buildTranscriptRows,
  type TranscriptRow,
} from '../../../src/ui/components/TranscriptView/helpers';

function makeSegment(overrides: Partial<TranscriptSegment> = {}): TranscriptSegment {
  return {
    segmentId: 'seg-1',
    sessionId: 'sess-1',
    status: SegmentStatus.FINAL,
    text: 'Hello world',
    source: ModalityType.ASR,
    confidence: 0.92,
    timestampMs: 1000,
    durationMs: 500,
    createdAtMs: 1000,
    replacesSegmentId: null,
    ...overrides,
  };
}

describe('mapSourceLabel', () => {
  it('maps ASR to transcript.sourceASR key', () => {
    expect(mapSourceLabel(ModalityType.ASR)).toBe('transcript.sourceASR');
  });

  it('maps LIP_READING to transcript.sourceLIP key', () => {
    expect(mapSourceLabel(ModalityType.LIP_READING)).toBe('transcript.sourceLIP');
  });

  it('maps TSL_RECOGNITION to transcript.sourceTSL key', () => {
    expect(mapSourceLabel(ModalityType.TSL_RECOGNITION)).toBe('transcript.sourceTSL');
  });

  it('maps GLOSS_TO_TEXT to transcript.sourceFused key', () => {
    expect(mapSourceLabel(ModalityType.GLOSS_TO_TEXT)).toBe('transcript.sourceFused');
  });
});

describe('buildTranscriptRows', () => {
  it('returns empty array for empty segments', () => {
    expect(buildTranscriptRows([])).toEqual([]);
  });

  it('builds rows with correct fields from segments', () => {
    const seg = makeSegment();
    const rows = buildTranscriptRows([seg]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual<TranscriptRow>({
      segmentId: 'seg-1',
      text: 'Hello world',
      isPartial: false,
      lowConfidence: false,
      sourceLabel: 'transcript.sourceASR',
    });
  });

  it('marks PARTIAL segments as isPartial', () => {
    const seg = makeSegment({ status: SegmentStatus.PARTIAL });
    const rows = buildTranscriptRows([seg]);
    expect(rows[0].isPartial).toBe(true);
  });

  it('flags confidence below 0.50 as lowConfidence', () => {
    const seg = makeSegment({ confidence: 0.35 });
    const rows = buildTranscriptRows([seg]);
    expect(rows[0].lowConfidence).toBe(true);
  });

  it('does not flag confidence at exactly 0.50', () => {
    const seg = makeSegment({ confidence: 0.50 });
    const rows = buildTranscriptRows([seg]);
    expect(rows[0].lowConfidence).toBe(false);
  });

  it('preserves segment order', () => {
    const segs = [
      makeSegment({ segmentId: 'a', timestampMs: 100 }),
      makeSegment({ segmentId: 'b', timestampMs: 200 }),
      makeSegment({ segmentId: 'c', timestampMs: 300 }),
    ];
    const rows = buildTranscriptRows(segs);
    expect(rows.map((r) => r.segmentId)).toEqual(['a', 'b', 'c']);
  });

  it('handles mixed PARTIAL and FINAL segments', () => {
    const segs = [
      makeSegment({ segmentId: 'a', status: SegmentStatus.FINAL }),
      makeSegment({ segmentId: 'b', status: SegmentStatus.PARTIAL }),
    ];
    const rows = buildTranscriptRows(segs);
    expect(rows[0].isPartial).toBe(false);
    expect(rows[1].isPartial).toBe(true);
  });
});
