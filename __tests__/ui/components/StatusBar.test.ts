/**
 * @jest-environment node
 */
import { ModalityPath, SessionState, type PipelineHealth } from '@common/models';
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
    const banner = getStatusBanner(SessionState.RUNNING, [], null);
    expect(banner).not.toBeNull();
    expect(banner!.messageKey).toBe('health.sessionActive');
    expect(banner!.bg).toContain('green');
  });

  it('returns INITIALIZING banner', () => {
    const banner = getStatusBanner(SessionState.INITIALIZING, [], null);
    expect(banner).not.toBeNull();
    expect(banner!.bg).toContain('blue');
  });

  it('returns PAUSED banner', () => {
    const banner = getStatusBanner(SessionState.PAUSED, [], null);
    expect(banner).not.toBeNull();
    expect(banner!.bg).toContain('yellow');
  });

  it('returns null for IDLE state', () => {
    expect(getStatusBanner(SessionState.IDLE, [], null)).toBeNull();
  });

  it('returns ERROR banner with showRestart flag', () => {
    const banner = getStatusBanner(SessionState.ERROR, [], null);
    expect(banner).not.toBeNull();
    expect(banner!.bg).toContain('red');
    expect(banner!.showRestart).toBe(true);
  });

  it('returns generic DEGRADED banner when no health reports', () => {
    const banner = getStatusBanner(SessionState.DEGRADED, [], null);
    expect(banner).not.toBeNull();
    expect(banner!.bg).toContain('orange');
  });

  it('returns mic-specific DEGRADED banner when audio unavailable', () => {
    const health = [makeAudioHealth({ available: false })];
    const banner = getStatusBanner(SessionState.DEGRADED, health, null);
    expect(banner).not.toBeNull();
    expect(banner!.messageKey).toBe('health.microphoneUnavailable');
  });

  it('returns no-face DEGRADED banner when video has no face detected', () => {
    const health = [makeVideoHealth({ available: true, faceDetected: false, faceFrameRatio: 0.9 })];
    const banner = getStatusBanner(SessionState.DEGRADED, health, ModalityPath.SPEECH);
    expect(banner).not.toBeNull();
    expect(banner!.messageKey).toBe('health.noFaceDetected');
  });

  it('returns camera-obstructed DEGRADED banner when video unavailable', () => {
    const health = [makeVideoHealth({ available: false })];
    const banner = getStatusBanner(SessionState.DEGRADED, health, null);
    expect(banner).not.toBeNull();
    expect(banner!.messageKey).toBe('health.cameraObstructed');
  });

  it('SPEECH: video rolling-unavailable but live stream prefers no-face over obstructed', () => {
    const health = [
      makeVideoHealth({
        available: false,
        fps: 28,
        faceFrameRatio: 0.1,
        faceDetected: false,
      }),
    ];
    const banner = getStatusBanner(SessionState.DEGRADED, health, ModalityPath.SPEECH);
    expect(banner!.messageKey).toBe('health.noFaceDetected');
  });

  it('SPEECH: video rolling-unavailable but live stream prefers keep-face when ratio low and last had face', () => {
    const health = [
      makeVideoHealth({
        available: false,
        fps: 28,
        faceFrameRatio: 0.35,
        faceDetected: true,
      }),
    ];
    const banner = getStatusBanner(SessionState.DEGRADED, health, ModalityPath.SPEECH);
    expect(banner!.messageKey).toBe('health.keepFaceInCamera');
  });

  it('SPEECH: truly dead video (low fps) still shows obstructed', () => {
    const health = [makeVideoHealth({ available: false, fps: 0, faceFrameRatio: 0 })];
    const banner = getStatusBanner(SessionState.DEGRADED, health, ModalityPath.SPEECH);
    expect(banner!.messageKey).toBe('health.cameraObstructed');
  });

  it('returns low-signal DEGRADED banner when audio SNR is low', () => {
    const health = [makeAudioHealth({ available: true, snr: 3 })];
    const banner = getStatusBanner(SessionState.DEGRADED, health, null);
    expect(banner).not.toBeNull();
    expect(banner!.messageKey).toBe('health.lowSignalQuality');
  });

  it('returns keep-face DEGRADED banner on SPEECH when face frame ratio is low', () => {
    const health = [makeVideoHealth({ available: true, faceFrameRatio: 0.35, faceDetected: true })];
    const banner = getStatusBanner(SessionState.DEGRADED, health, ModalityPath.SPEECH);
    expect(banner).not.toBeNull();
    expect(banner!.messageKey).toBe('health.keepFaceInCamera');
  });

  it('returns SIGN DEGRADED banner with combined framing key when both hands and pose are bad', () => {
    const health = [
      makeVideoHealth({
        available: true,
        faceDetected: true,
        faceFrameRatio: 0.9,
        signVisibilityMessageKeys: ['health.signLowSigningFraming'],
      }),
    ];
    const banner = getStatusBanner(SessionState.DEGRADED, health, ModalityPath.SIGN);
    expect(banner).not.toBeNull();
    expect(banner!.messageKeys).toEqual(['health.signLowSigningFraming']);
    expect(banner!.messageKey).toBe('health.signLowSigningFraming');
  });
});
