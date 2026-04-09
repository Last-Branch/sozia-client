import type { AudioFeatureChunk, LandmarkFrame, PipelineHealth } from '../common/models';

/**
 * Port through which pipelines send features and health upstream (LLD §3.2.5).
 *
 * The concrete WebSocket-based implementation lives in this package;
 * pipeline packages depend only on this interface.
 */
export interface TransmissionManager {
  sendFeatures(features: LandmarkFrame | AudioFeatureChunk): void;
  sendHealth(health: PipelineHealth): void;
}
