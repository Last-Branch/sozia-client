/**
 * @jest-environment node
 */
import { SessionState, ModalityPath, type PipelineHealth } from '@common/models';
import {
  buildSessionActions,
  type SessionActions,
} from '@/ui/controller/sessionActions';
import { TranscriptStore } from '@/store/TranscriptStore';

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
      getModalityPath: () => null,
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

  it('transitions RUNNING → DEGRADED on SPEECH when face frame ratio is below threshold', () => {
    let modality: ModalityPath | null = ModalityPath.SPEECH;
    actions = buildSessionActions({
      getState: () => (stateUpdates.length > 0 ? stateUpdates[stateUpdates.length - 1] : SessionState.RUNNING),
      setState: (s) => stateUpdates.push(s),
      getHealthReports: () => (healthUpdates.length > 0 ? healthUpdates[healthUpdates.length - 1] : []),
      setHealthReports: (h) => healthUpdates.push(h),
      getModalityPath: () => modality,
    });
    actions.onPipelineHealthChanged(makeVideoHealth({ available: true, faceFrameRatio: 0.4 }));
    expect(stateUpdates).toContain(SessionState.DEGRADED);
  });

  it('does not degrade on SIGN when face frame ratio is low', () => {
    let modality: ModalityPath | null = ModalityPath.SIGN;
    actions = buildSessionActions({
      getState: () => (stateUpdates.length > 0 ? stateUpdates[stateUpdates.length - 1] : SessionState.RUNNING),
      setState: (s) => stateUpdates.push(s),
      getHealthReports: () => (healthUpdates.length > 0 ? healthUpdates[healthUpdates.length - 1] : []),
      setHealthReports: (h) => healthUpdates.push(h),
      getModalityPath: () => modality,
    });
    actions.onPipelineHealthChanged(makeVideoHealth({ available: true, faceFrameRatio: 0.2 }));
    expect(stateUpdates.filter((s) => s === SessionState.DEGRADED)).toHaveLength(0);
  });

  it('transitions RUNNING → DEGRADED on SIGN when sign visibility has been sustained low', () => {
    let modality: ModalityPath | null = ModalityPath.SIGN;
    actions = buildSessionActions({
      getState: () => (stateUpdates.length > 0 ? stateUpdates[stateUpdates.length - 1] : SessionState.RUNNING),
      setState: (s) => stateUpdates.push(s),
      getHealthReports: () => (healthUpdates.length > 0 ? healthUpdates[healthUpdates.length - 1] : []),
      setHealthReports: (h) => healthUpdates.push(h),
      getModalityPath: () => modality,
    });
    actions.onPipelineHealthChanged(
      makeVideoHealth({
        available: true,
        faceFrameRatio: 0.9,
        signVisibilitySustainedLow: true,
        signVisibilityMessageKeys: ['health.signLowHands'],
      }),
    );
    expect(stateUpdates).toContain(SessionState.DEGRADED);
  });

  it('does NOT transition to DEGRADED if already in ERROR state', () => {
    stateUpdates.push(SessionState.ERROR);
    actions = buildSessionActions({
      getState: () => SessionState.ERROR,
      setState: (s) => stateUpdates.push(s),
      getHealthReports: () => [],
      setHealthReports: (h) => healthUpdates.push(h),
      getModalityPath: () => null,
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
      getModalityPath: () => null,
    });
    actions.onConnectionLost();
    expect(stateUpdates).toContain(SessionState.ERROR);
  });
});
