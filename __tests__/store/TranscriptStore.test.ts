/**
 * @jest-environment node
 */
/**
 * Unit tests — sozia.client.store
 *
 * Scope: TranscriptStore (timeline management) and TranscriptExporter (export formats).
 *
 * Test plan reference: TP-CLIENT-STORE-001 through TP-CLIENT-STORE-004
 */

import { TranscriptStore } from '../../src/store/TranscriptStore';
import { TranscriptExporter } from '../../src/store/TranscriptExporter';
import type { TranscriptSegment } from '../../src/common/models';
import { SegmentStatus, ModalityType } from '../../src/common/models';

// Mock expo-file-system/next for TranscriptExporter tests
const mockWrite = jest.fn();
jest.mock('expo-file-system/next', () => ({
  File: jest.fn().mockImplementation((path: string) => ({
    uri: path,
    write: mockWrite,
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _segCounter = 0;

function makeSegment(overrides: Partial<TranscriptSegment> = {}): TranscriptSegment {
  const id = `seg-${++_segCounter}`;
  return {
    segmentId: id,
    sessionId: 'session-001',
    status: SegmentStatus.FINAL,
    text: 'Merhaba dünya',
    source: ModalityType.ASR,
    confidence: 0.85,
    timestampMs: 1000,
    durationMs: 500,
    createdAtMs: Date.now(),
    replacesSegmentId: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// TP-CLIENT-STORE-001: Basic receiveSegment and retrieval
// ---------------------------------------------------------------------------

describe('TranscriptStore — receiveSegment and retrieval', () => {
  let store: TranscriptStore;

  beforeEach(() => {
    store = new TranscriptStore();
    _segCounter = 0;
  });

  it('TP-CLIENT-STORE-001a: starts empty', () => {
    expect(store.getSegments()).toEqual([]);
    expect(store.size).toBe(0);
  });

  it('TP-CLIENT-STORE-001b: receiveSegment adds a segment', () => {
    store.receiveSegment(makeSegment());
    expect(store.size).toBe(1);
  });

  it('TP-CLIENT-STORE-001c: getSegments returns a copy, not the internal array', () => {
    store.receiveSegment(makeSegment());
    const first = store.getSegments();
    const second = store.getSegments();
    expect(first).not.toBe(second); // different references
    expect(first).toEqual(second);  // same contents
  });

  it('TP-CLIENT-STORE-001d: segments are sorted by timestampMs after receiveSegment', () => {
    store.receiveSegment(makeSegment({ timestampMs: 3000 }));
    store.receiveSegment(makeSegment({ timestampMs: 1000 }));
    store.receiveSegment(makeSegment({ timestampMs: 2000 }));

    const timestamps = store.getSegments().map((s) => s.timestampMs);
    expect(timestamps).toEqual([1000, 2000, 3000]);
  });
});

// ---------------------------------------------------------------------------
// TP-CLIENT-STORE-002: Partial → Final replacement
// ---------------------------------------------------------------------------

describe('TranscriptStore — partial → final replacement', () => {
  let store: TranscriptStore;

  beforeEach(() => {
    store = new TranscriptStore();
    _segCounter = 0;
  });

  it('TP-CLIENT-STORE-002a: FINAL segment replaces the referenced PARTIAL in-place', () => {
    const partial = makeSegment({
      segmentId: 'partial-1',
      status: SegmentStatus.PARTIAL,
      text: 'MERHABA DÜNYA',
      timestampMs: 1000,
    });
    const final = makeSegment({
      segmentId: 'final-1',
      status: SegmentStatus.FINAL,
      text: 'Merhaba dünya',
      timestampMs: 1000,
      replacesSegmentId: 'partial-1',
    });

    store.receiveSegment(partial);
    store.receiveSegment(final);

    expect(store.size).toBe(1);
    expect(store.getSegments()[0].text).toBe('Merhaba dünya');
    expect(store.getSegments()[0].status).toBe(SegmentStatus.FINAL);
  });

  it('TP-CLIENT-STORE-002b: replacement preserves display order', () => {
    const p1 = makeSegment({ segmentId: 'p1', status: SegmentStatus.PARTIAL, timestampMs: 1000 });
    const p2 = makeSegment({ segmentId: 'p2', status: SegmentStatus.PARTIAL, timestampMs: 2000 });
    const f1 = makeSegment({
      segmentId: 'f1',
      status: SegmentStatus.FINAL,
      timestampMs: 1000,
      replacesSegmentId: 'p1',
    });

    store.receiveSegment(p1);
    store.receiveSegment(p2);
    store.receiveSegment(f1);

    expect(store.size).toBe(2);
    expect(store.getSegments()[0].segmentId).toBe('f1');
    expect(store.getSegments()[1].segmentId).toBe('p2');
  });

  it('TP-CLIENT-STORE-002c: FINAL is appended if referenced PARTIAL is not found', () => {
    const final = makeSegment({
      segmentId: 'f1',
      status: SegmentStatus.FINAL,
      replacesSegmentId: 'nonexistent',
    });

    store.receiveSegment(final);

    expect(store.size).toBe(1);
    expect(store.getSegments()[0].segmentId).toBe('f1');
  });
});

// ---------------------------------------------------------------------------
// TP-CLIENT-STORE-002d: getSegmentById
// ---------------------------------------------------------------------------

describe('TranscriptStore — getSegmentById', () => {
  let store: TranscriptStore;

  beforeEach(() => {
    store = new TranscriptStore();
    _segCounter = 0;
  });

  it('returns null when segment does not exist', () => {
    expect(store.getSegmentById('nonexistent')).toBeNull();
  });

  it('returns the segment when it exists', () => {
    const seg = makeSegment({ segmentId: 'abc' });
    store.receiveSegment(seg);
    expect(store.getSegmentById('abc')).toEqual(seg);
  });

  it('returns null after clear', () => {
    store.receiveSegment(makeSegment({ segmentId: 'abc' }));
    store.clear();
    expect(store.getSegmentById('abc')).toBeNull();
  });

  it('returns the replacement after partial → final', () => {
    store.receiveSegment(makeSegment({ segmentId: 'p1', status: SegmentStatus.PARTIAL }));
    const final = makeSegment({ segmentId: 'f1', replacesSegmentId: 'p1' });
    store.receiveSegment(final);
    expect(store.getSegmentById('f1')).toEqual(final);
    expect(store.getSegmentById('p1')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// TP-CLIENT-STORE-003: Clear and subscribe
// ---------------------------------------------------------------------------

describe('TranscriptStore — clear and subscribe', () => {
  let store: TranscriptStore;

  beforeEach(() => {
    store = new TranscriptStore();
    _segCounter = 0;
  });

  it('TP-CLIENT-STORE-003a: clear removes all segments', () => {
    store.receiveSegment(makeSegment());
    store.receiveSegment(makeSegment());
    store.clear();
    expect(store.size).toBe(0);
  });

  it('TP-CLIENT-STORE-003b: subscribe fires on receiveSegment with the current snapshot', () => {
    const received: TranscriptSegment[][] = [];
    store.subscribe((s) => received.push(s));

    store.receiveSegment(makeSegment());
    expect(received).toHaveLength(1);
    expect(received[0]).toHaveLength(1);
  });

  it('TP-CLIENT-STORE-003c: subscribe fires on clear with an empty array', () => {
    store.receiveSegment(makeSegment());
    const received: TranscriptSegment[][] = [];
    store.subscribe((s) => received.push(s));

    store.clear();
    expect(received).toHaveLength(1);
    expect(received[0]).toHaveLength(0);
  });

  it('TP-CLIENT-STORE-003d: unsubscribe stops update delivery', () => {
    const received: TranscriptSegment[][] = [];
    const unsub = store.subscribe((s) => received.push(s));

    store.receiveSegment(makeSegment());
    unsub();
    store.receiveSegment(makeSegment());

    expect(received).toHaveLength(1);
  });

  it('TP-CLIENT-STORE-003e: multiple listeners receive updates simultaneously', () => {
    const countA = { n: 0 };
    const countB = { n: 0 };
    store.subscribe(() => countA.n++);
    store.subscribe(() => countB.n++);

    store.receiveSegment(makeSegment());
    expect(countA.n).toBe(1);
    expect(countB.n).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// TP-CLIENT-STORE-004: TranscriptExporter
// ---------------------------------------------------------------------------

describe('TranscriptExporter', () => {
  let exporter: TranscriptExporter;

  beforeEach(() => {
    exporter = new TranscriptExporter();
    mockWrite.mockClear();
    _segCounter = 0;
  });

  it('TP-CLIENT-STORE-004a: exportAsText writes empty string when segments is empty', async () => {
    await exporter.exportAsText([], '/tmp/test.txt');
    expect(mockWrite).toHaveBeenCalledWith('');
  });

  it('TP-CLIENT-STORE-004b: exportAsText includes only FINAL segments (plus trailing PARTIAL)', async () => {
    const segments = [
      makeSegment({ segmentId: 'p1', status: SegmentStatus.PARTIAL, text: 'MERHABA' }),
      makeSegment({ segmentId: 'f1', status: SegmentStatus.FINAL, text: 'Merhaba' }),
    ];

    await exporter.exportAsText(segments, '/tmp/test.txt');
    const written = mockWrite.mock.calls[0][0] as string;
    expect(written).toContain('Merhaba');
    expect(written).not.toContain('MERHABA');
  });

  it('TP-CLIENT-STORE-004c: exportAsText includes formatted HH:MM:SS timestamps', async () => {
    const segments = [
      makeSegment({ status: SegmentStatus.FINAL, text: 'Test', timestampMs: 83456 }),
    ];
    await exporter.exportAsText(segments, '/tmp/test.txt');
    const written = mockWrite.mock.calls[0][0] as string;
    expect(written).toMatch(/^\[00:01:23\]/);
  });

  it('TP-CLIENT-STORE-004d: exportAsText includes trailing PARTIAL when it is the last segment', async () => {
    const segments = [
      makeSegment({ status: SegmentStatus.FINAL, text: 'Birinci', timestampMs: 1000 }),
      makeSegment({ status: SegmentStatus.PARTIAL, text: 'İkinci…', timestampMs: 2000 }),
    ];
    await exporter.exportAsText(segments, '/tmp/test.txt');
    const written = mockWrite.mock.calls[0][0] as string;
    expect(written).toContain('İkinci…');
  });

  it('TP-CLIENT-STORE-004e: exportAsJson writes valid JSON containing all segments', async () => {
    const segments = [makeSegment({ status: SegmentStatus.FINAL, text: 'Evet' })];
    await exporter.exportAsJson(segments, '/tmp/test.json');
    const written = mockWrite.mock.calls[0][0] as string;
    const parsed = JSON.parse(written) as TranscriptSegment[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].text).toBe('Evet');
  });

  it('TP-CLIENT-STORE-004f: exportAsJson includes PARTIAL segments', async () => {
    const segments = [makeSegment({ status: SegmentStatus.PARTIAL, text: 'EVET' })];
    await exporter.exportAsJson(segments, '/tmp/test.json');
    const written = mockWrite.mock.calls[0][0] as string;
    const parsed = JSON.parse(written) as TranscriptSegment[];
    expect(parsed).toHaveLength(1);
    expect(parsed[0].status).toBe(SegmentStatus.PARTIAL);
  });

  it('TP-CLIENT-STORE-004g: exportAsText joins multiple segments with newlines', async () => {
    const segments = [
      makeSegment({ status: SegmentStatus.FINAL, text: 'Birinci', timestampMs: 1000 }),
      makeSegment({ status: SegmentStatus.FINAL, text: 'İkinci', timestampMs: 2000 }),
    ];
    await exporter.exportAsText(segments, '/tmp/test.txt');
    const written = mockWrite.mock.calls[0][0] as string;
    expect(written).toContain('Birinci');
    expect(written).toContain('İkinci');
    expect(written.split('\n')).toHaveLength(2);
  });
});
