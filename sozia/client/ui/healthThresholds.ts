/**
 * Rolling fraction of recent video samples that must include a face mesh
 * (SPEECH / lip-reading) to avoid client-side DEGRADED.
 */
export const SPEECH_FACE_IN_FRAME_MIN_RATIO = 0.5;

/** Min hand visibility [0,1] for SIGN (both hands must be below this to count as “hands bad”). */
export const SIGN_HAND_VISIBILITY_MIN = 0.7;

/** Min upper-body (pose subset) visibility [0,1] for SIGN; looser than hands. */
export const SIGN_POSE_VISIBILITY_MIN = 0.7;

/** Hands-both-bad OR pose-bad must hold continuously this long (SIGN). */
export const SIGN_VISIBILITY_LOW_MIN_MS = 1500;
