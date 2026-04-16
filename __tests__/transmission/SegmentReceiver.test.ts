/**
 * @jest-environment node
 */
/**
 * Unit tests — SegmentReceiver
 *
 * Verifies that incoming server JSON is correctly deserialized into
 * TranscriptSegment objects, and that malformed or unrelated messages
 * return null without throwing.
 *
 * Test plan reference: TP-CLIENT-TX-002
 */

import { SegmentReceiver } from '@/transmission/SegmentReceiver';
import { SegmentStatus, ModalityType } from '@common/models';
import type { TranscriptSegment } from '@common/models';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validPayload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: 'transcript_segment',
    segment_id: 'seg-1',
    session_id: 'session-1',
    status: SegmentStatus.FINAL,
    text: 'Merhaba',
    source: ModalityType.ASR,
    confidence: 0.9,
    timestamp_ms: 1000,
    duration_ms: 500,
    created_at_ms: 1_700_000_000_000,
    replaces_segment_id: null,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SegmentReceiver', () => {
  let receiver: SegmentReceiver;

  beforeEach(() => {
    receiver = new SegmentReceiver();
  });

  // -- happy path ------------------------------------------------------------

  it('returns a TranscriptSegment for valid input', () => {
    const result = receiver.deserialize(validPayload());
    expect(result).not.toBeNull();
  });

  it('maps segmentId correctly', () => {
    const result = receiver.deserialize(validPayload()) as TranscriptSegment;
    expect(result.segmentId).toBe('seg-1');
  });

  it('maps all required fields', () => {
    const result = receiver.deserialize(validPayload()) as TranscriptSegment;
    expect(result.sessionId).toBe('session-1');
    expect(result.status).toBe(SegmentStatus.FINAL);
    expect(result.text).toBe('Merhaba');
    expect(result.source).toBe(ModalityType.ASR);
    expect(result.confidence).toBe(0.9);
    expect(result.timestampMs).toBe(1000);
    expect(result.durationMs).toBe(500);
    expect(result.createdAtMs).toBe(1_700_000_000_000);
    expect(result.replacesSegmentId).toBeNull();
  });

  it('accepts a non-null replacesSegmentId for PARTIAL→FINAL revision', () => {
    const result = receiver.deserialize(
      validPayload({ replaces_segment_id: 'seg-0', status: SegmentStatus.FINAL }),
    ) as TranscriptSegment;
    expect(result.replacesSegmentId).toBe('seg-0');
  });

  it('accepts PARTIAL status', () => {
    const result = receiver.deserialize(validPayload({ status: SegmentStatus.PARTIAL })) as TranscriptSegment;
    expect(result.status).toBe(SegmentStatus.PARTIAL);
  });

  // -- wrong type discriminator ----------------------------------------------

  it('returns null for type "ready"', () => {
    expect(receiver.deserialize(JSON.stringify({ type: 'ready' }))).toBeNull();
  });

  it('returns null for type "session_init"', () => {
    expect(receiver.deserialize(JSON.stringify({ type: 'session_init', sessionId: 'x' }))).toBeNull();
  });

  it('returns null when type field is absent', () => {
    expect(receiver.deserialize(JSON.stringify({ segmentId: 'seg-1' }))).toBeNull();
  });

  // -- missing required fields -----------------------------------------------

  it('returns null when segment_id is missing', () => {
    expect(receiver.deserialize(validPayload({ segment_id: undefined }))).toBeNull();
  });

  it('returns null when session_id is missing', () => {
    expect(receiver.deserialize(validPayload({ session_id: undefined }))).toBeNull();
  });

  it('returns null when status is missing', () => {
    expect(receiver.deserialize(validPayload({ status: undefined }))).toBeNull();
  });

  it('returns null when text is missing', () => {
    expect(receiver.deserialize(validPayload({ text: undefined }))).toBeNull();
  });

  it('returns null when source is missing', () => {
    expect(receiver.deserialize(validPayload({ source: undefined }))).toBeNull();
  });

  it('returns null when confidence is missing', () => {
    expect(receiver.deserialize(validPayload({ confidence: undefined }))).toBeNull();
  });

  it('returns null when timestamp_ms is missing', () => {
    expect(receiver.deserialize(validPayload({ timestamp_ms: undefined }))).toBeNull();
  });

  it('returns null when duration_ms is missing', () => {
    expect(receiver.deserialize(validPayload({ duration_ms: undefined }))).toBeNull();
  });

  it('returns null when created_at_ms is missing', () => {
    expect(receiver.deserialize(validPayload({ created_at_ms: undefined }))).toBeNull();
  });

  it('returns null when replaces_segment_id key is absent entirely', () => {
    const payload = JSON.parse(validPayload());
    delete payload.replaces_segment_id;
    expect(receiver.deserialize(JSON.stringify(payload))).toBeNull();
  });

  // -- malformed input -------------------------------------------------------

  it('returns null for invalid JSON string', () => {
    expect(receiver.deserialize('not json')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(receiver.deserialize('')).toBeNull();
  });

  it('returns null for a JSON number (non-object)', () => {
    expect(receiver.deserialize('42')).toBeNull();
  });

  it('does not throw for any malformed input', () => {
    expect(() => receiver.deserialize('{broken')).not.toThrow();
    expect(() => receiver.deserialize('')).not.toThrow();
    expect(() => receiver.deserialize('null')).not.toThrow();
  });
});
