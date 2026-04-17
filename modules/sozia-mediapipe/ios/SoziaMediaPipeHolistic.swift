import Foundation
import MediaPipeTasksVision

/// Holds the three MediaPipe landmarkers and runs serial inference per frame.
/// All public methods are safe to call from any thread; `load()` must be
/// dispatched onto a background queue by the caller.
final class SoziaMediaPipeHolistic {

  // MARK: - State

  private var faceLandmarker: FaceLandmarker?
  private var handLandmarker: HandLandmarker?
  private var poseLandmarker: PoseLandmarker?
  private(set) var isReady = false

  // MARK: - Face index filter (matches FACE_LANDMARK_INDICES in TypeScript)

  private static let faceIndices: [Int] = [
    0, 1, 4, 5, 13, 14, 17, 33, 37, 39, 40, 46, 52, 53, 55, 61, 65,
    78, 80, 81, 82, 84, 87, 88, 91, 95, 133, 144, 145, 146, 152, 157,
    158, 159, 160, 175, 178, 181, 185, 191, 199, 200, 263, 267, 269,
    270, 276, 282, 283, 285, 291, 295, 308, 310, 311, 312, 314, 317,
    318, 321, 324, 362, 373, 374, 375, 384, 385, 386, 387, 402, 405,
    409, 415, 468, 469, 470, 471, 472, 473, 474, 475, 476, 477,
  ]

  // MARK: - Result type

  struct LandmarkResult {
    let faceLandmarks: [[Float]]?      // 83×3
    let leftHandLandmarks: [[Float]]?  // 21×3
    let rightHandLandmarks: [[Float]]? // 21×3
    let poseLandmarks: [[Float]]?      // 33×3
  }

  // MARK: - Model loading

  /// Loads the three .task bundles from the main bundle.
  /// Expected asset names: `face_landmarker.task`, `hand_landmarker.task`, `pose_landmarker_full.task`.
  /// Sets `isReady = true` on success; leaves it false on any error.
  func load() {
    guard
      let facePath  = Bundle.main.path(forResource: "face_landmarker",      ofType: "task"),
      let handPath  = Bundle.main.path(forResource: "hand_landmarker",      ofType: "task"),
      let posePath  = Bundle.main.path(forResource: "pose_landmarker_full", ofType: "task")
    else {
      return
    }

    do {
      let faceOptions = FaceLandmarkerOptions()
      faceOptions.baseOptions.modelAssetPath = facePath
      faceOptions.runningMode = .video
      faceOptions.numFaces = 1
      faceOptions.minFaceDetectionConfidence = 0.3
      faceOptions.minFacePresenceConfidence  = 0.3
      faceLandmarker = try FaceLandmarker(options: faceOptions)

      let handOptions = HandLandmarkerOptions()
      handOptions.baseOptions.modelAssetPath = handPath
      handOptions.runningMode = .video
      handOptions.numHands = 2
      handOptions.minHandDetectionConfidence = 0.3
      handOptions.minHandPresenceConfidence  = 0.3
      handLandmarker = try HandLandmarker(options: handOptions)

      let poseOptions = PoseLandmarkerOptions()
      poseOptions.baseOptions.modelAssetPath = posePath
      poseOptions.runningMode = .video
      poseOptions.numPoses = 1
      poseLandmarker = try PoseLandmarker(options: poseOptions)

      isReady = true
    } catch {
      isReady = false
    }
  }

  // MARK: - Inference

  func detect(sampleBuffer: CMSampleBuffer, timestampMs: Int) -> LandmarkResult? {
    guard isReady,
          let face = faceLandmarker,
          let hand = handLandmarker,
          let pose = poseLandmarker
    else { return nil }

    guard let image = try? MPImage(sampleBuffer: sampleBuffer) else { return nil }

    let ts = TimeInterval(timestampMs)

    guard let faceResult = try? face.detectAsync(image: image, timestampInMilliseconds: Int(ts)),
          let handResult = try? hand.detectAsync(image: image, timestampInMilliseconds: Int(ts)),
          let poseResult = try? pose.detectAsync(image: image, timestampInMilliseconds: Int(ts))
    else { return nil }

    let faceLandmarks = filterFaceLandmarks(faceResult.faceLandmarks.first)
    let (leftHand, rightHand) = partitionHands(handResult)
    let poseLandmarks = mapLandmarks(poseResult.landmarks.first)

    return LandmarkResult(
      faceLandmarks: faceLandmarks,
      leftHandLandmarks: leftHand,
      rightHandLandmarks: rightHand,
      poseLandmarks: poseLandmarks
    )
  }

  // MARK: - Private helpers

  private func filterFaceLandmarks(_ landmarks: [NormalizedLandmark]?) -> [[Float]]? {
    guard let all = landmarks, !all.isEmpty else { return nil }
    return Self.faceIndices.compactMap { idx in
      guard idx < all.count else { return nil }
      let lm = all[idx]
      return [lm.x, lm.y, lm.z]
    }
  }

  private func mapLandmarks(_ landmarks: [NormalizedLandmark]?) -> [[Float]]? {
    guard let all = landmarks, !all.isEmpty else { return nil }
    return all.map { lm in [lm.x, lm.y, lm.z] }
  }

  private func partitionHands(_ result: HandLandmarkerResult) -> ([[Float]]?, [[Float]]?) {
    var left: [[Float]]?
    var right: [[Float]]?
    for (i, handedness) in result.handedness.enumerated() {
      guard let label = handedness.first?.categoryName?.lowercased(),
            i < result.landmarks.count else { continue }
      let mapped = mapLandmarks(result.landmarks[i])
      if label == "left",  left  == nil { left  = mapped }
      if label == "right", right == nil { right = mapped }
    }
    return (left, right)
  }
}
