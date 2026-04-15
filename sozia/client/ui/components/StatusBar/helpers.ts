import { SessionState, type PipelineHealth } from '@common/models';

const LOW_SNR_THRESHOLD = 5;

export interface Banner {
  messageKey: string;
  bg: string;
  text: string;
  showRestart: boolean;
  showSpinner: boolean;
}

function degradedMessage(healthReports: PipelineHealth[]): string {
  const audio = healthReports.find((r) => r.pipeline === 'audio');
  const video = healthReports.find((r) => r.pipeline === 'video');

  if (audio && !audio.available) return 'health.microphoneUnavailable';
  if (video && !video.available) return 'health.cameraObstructed';
  if (video && video.faceDetected === false) return 'health.noFaceDetected';
  if (audio && audio.snr !== null && audio.snr < LOW_SNR_THRESHOLD) return 'health.lowSignalQuality';

  return 'health.degraded';
}

export function getStatusBanner(state: SessionState, healthReports: PipelineHealth[]): Banner | null {
  switch (state) {
    case SessionState.RUNNING:
      return {
        messageKey: 'health.sessionActive',
        bg: 'bg-green-500/80',
        text: 'text-white',
        showRestart: false,
        showSpinner: false,
      };
    case SessionState.INITIALIZING:
      return {
        messageKey: 'health.warming',
        bg: 'bg-blue-500/80',
        text: 'text-white',
        showRestart: false,
        showSpinner: true,
      };
    case SessionState.PAUSED:
      return {
        messageKey: 'health.sessionPaused',
        bg: 'bg-yellow-500/80',
        text: 'text-black',
        showRestart: false,
        showSpinner: false,
      };
    case SessionState.DEGRADED:
      return {
        messageKey: degradedMessage(healthReports),
        bg: 'bg-orange-500/80',
        text: 'text-white',
        showRestart: false,
        showSpinner: false,
      };
    case SessionState.ERROR:
      return {
        messageKey: 'health.sessionError',
        bg: 'bg-red-600/90',
        text: 'text-white',
        showRestart: true,
        showSpinner: false,
      };
    default:
      return null;
  }
}
