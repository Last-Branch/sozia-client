import type { TranscriptSegment } from '../common/models';

const REQUIRED_KEYS: ReadonlyArray<keyof TranscriptSegment> = [
  'segmentId',
  'sessionId',
  'status',
  'text',
  'source',
  'confidence',
  'timestampMs',
  'durationMs',
  'createdAtMs',
  'replacesSegmentId',
];

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

    for (const key of REQUIRED_KEYS) {
      if (!(key in parsed)) return null;
    }

    return parsed as unknown as TranscriptSegment;
  }
}
