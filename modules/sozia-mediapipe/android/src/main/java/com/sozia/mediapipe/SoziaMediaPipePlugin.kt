package com.sozia.mediapipe

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry
import com.mrousavy.camera.frameprocessors.VisionCameraProxy
import com.google.mediapipe.framework.image.BitmapImageBuilder
import java.io.ByteArrayOutputStream

/**
 * VisionCamera JSI frame processor plugin.
 * Registered as "extractLandmarks" — callable from JS worklets as:
 *   const result = extractLandmarks(frame)
 */
@SuppressLint("MissingPermission")
@Suppress("unused")
class SoziaMediaPipePlugin(private val proxy: VisionCameraProxy, options: Map<String, Any>?) :
    FrameProcessorPlugin() {

    companion object {
        @JvmStatic
        fun load() {
            FrameProcessorPluginRegistry.addFrameProcessorPlugin("extractLandmarks") { proxy, options ->
                SoziaMediaPipePlugin(proxy, options)
            }
        }
    }

    private val holistic: SoziaMediaPipeHolistic by lazy {
        SoziaMediaPipeHolistic(proxy.context).also { h ->
            Thread { h.load() }.start()
        }
    }

    override fun callback(frame: Frame, arguments: Map<String, Any>?): Any? {
        val bitmap = frameToBitmap(frame) ?: return null
        val image = BitmapImageBuilder(bitmap).build()
        val ts = System.currentTimeMillis()
        val result = holistic.detect(image, ts)
        bitmap.recycle()
        return if (result != null) buildWritableMap(result, ts) else null
    }

    private fun frameToBitmap(frame: Frame): Bitmap? {
        val mediaImage = frame.image ?: return null
        val planes = mediaImage.planes
        // YUV_420_888 → NV21 → JPEG → Bitmap (ARGB_8888 == RGBA_8888 for MediaPipe purposes)
        val yPlane = planes[0]
        val uPlane = planes[1]
        val vPlane = planes[2]
        val yBuffer = yPlane.buffer
        val uBuffer = uPlane.buffer
        val vBuffer = vPlane.buffer
        val ySize = yBuffer.remaining()
        val uSize = uBuffer.remaining()
        val vSize = vBuffer.remaining()
        val nv21 = ByteArray(ySize + uSize + vSize)
        yBuffer.get(nv21, 0, ySize)
        vBuffer.get(nv21, ySize, vSize)
        uBuffer.get(nv21, ySize + vSize, uSize)
        val yuvImage = YuvImage(nv21, ImageFormat.NV21, mediaImage.width, mediaImage.height, null)
        val out = ByteArrayOutputStream()
        yuvImage.compressToJpeg(Rect(0, 0, mediaImage.width, mediaImage.height), 90, out)
        val jpegBytes = out.toByteArray()
        return android.graphics.BitmapFactory.decodeByteArray(jpegBytes, 0, jpegBytes.size)
    }

    private fun buildWritableMap(
        result: SoziaMediaPipeHolistic.LandmarkResult,
        ts: Long
    ): HashMap<String, Any?> {
        return hashMapOf(
            "sessionId"          to "",
            "timestampMs"        to ts.toDouble(),
            "faceLandmarks"      to toLandmarkList(result.faceLandmarks),
            "leftHandLandmarks"  to toLandmarkList(result.leftHandLandmarks),
            "rightHandLandmarks" to toLandmarkList(result.rightHandLandmarks),
            "poseLandmarks"      to toLandmarkList(result.poseLandmarks)
        )
    }

    private fun toLandmarkList(landmarks: List<List<Float>>?): ArrayList<ArrayList<Double>>? {
        if (landmarks == null) return null
        return ArrayList(landmarks.map { point ->
            ArrayList(point.map { v -> v.toDouble() })
        })
    }
}
