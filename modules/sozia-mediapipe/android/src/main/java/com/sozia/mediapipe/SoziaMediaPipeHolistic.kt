package com.sozia.mediapipe

import android.content.Context
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.components.containers.NormalizedLandmark

/**
 * Runs FaceLandmarker, HandLandmarker, and PoseLandmarker serially.
 * Models are read from assets/mediapipe/ on first call to load().
 */
class SoziaMediaPipeHolistic(private val context: Context) {

    private var faceLandmarker: FaceLandmarker? = null
    private var handLandmarker: HandLandmarker? = null
    private var poseLandmarker: PoseLandmarker? = null

    var isReady = false
        private set

    companion object {
        // Matches FACE_LANDMARK_INDICES in TypeScript (sozia/common/models/index.ts)
        val FACE_INDICES = intArrayOf(
            0, 1, 4, 5, 13, 14, 17, 33, 37, 39, 40, 46, 52, 53, 55, 61, 65,
            78, 80, 81, 82, 84, 87, 88, 91, 95, 133, 144, 145, 146, 152, 157,
            158, 159, 160, 175, 178, 181, 185, 191, 199, 200, 263, 267, 269,
            270, 276, 282, 283, 285, 291, 295, 308, 310, 311, 312, 314, 317,
            318, 321, 324, 362, 373, 374, 375, 384, 385, 386, 387, 402, 405,
            409, 415, 468, 469, 470, 471, 472, 473, 474, 475, 476, 477
        )
    }

    data class LandmarkResult(
        val faceLandmarks: List<List<Float>>?,
        val leftHandLandmarks: List<List<Float>>?,
        val rightHandLandmarks: List<List<Float>>?,
        val poseLandmarks: List<List<Float>>?
    )

    fun load() {
        try {
            val faceOptions = FaceLandmarker.FaceLandmarkerOptions.builder()
                .setBaseOptions(BaseOptions.builder().setModelAssetPath("mediapipe/face_landmarker.task").build())
                .setRunningMode(RunningMode.VIDEO)
                .setNumFaces(1)
                .setMinFaceDetectionConfidence(0.3f)
                .setMinFacePresenceConfidence(0.3f)
                .build()
            faceLandmarker = FaceLandmarker.createFromOptions(context, faceOptions)

            val handOptions = HandLandmarker.HandLandmarkerOptions.builder()
                .setBaseOptions(BaseOptions.builder().setModelAssetPath("mediapipe/hand_landmarker.task").build())
                .setRunningMode(RunningMode.VIDEO)
                .setNumHands(2)
                .setMinHandDetectionConfidence(0.3f)
                .setMinHandPresenceConfidence(0.3f)
                .build()
            handLandmarker = HandLandmarker.createFromOptions(context, handOptions)

            val poseOptions = PoseLandmarker.PoseLandmarkerOptions.builder()
                .setBaseOptions(BaseOptions.builder().setModelAssetPath("mediapipe/pose_landmarker_full.task").build())
                .setRunningMode(RunningMode.VIDEO)
                .setNumPoses(1)
                .build()
            poseLandmarker = PoseLandmarker.createFromOptions(context, poseOptions)

            isReady = true
        } catch (e: Exception) {
            isReady = false
        }
    }

    fun detect(image: MPImage, timestampMs: Long): LandmarkResult? {
        if (!isReady) return null

        val faceResult = faceLandmarker?.detectForVideo(image, timestampMs) ?: return null
        val handResult = handLandmarker?.detectForVideo(image, timestampMs) ?: return null
        val poseResult = poseLandmarker?.detectForVideo(image, timestampMs) ?: return null

        val allFace: List<NormalizedLandmark>? = faceResult.faceLandmarks().firstOrNull()
        // Always emit exactly 83 entries; zero-fill any index beyond the mesh size.
        // Matches the web backend convention and prevents server validation errors on partial occlusion.
        val faceLandmarks: List<List<Float>>? = if (allFace != null) {
            FACE_INDICES.toList().map { idx: Int ->
                if (idx < allFace.size) {
                    val lm: NormalizedLandmark = allFace[idx]
                    listOf(lm.x(), lm.y(), lm.z())
                } else listOf(0f, 0f, 0f)
            }
        } else null

        var leftHand: List<List<Float>>? = null
        var rightHand: List<List<Float>>? = null
        for (i in handResult.handednesses().indices) {
            val label = handResult.handednesses()[i].firstOrNull()?.categoryName()?.lowercase()
            val handPoints: List<NormalizedLandmark> = handResult.landmarks()[i]
            val mapped: List<List<Float>> = handPoints.map { lm: NormalizedLandmark ->
                listOf(lm.x(), lm.y(), lm.z())
            }
            when {
                label == "left"  && leftHand  == null -> leftHand  = mapped
                label == "right" && rightHand == null -> rightHand = mapped
            }
        }

        val posePoints: List<NormalizedLandmark>? = poseResult.landmarks().firstOrNull()
        val poseLandmarks: List<List<Float>>? = posePoints?.map { lm: NormalizedLandmark ->
            listOf(lm.x(), lm.y(), lm.z())
        }

        return LandmarkResult(faceLandmarks, leftHand, rightHand, poseLandmarks)
    }
}
