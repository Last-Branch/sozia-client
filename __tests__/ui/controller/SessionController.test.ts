/**
 * @jest-environment node
 */
import { SessionState, ModalityPath, type PipelineHealth } from '../../../src/common/models';
import {
  buildSessionActions,
  type SessionActions,
} from '../../../src/ui/controller/sessionActions';
import { TranscriptStore } from '../../../src/store/TranscriptStore';

function makeAudioHealth(overrides: Partial<PipelineHealth> = {}): PipelineHealth {
  return {
    sessionId: 'test-session',
    pipeline: 'audio',
    available: true,
    fps: null,
    snr: 12,
    faceDetected: null,
    lastUpdatedMs: 1000,
    ...overrides,
  };
}

function makeVideoHealth(overrides: Partial<PipelineHealth> = {}): PipelineHealth {
  return {
    sessionId: 'test-session',
    pipeline: 'video',
    available: true,
    fps: 28,
    snr: null,
    faceDetected: true,
    lastUpdatedMs: 1000,
    ...overrides,
  };
}

describe('sessionActions — onPipelineHealthChanged', () => {
  let store: TranscriptStore;
  let stateUpdates: SessionState[];
  let healthUpdates: PipelineHealth[][];
  let actions: SessionActions;

  beforeEach(() => {
    store = new TranscriptStore();
    stateUpdates = [];
    healthUpdates = [];
    actions = buildSessionActions({
      getState: () => stateUpdates.length > 0 ? stateUpdates[stateUpdates.length - 1] : SessionState.RUNNING,
      setState: (s) => stateUpdates.push(s),
      getHealthReports: () => healthUpdates.length > 0 ? healthUpdates[healthUpdates.length - 1] : [],
      setHealthReports: (h) => healthUpdates.push(h),
    });
  });

  it('upserts audio health into reports', () => {
    const health = makeAudioHealth();
    actions.onPipelineHealthChanged(health);
    expect(healthUpdates.length).toBeGreaterThanOrEqual(1);
    const latest = healthUpdates[healthUpdates.length - 1];
    expect(latest).toHaveLength(1);
    expect(latest[0].pipeline).toBe('audio');
  });

  it('upserts video health alongside existing audio health', () => {
    actions.onPipelineHealthChanged(makeAudioHealth());
    actions.onPipelineHealthChanged(makeVideoHealth());
    const latest = healthUpdates[healthUpdates.length - 1];
    expect(latest).toHaveLength(2);
  });

  it('transitions RUNNING → DEGRADED when a pipeline becomes unavailable', () => {
    actions.onPipelineHealthChanged(makeAudioHealth({ available: false }));
    expect(stateUpdates).toContain(SessionState.DEGRADED);
  });

  it('does NOT transition to DEGRADED if already in ERROR state', () => {
    stateUpdates.push(SessionState.ERROR);
    actions = buildSessionActions({
      getState: () => SessionState.ERROR,
      setState: (s) => stateUpdates.push(s),
      getHealthReports: () => [],
      setHealthReports: (h) => healthUpdates.push(h),
    });
    actions.onPipelineHealthChanged(makeAudioHealth({ available: false }));
    const nonError = stateUpdates.filter((s) => s !== SessionState.ERROR);
    expect(nonError.filter((s) => s === SessionState.DEGRADED)).toHaveLength(0);
  });
});

describe('sessionActions — onConnectionLost', () => {
  it('transitions to ERROR state', () => {
    const stateUpdates: SessionState[] = [];
    const actions = buildSessionActions({
      getState: () => SessionState.RUNNING,
      setState: (s) => stateUpdates.push(s),
      getHealthReports: () => [],
      setHealthReports: () => {},
    });
    actions.onConnectionLost();
    expect(stateUpdates).toContain(SessionState.ERROR);
  });
});
