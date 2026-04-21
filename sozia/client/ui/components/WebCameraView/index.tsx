import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

interface WebCameraViewProps {
  deviceId: string | null;
  facing: 'front' | 'back';
  active: boolean;
  onCameraReady: (el: HTMLVideoElement) => void;
  onError?: (message: string) => void;
}

let WebCameraViewImpl: React.FC<WebCameraViewProps> | null = null;

if (Platform.OS === 'web') {
  WebCameraViewImpl = function WebCameraViewWeb({
    deviceId,
    facing,
    active,
    onCameraReady,
    onError,
  }: WebCameraViewProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
      const videoEl = videoRef.current;
      if (!videoEl) return;

      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: facing === 'front' ? 'user' : 'environment' },
        audio: false,
      };

      let cancelled = false;

      const openStream = async (): Promise<MediaStream> => {
        try {
          return await navigator.mediaDevices.getUserMedia(constraints);
        } catch {
          // Specific constraint failed (stale deviceId or unsupported facingMode).
          // Fall back to any available camera before giving up.
          return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
      };

      openStream()
        .then((stream) => {
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          stream.getVideoTracks().forEach((track) => {
            track.onended = () => {
              if (!cancelled) onError?.('Camera disconnected');
            };
          });
          videoEl.srcObject = stream;
          return videoEl.play();
        })
        .then(() => {
          if (!cancelled) onCameraReady(videoEl);
        })
        .catch((err: unknown) => {
          if (!cancelled) onError?.(err instanceof Error ? err.message : 'Camera error');
        });

      return () => {
        cancelled = true;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        videoEl.srcObject = null;
      };
    }, [deviceId, facing]); // eslint-disable-line react-hooks/exhaustive-deps

    // Pipeline pause/resume is handled by DeviceManager — the preview
    // should remain visible at all times regardless of session state.

    return (
      <video
        ref={videoRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: facing === 'front' ? 'scaleX(-1)' : 'none',
        } as React.CSSProperties}
        playsInline
        muted
      />
    );
  };
}

export function WebCameraView(props: WebCameraViewProps): React.ReactElement | null {
  if (Platform.OS !== 'web' || WebCameraViewImpl === null) return null;
  return React.createElement(WebCameraViewImpl, props);
}
