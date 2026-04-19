package com.sozia.mediapipe

import android.annotation.SuppressLint
import android.graphics.Bitmap
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry
import com.mrousavy.camera.frameprocessors.VisionCameraProxy
import com.google.mediapipe.framework.image.BitmapImageBuilder
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

/**
 * VisionCamera JSI frame processor plugin.
 * Registered as "extractLandmarks" — callable from JS worklets as:
 *   const result = extractLandmarks(frame)
 *
 * Inference runs on a dedicated background thread so the camera thread is never
 * blocked longer than the ~2–4 ms YUV→ARGB conversion. A double-buffered bitmap
 * pair ensures the camera thread and inference thread never touch the same bitmap
 * concurrently.
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

        // Target width fed into MediaPipe. Models work at ~192–256px internally;
        // 640px is still oversampled and cuts conversion work ~9× vs a 1920px frame.
        private const val TARGET_WIDTH = 640
    }

    private val holistic: SoziaMediaPipeHolistic by lazy {
        SoziaMediaPipeHolistic(proxy.context).also { h ->
            Thread { h.load() }.start()
        }
    }

    // Single-threaded executor: inference never races with itself.
    private val inferenceExecutor = Executors.newSingleThreadExecutor()

    // Camera thread sets false → true before submitting; inference thread resets on finish.
    private val inferenceBusy = AtomicBoolean(false)

    // Latest result produced by the inference thread; drained by the camera thread.
    private val pendingResult = AtomicReference<HashMap<String, Any?>?>(null)

    // Double-buffered output bitmaps: camera thread always writes to the idle slot
    // while the inference thread reads from the active slot.
    private val bitmapSlots = arrayOfNulls<Bitmap>(2)
    private var writeSlot = 0

    // Scratch buffers — only the camera thread touches these.
    private var reusableArgb: IntArray? = null
    private var reusableY: ByteArray? = null
    private var reusableU: ByteArray? = null
    private var reusableV: ByteArray? = null

    override fun callback(frame: Frame, arguments: Map<String, Any>?): Any? {
        // Return the most recent inference result (null if inference is still running).
        val toReturn = pendingResult.getAndSet(null)

        val mediaImage = frame.image ?: return toReturn

        // If the inference thread is still busy, skip this frame entirely.
        if (!inferenceBusy.compareAndSet(false, true)) return toReturn

        val slot = writeSlot.also { writeSlot = 1 - it }
        val bitmap = yuvToArgbBitmap(mediaImage, slot) ?: run {
            inferenceBusy.set(false)
            return toReturn
        }

        val sessionId = arguments?.get("sessionId") as? String ?: ""
        val ts = System.currentTimeMillis()

        inferenceExecutor.submit {
            try {
                val image = BitmapImageBuilder(bitmap).build()
                val result = holistic.detect(image, ts)
                if (result != null) pendingResult.set(buildWritableMap(result, ts, sessionId))
            } catch (_: Exception) {
            } finally {
                inferenceBusy.set(false)
            }
        }

        return toReturn
    }

    /**
     * Convert YUV_420_888 → ARGB_8888 bitmap using BT.601 fixed-point math with
     * nearest-neighbour downsampling. Writes into bitmapSlots[slot] so the caller
     * can hand that slot to the inference thread while the camera thread uses the other.
     */
    private fun yuvToArgbBitmap(image: android.media.Image, slot: Int): Bitmap? {
        val srcWidth = image.width
        val srcHeight = image.height
        if (srcWidth <= 0 || srcHeight <= 0) return null

        val scale = maxOf(1, srcWidth / TARGET_WIDTH)
        val dstWidth = srcWidth / scale
        val dstHeight = srcHeight / scale

        val yPlane = image.planes[0]
        val uPlane = image.planes[1]
        val vPlane = image.planes[2]

        val yBuffer = yPlane.buffer
        val uBuffer = uPlane.buffer
        val vBuffer = vPlane.buffer

        val yRowStride = yPlane.rowStride
        val yPixelStride = yPlane.pixelStride
        val uvRowStride = uPlane.rowStride
        val uvPixelStride = uPlane.pixelStride

        val yCap = yBuffer.remaining()
        val uCap = uBuffer.remaining()
        val vCap = vBuffer.remaining()

        val yData = reusableY?.takeIf { it.size == yCap } ?: ByteArray(yCap).also { reusableY = it }
        val uData = reusableU?.takeIf { it.size == uCap } ?: ByteArray(uCap).also { reusableU = it }
        val vData = reusableV?.takeIf { it.size == vCap } ?: ByteArray(vCap).also { reusableV = it }
        yBuffer.get(yData)
        uBuffer.get(uData)
        vBuffer.get(vData)

        val argbSize = dstWidth * dstHeight
        val argb = reusableArgb?.takeIf { it.size == argbSize }
            ?: IntArray(argbSize).also { reusableArgb = it }

        for (dy in 0 until dstHeight) {
            val sy = dy * scale
            val yRowBase = sy * yRowStride
            val uvRowBase = (sy / 2) * uvRowStride
            val outRowBase = dy * dstWidth
            for (dx in 0 until dstWidth) {
                val sx = dx * scale
                val yIdx = yRowBase + sx * yPixelStride
                val uvIdx = uvRowBase + (sx / 2) * uvPixelStride

                val yVal = yData[yIdx].toInt() and 0xff
                val uVal = (uData[uvIdx].toInt() and 0xff) - 128
                val vVal = (vData[uvIdx].toInt() and 0xff) - 128

                var r = yVal + ((1436 * vVal) shr 10)
                var g = yVal - ((352 * uVal + 731 * vVal) shr 10)
                var b = yVal + ((1814 * uVal) shr 10)

                if (r < 0) r = 0 else if (r > 255) r = 255
                if (g < 0) g = 0 else if (g > 255) g = 255
                if (b < 0) b = 0 else if (b > 255) b = 255

                argb[outRowBase + dx] = (0xff shl 24) or (r shl 16) or (g shl 8) or b
            }
        }

        val bmp = bitmapSlots[slot]?.takeIf {
            it.width == dstWidth && it.height == dstHeight && !it.isRecycled
        } ?: Bitmap.createBitmap(dstWidth, dstHeight, Bitmap.Config.ARGB_8888).also {
            bitmapSlots[slot] = it
        }
        bmp.setPixels(argb, 0, dstWidth, 0, 0, dstWidth, dstHeight)
        return bmp
    }

    private fun buildWritableMap(
        result: SoziaMediaPipeHolistic.LandmarkResult,
        ts: Long,
        sessionId: String
    ): HashMap<String, Any?> {
        return hashMapOf(
            "sessionId"          to sessionId,
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
