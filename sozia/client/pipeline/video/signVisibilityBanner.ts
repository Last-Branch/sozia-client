/**
 * SIGN degraded copy after sustained low visibility:
 * - Both hands detected but low scores, or both hands not detected while pose exists → hands path
 * - Upper body only → upper-body alert
 * - Any hands issue together with pose issue → one general framing alert
 */
export function signVisibilityBannerKeys(
  handsAnyBad: boolean,
  poseBad: boolean,
  handsBothMissing: boolean,
): string[] {
  const handsIssue = handsAnyBad || handsBothMissing;
  if (handsIssue && poseBad) return ['health.signLowSigningFraming'];
  if (handsIssue) return ['health.signLowHands'];
  if (poseBad) return ['health.signLowUpperBody'];
  return ['health.signLowSigningVisibility'];
}
