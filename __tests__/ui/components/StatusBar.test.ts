/**
 * @jest-environment node
 */
import { SessionState, type PipelineHealth } from '@common/models';
import {
  getStatusBanner,
  type Banner,
} from '@/ui/components/StatusBar/helpers';

function makeAudioHealth(overrides: Partial<PipelineHealth> = {}): PipelineHealth {
  return {
    sessionId: 'test',
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
    sessionId: 'test',
    pipeline: 'video',
    available: true,
    fps: 28,
    snr: null,
    faceDetected: true,
    lastUpdatedMs: 1000,
    ...overrides,
  };
}

describe('getStatusBanner', () => {
  it('returns RUNNING banner for RUNNING state', () => {
    const banner = getStatusBanner(SessionState.RUNNING, []);
    expect(banner).not.toBeNull();
    expect(banner!.messageKey).toBe('health.sessionActive');
    expect(banner!.bg).toContain('green');
  });

  it('returns INITIALIZING banner', () => {
    const banner = getStatusBanner(SessionState.INITIALIZING, []);
    expect(banner).not.toBeNull();
    expect(banner!.bg).toContain('blue');
  });

  it('returns PAUSED banner', () => {
    const banner = getStatusBanner(SessionState.PAUSED, []);
    expect(banner).not.toBeNull();
    expect(banner!.bg).toContain('yellow');
  });

  it('returns null for IDLE state', () => {
    expect(getStatusBanner(SessionState.IDLE, [])).toBeNull();
  });

  it('returns ERROR banner with showRestart flag', () => {
    const banner = getStatusBanner(SessionState.ERROR, []);
    expect(banner).not.toBeNull();
    expect(banner!.bg).toContain('red');
    expect(banner!.showRestart).toBe(true);
  });

  it('returns generic DEGRADED banner when no health reports', () => {
    const banner = getStatusBanner(SessionState.DEGRADED, []);
    expect(banner).not.toBeNull();
    expect(banner!.bg).toContain('orange');
  });

  it('returns mic-specific DEGRADED banner when audio unavailable', () => {
    const health = [makeAudioHealth({ available: false })];
    const banner = getStatusBanner(SessionState.DEGRADED, health);
    expect(banner).not.toBeNull();
    expect(banner!.messageKey).toBe('health.microphoneUnavailable');
  });

  it('returns no-face DEGRADED banner when video has no face detected', () => {
    const health = [makeVideoHealth({ available: true, faceDetected: false })];
    const banner = getStatusBanner(SessionState.DEGRADED, health);
    expect(banner).not.toBeNull();
    expect(banner!.messageKey).toBe('health.noFaceDetected');
  });

  it('returns camera-obstructed DEGRADED banner when video unavailable', () => {
    const health = [makeVideoHealth({ available: false })];
    const banner = getStatusBanner(SessionState.DEGRADED, health);
    expect(banner).not.toBeNull();
    expect(banner!.messageKey).toBe('health.cameraObstructed');
  });

  it('returns low-signal DEGRADED banner when audio SNR is low', () => {
    const health = [makeAudioHealth({ available: true, snr: 3 })];
    const banner = getStatusBanner(SessionState.DEGRADED, health);
    expect(banner).not.toBeNull();
    expect(banner!.messageKey).toBe('health.lowSignalQuality');
  });
});
