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
// TP-CLIENT-STORE-001: Basic append and retrieval
// ---------------------------------------------------------------------------

describe('TranscriptStore — append and retrieval', () => {
  let store: TranscriptStore;

  beforeEach(() => {
    store = new TranscriptStore();
    _segCounter = 0;
  });

  it('TP-CLIENT-STORE-001a: starts empty', () => {
    expect(store.getAll()).toEqual([]);
    expect(store.size).toBe(0);
  });

  it('TP-CLIENT-STORE-001b: append adds a segment', () => {
    store.append(makeSegment());
    expect(store.size).toBe(1);
  });

  it('TP-CLIENT-STORE-001c: getAll returns a copy, not the internal array', () => {
    store.append(makeSegment());
    const first = store.getAll();
    const second = store.getAll();
    expect(first).not.toBe(second); // different references
    expect(first).toEqual(second);  // same contents
  });

  it('TP-CLIENT-STORE-001d: segments are sorted by timestampMs after append', () => {
    store.append(makeSegment({ timestampMs: 3000 }));
    store.append(makeSegment({ timestampMs: 1000 }));
    store.append(makeSegment({ timestampMs: 2000 }));

    const timestamps = store.getAll().map((s) => s.timestampMs);
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

    store.append(partial);
    store.append(final);

    expect(store.size).toBe(1);
    expect(store.getAll()[0].text).toBe('Merhaba dünya');
    expect(store.getAll()[0].status).toBe(SegmentStatus.FINAL);
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

    store.append(p1);
    store.append(p2);
    store.append(f1);

    expect(store.size).toBe(2);
    expect(store.getAll()[0].segmentId).toBe('f1');
    expect(store.getAll()[1].segmentId).toBe('p2');
  });

  it('TP-CLIENT-STORE-002c: FINAL is appended if referenced PARTIAL is not found', () => {
    const final = makeSegment({
      segmentId: 'f1',
      status: SegmentStatus.FINAL,
      replacesSegmentId: 'nonexistent',
    });

    store.append(final);

    expect(store.size).toBe(1);
    expect(store.getAll()[0].segmentId).toBe('f1');
  });
});

// ---------------------------------------------------------------------------
// TP-CLIENT-STORE-003: Clear and observer
// ---------------------------------------------------------------------------

describe('TranscriptStore — clear and onUpdate', () => {
  let store: TranscriptStore;

  beforeEach(() => {
    store = new TranscriptStore();
    _segCounter = 0;
  });

  it('TP-CLIENT-STORE-003a: clear removes all segments', () => {
    store.append(makeSegment());
    store.append(makeSegment());
    store.clear();
    expect(store.size).toBe(0);
  });

  it('TP-CLIENT-STORE-003b: onUpdate fires on append with the current snapshot', () => {
    const received: TranscriptSegment[][] = [];
    store.onUpdate((s) => received.push(s));

    store.append(makeSegment());
    expect(received).toHaveLength(1);
    expect(received[0]).toHaveLength(1);
  });

  it('TP-CLIENT-STORE-003c: onUpdate fires on clear with an empty array', () => {
    store.append(makeSegment());
    const received: TranscriptSegment[][] = [];
    store.onUpdate((s) => received.push(s));

    store.clear();
    expect(received).toHaveLength(1);
    expect(received[0]).toHaveLength(0);
  });

  it('TP-CLIENT-STORE-003d: unsubscribe stops update delivery', () => {
    const received: TranscriptSegment[][] = [];
    const unsub = store.onUpdate((s) => received.push(s));

    store.append(makeSegment());
    unsub();
    store.append(makeSegment());

    expect(received).toHaveLength(1);
  });

  it('TP-CLIENT-STORE-003e: multiple listeners receive updates simultaneously', () => {
    const countA = { n: 0 };
    const countB = { n: 0 };
    store.onUpdate(() => countA.n++);
    store.onUpdate(() => countB.n++);

    store.append(makeSegment());
    expect(countA.n).toBe(1);
    expect(countB.n).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// TP-CLIENT-STORE-004: TranscriptExporter
// ---------------------------------------------------------------------------

describe('TranscriptExporter', () => {
  let store: TranscriptStore;
  let exporter: TranscriptExporter;

  beforeEach(() => {
    store = new TranscriptStore();
    exporter = new TranscriptExporter(store);
    _segCounter = 0;
  });

  it('TP-CLIENT-STORE-004a: exportAsText returns empty string when store is empty', () => {
    expect(exporter.exportAsText()).toBe('');
  });

  it('TP-CLIENT-STORE-004b: exportAsText includes only FINAL segments', () => {
    store.append(makeSegment({ segmentId: 'p1', status: SegmentStatus.PARTIAL, text: 'MERHABA' }));
    store.append(makeSegment({ segmentId: 'f1', status: SegmentStatus.FINAL, text: 'Merhaba' }));

    const text = exporter.exportAsText({ includeTimestamps: false });
    expect(text).toBe('Merhaba');
    expect(text).not.toContain('MERHABA');
  });

  it('TP-CLIENT-STORE-004c: exportAsText includes formatted timestamps by default', () => {
    store.append(makeSegment({ status: SegmentStatus.FINAL, text: 'Test', timestampMs: 83456 }));
    const text = exporter.exportAsText();
    expect(text).toMatch(/^\[01:23\.456\]/);
  });

  it('TP-CLIENT-STORE-004d: exportAsText omits timestamps when includeTimestamps is false', () => {
    store.append(makeSegment({ status: SegmentStatus.FINAL, text: 'Tamam' }));
    const text = exporter.exportAsText({ includeTimestamps: false });
    expect(text).toBe('Tamam');
    expect(text).not.toContain('[');
  });

  it('TP-CLIENT-STORE-004e: exportAsJson returns valid JSON containing all segments', () => {
    const seg = makeSegment({ status: SegmentStatus.FINAL, text: 'Evet' });
    store.append(seg);

    const json = exporter.exportAsJson();
    const parsed = JSON.parse(json) as TranscriptSegment[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].text).toBe('Evet');
  });

  it('TP-CLIENT-STORE-004f: exportAsJson includes PARTIAL segments', () => {
    store.append(makeSegment({ status: SegmentStatus.PARTIAL, text: 'EVET' }));
    const parsed = JSON.parse(exporter.exportAsJson()) as TranscriptSegment[];
    expect(parsed).toHaveLength(1);
    expect(parsed[0].status).toBe(SegmentStatus.PARTIAL);
  });

  it('TP-CLIENT-STORE-004g: exportAsText joins multiple segments with newlines', () => {
    store.append(makeSegment({ status: SegmentStatus.FINAL, text: 'Birinci', timestampMs: 1000 }));
    store.append(makeSegment({ status: SegmentStatus.FINAL, text: 'İkinci', timestampMs: 2000 }));

    const text = exporter.exportAsText({ includeTimestamps: false });
    expect(text).toBe('Birinci\nİkinci');
  });
});
