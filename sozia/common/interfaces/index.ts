import type {
  ModelConfig,
  ModalityResult,
  PipelineHealth,
  TranscriptSegment,
} from '../models';

/**
 * Abstract contract for every AI inference component.
 *
 * Client code does not implement this today, but the shared definition keeps the
 * wire contract aligned with the server-side LLD and future mirrored Python types.
 *
 * @typeParam TFeatures - Engine input payload, such as an audio feature matrix or gloss text.
 */
export interface InferenceEngine<TFeatures = unknown> {
  /**
   * Load model weights and prepare the engine for inference.
   *
   * @param config - Model selection and runtime configuration.
   * @returns A promise that resolves when the model is ready to serve predictions.
   */
  loadModel(config: ModelConfig): Promise<void>;

  /**
   * Run inference on preprocessed features.
   *
   * @param features - Preprocessed, anonymized model input.
   * @param timeoutMs - Maximum wall-clock time allowed for the prediction.
   * @returns The engine output used by fusion/post-processing.
   */
  predict(features: TFeatures, timeoutMs: number): Promise<ModalityResult>;

  /**
   * Release model resources such as memory or GPU allocations.
   *
   * @returns A promise that resolves once cleanup is complete.
   */
  unloadModel(): Promise<void>;

  /**
   * Indicates whether a model is currently loaded and ready.
   *
   * @returns `true` when predictions can be served.
   */
  isLoaded(): boolean;

  /**
   * Returns the identifier of the currently loaded model.
   *
   * @returns A stable model id, or an empty string if nothing is loaded.
   */
  getModelId(): string;
}

/**
 * Abstract contract for server-side fusion strategies.
 *
 * Different paths can implement different policies while sharing the same
 * inputs and outputs.
 */
export interface FusionStrategy {
  /**
   * Merge one or more modality outputs into transcript segments.
   *
   * @param results - Inference outputs that are candidates for fusion.
   * @param health - Latest pipeline health reports used for degraded-mode decisions.
   * @returns One or more transcript segments, typically a partial followed by a final.
   */
  fuse(results: ModalityResult[], health: PipelineHealth[]): TranscriptSegment[];

  /**
   * Decide whether a modality result should be excluded from fusion.
   *
   * @param result - Candidate inference result.
   * @returns `true` when the result should be suppressed.
   */
  shouldSuppress(result: ModalityResult): boolean;

  /**
   * Return the minimum confidence threshold used by this strategy.
   *
   * @returns A numeric threshold in the range `[0.0, 1.0]`.
   */
  getConfidenceThreshold(): number;
}

/**
 * Shared contract for client-side feature extraction.
 *
 * Raw input types remain package-local, but every extractor exposes the same
 * readiness and extraction surface.
 *
 * @typeParam TRawInput - Opaque media/input type owned by the pipeline package.
 * @typeParam TFeatureOutput - Extracted feature payload or DTO.
 */
export interface FeatureExtractor<TRawInput = unknown, TFeatureOutput = unknown> {
  /**
   * Transform raw input into a feature payload suitable for downstream processing.
   *
   * @param rawInput - Package-local raw input.
   * @returns The extracted payload, or `null` when extraction fails.
   */
  extract(rawInput: TRawInput): TFeatureOutput | null;

  /**
   * Report whether the extractor is initialized and ready.
   *
   * @returns `true` when `extract()` can be called safely.
   */
  isReady(): boolean;
}
