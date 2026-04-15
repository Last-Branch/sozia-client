import { File } from 'expo-file-system/next';

import { SegmentStatus, type TranscriptSegment } from '@common/models';

/**
 * Exports a transcript timeline to a local file.
 *
 * Stateless utility — accepts a segment snapshot and a target path per call.
 * Does not hold a reference to TranscriptStore.
 *
 * Collaborators: reads from {@link TranscriptStore} via caller-provided snapshot.
 *
 * Thread/concurrency: stateless and safe to call from any async context.
 */
export class TranscriptExporter {
  /**
   * Export segments as a plain-text file, one segment per line.
   *
   * Only FINAL segments are included, except when the last segment in the
   * timeline is still PARTIAL — it is kept to ensure the final context is
   * not lost (per LLD Section 3.2.6).
   *
   * @param segments - Ordered transcript segments to export.
   * @param filePath - Absolute path for the output file.
   */
  async exportAsText(segments: TranscriptSegment[], filePath: string): Promise<void> {
    const included = this._finalsPlusTrailingPartial(segments);
    const text = included
      .map((s) => `[${TranscriptExporter._formatTimestamp(s.timestampMs)}] ${s.text}`)
      .join('\n');
    const file = new File(filePath);
    file.write(text);
  }

  /**
   * Export all segments (PARTIAL and FINAL) as a JSON file.
   * Includes all metadata fields, suitable for debugging or archival.
   *
   * @param segments - Ordered transcript segments to export.
   * @param filePath - Absolute path for the output file.
   */
  async exportAsJson(segments: TranscriptSegment[], filePath: string): Promise<void> {
    const json = JSON.stringify(segments, null, 2);
    const file = new File(filePath);
    file.write(json);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns all FINAL segments, plus the trailing PARTIAL if the last segment
   * in the timeline hasn't been finalized yet.
   */
  private _finalsPlusTrailingPartial(segments: TranscriptSegment[]): TranscriptSegment[] {
    const finals = segments.filter((s) => s.status === SegmentStatus.FINAL);
    if (segments.length > 0) {
      const last = segments[segments.length - 1];
      if (last.status === SegmentStatus.PARTIAL) {
        finals.push(last);
      }
    }
    return finals;
  }

  /**
   * Formats a session-relative millisecond timestamp as `HH:MM:SS`.
   * @param ms - Milliseconds since session start.
   */
  private static _formatTimestamp(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
}
