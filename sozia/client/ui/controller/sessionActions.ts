import { SessionState, type PipelineHealth } from '@common/models';

export interface SessionStateAccessor {
  getState: () => SessionState;
  setState: (state: SessionState) => void;
  getHealthReports: () => PipelineHealth[];
  setHealthReports: (reports: PipelineHealth[]) => void;
}

export interface SessionActions {
  onPipelineHealthChanged: (health: PipelineHealth) => void;
  onConnectionLost: () => void;
}

export function buildSessionActions(accessor: SessionStateAccessor): SessionActions {
  function onPipelineHealthChanged(health: PipelineHealth): void {
    const current = accessor.getHealthReports();
    const idx = current.findIndex((r) => r.pipeline === health.pipeline);
    const updated = idx >= 0
      ? [...current.slice(0, idx), health, ...current.slice(idx + 1)]
      : [...current, health];
    accessor.setHealthReports(updated);

    const state = accessor.getState();
    if (state === SessionState.ERROR || state === SessionState.IDLE) return;

    const hasUnavailable = updated.some((r) => !r.available);
    if (hasUnavailable && state === SessionState.RUNNING) {
      accessor.setState(SessionState.DEGRADED);
    } else if (!hasUnavailable && state === SessionState.DEGRADED) {
      accessor.setState(SessionState.RUNNING);
    }
  }

  function onConnectionLost(): void {
    if (accessor.getState() === SessionState.IDLE) return;
    accessor.setState(SessionState.ERROR);
  }

  return { onPipelineHealthChanged, onConnectionLost };
}
