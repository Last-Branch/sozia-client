import { ModalityPath, SessionState, type PipelineHealth } from '@common/models';
import { SPEECH_FACE_IN_FRAME_MIN_RATIO } from '@/ui/healthThresholds';

const LOW_SNR_THRESHOLD = 5;

export interface Banner {
  messageKey: string;
  /** When set (e.g. SIGN visibility), each key is translated and joined for display. */
  messageKeys?: string[];
  bg: string;
  text: string;
  showRestart: boolean;
  showSpinner: boolean;
}

/** SPEECH: rolling `available` flips when >50% of frames lack landmarks; use fps + faceFrameRatio to avoid mislabeling that as a blocked camera. */
function speechVideoLooksLive(video: PipelineHealth): boolean {
  if ((video.fps ?? 0) < 2) return false;
  const r = video.faceFrameRatio;
  return typeof r === 'number' && Number.isFinite(r);
}

function degradedMessage(healthReports: PipelineHealth[], activePath: ModalityPath | null): string {
  const audio = healthReports.find((r) => r.pipeline === 'audio');
  const video = healthReports.find((r) => r.pipeline === 'video');

  if (audio && !audio.available) return 'health.microphoneUnavailable';

  const treatVideoUnavailableAsObstructed =
    video &&
    !video.available &&
    !(activePath === ModalityPath.SPEECH && speechVideoLooksLive(video));

  if (treatVideoUnavailableAsObstructed) return 'health.cameraObstructed';

  // SPEECH: video "unavailable" by rolling null-landmark rule but stream still live → face UX, not lens.
  if (
    activePath === ModalityPath.SPEECH &&
    video &&
    !video.available &&
    speechVideoLooksLive(video)
  ) {
    if (video.faceDetected === false) return 'health.noFaceDetected';
    if (
      typeof video.faceFrameRatio === 'number' &&
      Number.isFinite(video.faceFrameRatio) &&
      video.faceFrameRatio < SPEECH_FACE_IN_FRAME_MIN_RATIO
    ) {
      return 'health.keepFaceInCamera';
    }
  }

  if (video && video.faceDetected === false) return 'health.noFaceDetected';
  if (
    activePath === ModalityPath.SPEECH &&
    video &&
    video.available &&
    typeof video.faceFrameRatio === 'number' &&
    Number.isFinite(video.faceFrameRatio) &&
    video.faceFrameRatio < SPEECH_FACE_IN_FRAME_MIN_RATIO
  ) {
    return 'health.keepFaceInCamera';
  }
  if (audio && audio.snr !== null && audio.snr < LOW_SNR_THRESHOLD) return 'health.lowSignalQuality';

  return 'health.degraded';
}

function signVisibilityKeysFromVideo(
  healthReports: PipelineHealth[],
  activePath: ModalityPath | null,
): string[] | null {
  if (activePath !== ModalityPath.SIGN) return null;
  const video = healthReports.find((r) => r.pipeline === 'video');
  const keys = video?.signVisibilityMessageKeys;
  if (!video?.available || !Array.isArray(keys) || keys.length === 0) return null;
  return keys;
}

export function getStatusBanner(
  state: SessionState,
  healthReports: PipelineHealth[],
  activePath: ModalityPath | null = null,
): Banner | null {
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
    case SessionState.DEGRADED: {
      const signKeys = signVisibilityKeysFromVideo(healthReports, activePath);
      return {
        messageKey: signKeys?.length ? signKeys[0] : degradedMessage(healthReports, activePath),
        messageKeys: signKeys ?? undefined,
        bg: 'bg-orange-500/80',
        text: 'text-white',
        showRestart: false,
        showSpinner: false,
      };
    }
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
