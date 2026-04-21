import React, { createElement, useEffect, useRef } from 'react';
import { View, type StyleProp, ViewStyle } from 'react-native';

export interface WebCameraViewProps {
  /** When set, opens this `MediaDeviceInfo.deviceId` (web enumeration). Ignores `facing` for constraints. */
  deviceId: string | null | undefined;
  facing: 'front' | 'back';
  /** When false, pauses the preview element (stream stays open). */
  active: boolean;
  mirror?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Bump when the capture session changes so the stream is re-acquired. */
  sessionKey?: string | null;
  onVideoElement: (el: HTMLVideoElement | null) => void;
  onCameraReady?: () => void;
  onMountError?: (message: string, attemptedDeviceId: string | null | undefined) => void;
}

/**
 * Web camera preview using `getUserMedia` with an optional concrete `deviceId`.
 * expo-camera's web implementation only picks devices via `facingMode`, so
 * external USB webcams chosen in device setup never apply without this path.
 */
export function WebCameraView({
  deviceId,
  facing,
  active,
  mirror = false,
  style,
  sessionKey,
  onVideoElement,
  onCameraReady,
  onMountError,
}: WebCameraViewProps): React.ReactElement {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onVideoElementRef = useRef(onVideoElement);
  const onCameraReadyRef = useRef(onCameraReady);
  const onMountErrorRef = useRef(onMountError);

  useEffect(() => {
    onVideoElementRef.current = onVideoElement;
    onCameraReadyRef.current = onCameraReady;
    onMountErrorRef.current = onMountError;
  });

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      onMountErrorRef.current?.('Camera API not available in this browser.', deviceId);
      return;
    }

    let cancelled = false;
    const video = videoRef.current;

    const baselineConstraint: MediaTrackConstraints = {
      width: { ideal: 640, max: 1280 },
      height: { ideal: 480, max: 720 },
      frameRate: { ideal: 30, max: 30 },
    };
    const facingConstraint: MediaTrackConstraints = {
      ...baselineConstraint,
      facingMode: facing === 'front' ? 'user' : 'environment',
    };
    const preferredConstraint: MediaTrackConstraints = deviceId
      ? { deviceId: { exact: deviceId } }
      : facingConstraint;

    const attachStream = (stream: MediaStream): void => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (video) {
          video.srcObject = stream;
          const notify = () => {
            if (videoRef.current) onVideoElementRef.current(videoRef.current);
            onCameraReadyRef.current?.();
          };
          video.addEventListener('loadedmetadata', notify, { once: true });
          void video.play().then(notify).catch(() => {
            notify();
          });
        }
    };

    const openCamera = async (): Promise<void> => {
      try {
        const preferred = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: preferredConstraint,
        });
        attachStream(preferred);
        return;
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        onMountErrorRef.current?.(message || 'Failed to open camera', deviceId);
      }
    };

    void openCamera();

    const mountedVideo = video;
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (mountedVideo) {
        mountedVideo.srcObject = null;
      }
      onVideoElementRef.current(null);
    };
  }, [deviceId, facing, sessionKey]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active) {
      void v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [active]);

  const videoStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    ...(mirror ? { transform: 'scaleX(-1)' } : {}),
  };

  return (
    <View style={style}>
      {createElement('video', {
        ref: videoRef,
        playsInline: true,
        muted: true,
        autoPlay: true,
        style: videoStyle,
      })}
    </View>
  );
}
