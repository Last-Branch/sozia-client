import { ModalityPath, SessionState, type PipelineHealth } from '@common/models';
import { SPEECH_FACE_IN_FRAME_MIN_RATIO } from '@/ui/healthThresholds';

export interface SessionStateAccessor {
  getState: () => SessionState;
  setState: (state: SessionState) => void;
  getHealthReports: () => PipelineHealth[];
  setHealthReports: (reports: PipelineHealth[]) => void;
  getModalityPath: () => ModalityPath | null;
}

export interface SessionActions {
  onPipelineHealthChanged: (health: PipelineHealth) => void;
  onConnectionLost: () => void;
}

function sameSignVisibilityKeys(a: PipelineHealth, b: PipelineHealth): boolean {
  const aa = a.signVisibilityMessageKeys ?? null;
  const bb = b.signVisibilityMessageKeys ?? null;
  if (aa === null && bb === null) return true;
  if (aa === null || bb === null || aa.length !== bb.length) return false;
  return aa.every((v, i) => v === bb[i]);
}

export function buildSessionActions(accessor: SessionStateAccessor): SessionActions {
  function speechFaceBelowThreshold(reports: PipelineHealth[]): boolean {
    if (accessor.getModalityPath() !== ModalityPath.SPEECH) return false;
    const video = reports.find((r) => r.pipeline === 'video');
    if (!video?.available) return false;
    const r = video.faceFrameRatio;
    return typeof r === 'number' && Number.isFinite(r) && r < SPEECH_FACE_IN_FRAME_MIN_RATIO;
  }

  function signVisibilitySustainedLow(reports: PipelineHealth[]): boolean {
    if (accessor.getModalityPath() !== ModalityPath.SIGN) return false;
    const video = reports.find((r) => r.pipeline === 'video');
    if (!video?.available) return false;
    return video.signVisibilitySustainedLow === true;
  }

  function onPipelineHealthChanged(health: PipelineHealth): void {
    const current = accessor.getHealthReports();
    const idx = current.findIndex((r) => r.pipeline === health.pipeline);
    const existing = idx >= 0 ? current[idx] : null;

    // Skip the state update (and React re-render) if observable fields are unchanged.
    if (
      existing != null &&
      existing.available === health.available &&
      existing.fps === health.fps &&
      existing.faceDetected === health.faceDetected &&
      (existing.faceFrameRatio ?? null) === (health.faceFrameRatio ?? null) &&
      (existing.signVisibilitySustainedLow ?? false) === (health.signVisibilitySustainedLow ?? false) &&
      sameSignVisibilityKeys(existing, health)
    ) return;

    const updated = idx >= 0
      ? [...current.slice(0, idx), health, ...current.slice(idx + 1)]
      : [...current, health];
    accessor.setHealthReports(updated);

    const state = accessor.getState();
    if (state === SessionState.ERROR || state === SessionState.IDLE) return;

    const hasUnavailable = updated.some((r) => !r.available);
    const speechLowFace = speechFaceBelowThreshold(updated);
    const signLowVis = signVisibilitySustainedLow(updated);
    const shouldDegrade = hasUnavailable || speechLowFace || signLowVis;

    if (shouldDegrade && state === SessionState.RUNNING) {
      accessor.setState(SessionState.DEGRADED);
    } else if (!shouldDegrade && state === SessionState.DEGRADED) {
      accessor.setState(SessionState.RUNNING);
    }
  }

  function onConnectionLost(): void {
    if (accessor.getState() === SessionState.IDLE) return;
    accessor.setState(SessionState.ERROR);
  }

  return { onPipelineHealthChanged, onConnectionLost };
}
