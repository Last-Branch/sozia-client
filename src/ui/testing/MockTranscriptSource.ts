import { ModalityType, SegmentStatus, type TranscriptSegment } from '../../common/models';
import type { TranscriptStore } from '../../store/TranscriptStore';

const LINES = [
  { partial: 'Merhaba, bugün size nasıl…', final: 'Merhaba, bugün size nasıl yardımcı olabilirim?' },
  { partial: 'Evet, anlıyorum sizi…', final: 'Evet, sizi anlıyorum. Devam edebilirsiniz.' },
  { partial: 'Teşekkür ederim…', final: 'Çok teşekkür ederim, iyi günler.' },
  { partial: 'Bugün hava çok…', final: 'Bugün hava çok güzel, değil mi?' },
  { partial: 'Bir dakika lütfen…', final: 'Bir dakika lütfen, hemen geliyorum.' },
];

const SOURCES: ModalityType[] = [
  ModalityType.ASR,
  ModalityType.LIP_READING,
  ModalityType.TSL_RECOGNITION,
  ModalityType.ASR,
  ModalityType.LIP_READING,
];

const CONFIDENCES = [0.91, 0.85, 0.42, 0.88, 0.38];

const PARTIAL_INTERVAL_MS = 2000;
const FINAL_DELAY_MS = 1500;

let _idCounter = 0;
function nextId(): string {
  return `mock-${++_idCounter}`;
}

export class MockTranscriptSource {
  private store: TranscriptStore;
  private sessionId: string;
  private running = false;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private lineIdx = 0;
  private pendingPartialId: string | null = null;

  constructor(store: TranscriptStore, sessionId: string) {
    this.store = store;
    this.sessionId = sessionId;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleNext(PARTIAL_INTERVAL_MS);
  }

  stop(): void {
    this.running = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  private scheduleNext(delayMs: number): void {
    this.timerId = setTimeout(() => {
      if (!this.running) return;
      this.tick();
    }, delayMs);
  }

  private tick(): void {
    const now = Date.now();
    const idx = this.lineIdx % LINES.length;
    const line = LINES[idx];
    const source = SOURCES[idx];
    const confidence = CONFIDENCES[idx];

    if (this.pendingPartialId === null) {
      const id = nextId();
      const segment: TranscriptSegment = {
        segmentId: id,
        sessionId: this.sessionId,
        status: SegmentStatus.PARTIAL,
        text: line.partial,
        source,
        confidence: confidence * 0.8,
        timestampMs: now,
        durationMs: 500,
        createdAtMs: now,
        replacesSegmentId: null,
      };
      this.store.receiveSegment(segment);
      this.pendingPartialId = id;
      this.scheduleNext(FINAL_DELAY_MS);
    } else {
      const segment: TranscriptSegment = {
        segmentId: nextId(),
        sessionId: this.sessionId,
        status: SegmentStatus.FINAL,
        text: line.final,
        source,
        confidence,
        timestampMs: now,
        durationMs: 800,
        createdAtMs: now,
        replacesSegmentId: this.pendingPartialId,
      };
      this.store.receiveSegment(segment);
      this.pendingPartialId = null;
      this.lineIdx++;
      this.scheduleNext(PARTIAL_INTERVAL_MS);
    }
  }
}
