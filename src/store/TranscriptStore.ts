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
 * The UI `TranscriptView` subscribes via {@link subscribe} to re-render on
 * every change.
 *
 * Thread/concurrency: JavaScript single-threaded — all mutations are
 * synchronous and safe to call from any async context.
 */
export class TranscriptStore {
  private segments: TranscriptSegment[] = [];
  private segmentIndex = new Map<string, number>();
  private listeners = new Set<(segments: TranscriptSegment[]) => void>();

  /**
   * Core method. If `segment.replacesSegmentId` is non-null, finds and
   * replaces the target segment. Otherwise, appends. Notifies all listeners.
   *
   * @param segment - The transcript segment to add or use as a replacement.
   */
  receiveSegment(segment: TranscriptSegment): void {
    if (segment.replacesSegmentId !== null) {
      const idx = this.segmentIndex.get(segment.replacesSegmentId);
      if (idx !== undefined && idx < this.segments.length && this.segments[idx].segmentId === segment.replacesSegmentId) {
        this.segmentIndex.delete(segment.replacesSegmentId);
        this.segments[idx] = segment;
        this.segmentIndex.set(segment.segmentId, idx);
        this._notify();
        return;
      }
    }

    this.segments.push(segment);
    this.segments.sort((a, b) => a.timestampMs - b.timestampMs);
    this._rebuildIndex();
    this._notify();
  }

  /**
   * Remove all segments from the timeline.
   * Typically called when the user triggers a manual clear or a new session starts.
   */
  clear(): void {
    this.segments = [];
    this.segmentIndex.clear();
    this._notify();
  }

  /**
   * Returns a read-only copy of the current segment list, ordered by `timestampMs`.
   *
   * @returns Ordered array of transcript segments.
   */
  getSegments(): TranscriptSegment[] {
    return [...this.segments];
  }

  /**
   * Looks up a segment by ID.
   *
   * @param segmentId - The UUID of the segment to find.
   * @returns The segment if found, or null.
   */
  getSegmentById(segmentId: string): TranscriptSegment | null {
    const idx = this.segmentIndex.get(segmentId);
    if (idx === undefined) return null;
    return this.segments[idx] ?? null;
  }

  /**
   * Returns the number of segments currently in the timeline.
   */
  get size(): number {
    return this.segments.length;
  }

  /**
   * Register a callback that fires whenever the timeline changes.
   * Returns an unsubscribe function; call it to stop receiving updates.
   *
   * @param listener - Receives the full ordered segment list on every change.
   * @returns Unsubscribe function.
   */
  subscribe(listener: (segments: TranscriptSegment[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private _notify(): void {
    const snapshot = this.getSegments();
    this.listeners.forEach((cb) => cb(snapshot));
  }

  private _rebuildIndex(): void {
    this.segmentIndex.clear();
    for (let i = 0; i < this.segments.length; i++) {
      this.segmentIndex.set(this.segments[i].segmentId, i);
    }
  }
}
