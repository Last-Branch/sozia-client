import type { TranscriptSegment } from '../common/models';
import type { TranscriptStore } from './TranscriptStore';

/** Plain-text export options. */
export interface TextExportOptions {
  /**
   * If true, each line is prefixed with a `[mm:ss.ms]` timestamp.
   * Defaults to true.
   */
  includeTimestamps?: boolean;
}

/**
 * Exports the contents of a {@link TranscriptStore} to portable formats.
 *
 * Reads a snapshot from the store at export time — mutations after the call
 * return do not affect the export output.
 *
 * Collaborators: reads from {@link TranscriptStore}.
 *
 * Thread/concurrency: stateless and safe to call from any async context.
 */
export class TranscriptExporter {
  private readonly store: TranscriptStore;

  /**
   * @param store - The transcript store to export from.
   */
  constructor(store: TranscriptStore) {
    this.store = store;
  }

  /**
   * Export all FINAL segments as a plain-text string, one segment per line.
   * PARTIAL segments are excluded — only committed, fused text is exported.
   *
   * @param options - Optional formatting controls.
   * @returns UTF-8 plain text. Empty string if no FINAL segments exist.
   *
   * @example
   * const text = exporter.exportAsText({ includeTimestamps: true });
   * // "[00:01.320] Merhaba, nasılsın?\n[00:03.750] İyiyim, teşekkür ederim."
   */
  exportAsText(options: TextExportOptions = {}): string {
    const { includeTimestamps = true } = options;
    const finals = this._finalSegments();

    return finals
      .map((s) => {
        if (includeTimestamps) {
          return `[${TranscriptExporter._formatTimestamp(s.timestampMs)}] ${s.text}`;
        }
        return s.text;
      })
      .join('\n');
  }

  /**
   * Export all segments (PARTIAL and FINAL) as a JSON string.
   * Includes all metadata fields, suitable for debugging or archival.
   *
   * @returns JSON string containing an array of {@link TranscriptSegment} objects.
   *
   * @example
   * const json = exporter.exportAsJson();
   * // '[{"segmentId":"...","status":"FINAL","text":"Merhaba",...}]'
   */
  exportAsJson(): string {
    return JSON.stringify(this.store.getAll(), null, 2);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _finalSegments(): TranscriptSegment[] {
    return this.store.getAll().filter((s) => s.status === 'FINAL');
  }

  /**
   * Formats a session-relative millisecond timestamp as `mm:ss.ms`.
   * @param ms - Milliseconds since session start.
   * @returns Formatted string, e.g. `"01:23.456"`.
   */
  private static _formatTimestamp(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const millis = ms % 1000;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  }
}
