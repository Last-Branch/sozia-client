import { ModalityType, SegmentStatus, type TranscriptSegment } from '../../../common/models';

const CONFIDENCE_THRESHOLD = 0.50;

export interface TranscriptRow {
  segmentId: string;
  text: string;
  isPartial: boolean;
  lowConfidence: boolean;
  sourceLabel: string;
}

const SOURCE_LABEL_MAP: Record<ModalityType, string> = {
  [ModalityType.ASR]: 'transcript.sourceASR',
  [ModalityType.LIP_READING]: 'transcript.sourceLIP',
  [ModalityType.TSL_RECOGNITION]: 'transcript.sourceTSL',
  [ModalityType.GLOSS_TO_TEXT]: 'transcript.sourceFused',
};

export function mapSourceLabel(source: ModalityType): string {
  return SOURCE_LABEL_MAP[source] ?? 'transcript.sourceASR';
}

export function buildTranscriptRows(segments: TranscriptSegment[]): TranscriptRow[] {
  return segments.map((seg) => ({
    segmentId: seg.segmentId,
    text: seg.text,
    isPartial: seg.status === SegmentStatus.PARTIAL,
    lowConfidence: seg.confidence < CONFIDENCE_THRESHOLD,
    sourceLabel: mapSourceLabel(seg.source),
  }));
}
