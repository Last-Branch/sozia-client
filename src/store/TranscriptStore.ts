import type { TranscriptSegment } from '../common/models';

/**
 * Observable in-memory transcript timeline for the active session.
 *
 * Maintains an ordered list of {@link TranscriptSegment} objects sorted by
 * `timestampMs`. Handles the optimistic-then-revise pattern: when a FINAL
 * segment arrives with a non-null `replacesSegmentId`, the referenced PARTIAL
 * segment is replaced in-place (preserving display order); if the PARTIAL is
 * not found, the FINAL is appended as a new entry.
 *
 * Collaborators: {@link TranscriptExporter} reads snapshots from this store.
 * The UI `TranscriptView` subscribes via {@link onUpdate} to re-render on
 * every change.
 *
 * Thread/concurrency: JavaScript single-threaded — all mutations are
 * synchronous and safe to call from any async context.
 */
export class TranscriptStore {
  private segments: TranscriptSegment[] = [];
  private listeners = new Set<(segments: TranscriptSegment[]) => void>();

  /**
   * Add a new segment to the timeline.
   *
   * If `segment.replacesSegmentId` is non-null, the store first attempts to
   * replace the referenced segment in-place. If the referenced segment is not
   * found (e.g., already cleared), the segment is appended at the end.
   *
   * The timeline is kept sorted by `timestampMs` after every append.
   *
   * @param segment - The transcript segment to add or use as a replacement.
   */
  append(segment: TranscriptSegment): void {
    if (segment.replacesSegmentId !== null) {
      const idx = this.segments.findIndex(
        (s) => s.segmentId === segment.replacesSegmentId
      );
      if (idx !== -1) {
        this.segments[idx] = segment;
        this._notify();
        return;
      }
    }

    this.segments.push(segment);
    this.segments.sort((a, b) => a.timestampMs - b.timestampMs);
    this._notify();
  }

  /**
   * Remove all segments from the timeline.
   * Typically called when the user triggers a manual clear or a new session starts.
   */
  clear(): void {
    this.segments = [];
    this._notify();
  }

  /**
   * Returns a shallow copy of the current segment list, ordered by `timestampMs`.
   * Safe to iterate without holding a lock.
   *
   * @returns Ordered array of transcript segments.
   */
  getAll(): TranscriptSegment[] {
    return [...this.segments];
  }

  /**
   * Returns the number of segments currently in the timeline.
   */
  get size(): number {
    return this.segments.length;
  }

  /**
   * Register a callback that fires whenever the timeline changes (append or clear).
   * Returns an unsubscribe function; call it to stop receiving updates.
   * Multiple listeners may be registered simultaneously.
   *
   * @param callback - Receives the full ordered segment list on every change.
   * @returns Unsubscribe function.
   */
  onUpdate(callback: (segments: TranscriptSegment[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private _notify(): void {
    const snapshot = this.getAll();
    this.listeners.forEach((cb) => cb(snapshot));
  }
}
