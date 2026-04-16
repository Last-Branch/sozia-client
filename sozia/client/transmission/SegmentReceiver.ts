import type { TranscriptSegment } from '@common/models';

const REQUIRED_SNAKE_KEYS = [
  'segment_id',
  'session_id',
  'status',
  'text',
  'source',
  'confidence',
  'timestamp_ms',
  'duration_ms',
  'created_at_ms',
  'replaces_segment_id',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Deserializes incoming server JSON into {@link TranscriptSegment} objects.
 *
 * Returns `null` for any message that is not a valid `transcript_segment`:
 * wrong type discriminator, missing required fields, or malformed JSON.
 * Never throws.
 */
export class SegmentReceiver {
  deserialize(json: string): TranscriptSegment | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return null;
    }

    if (!isRecord(parsed)) return null;
    if (parsed['type'] !== 'transcript_segment') return null;

    for (const key of REQUIRED_SNAKE_KEYS) {
      if (!(key in parsed)) return null;
    }

    return {
      segmentId:         parsed['segment_id'] as string,
      sessionId:         parsed['session_id'] as string,
      status:            parsed['status'] as TranscriptSegment['status'],
      text:              parsed['text'] as string,
      source:            parsed['source'] as TranscriptSegment['source'],
      confidence:        parsed['confidence'] as number,
      timestampMs:       parsed['timestamp_ms'] as number,
      durationMs:        parsed['duration_ms'] as number,
      createdAtMs:       parsed['created_at_ms'] as number,
      replacesSegmentId: parsed['replaces_segment_id'] as string | null,
    };
  }
}
