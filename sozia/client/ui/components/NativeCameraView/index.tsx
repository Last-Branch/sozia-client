import React, { useRef, useEffect } from 'react';
import { Platform, StyleProp, ViewStyle } from 'react-native';
import type { LandmarkFrame } from '@common/models';
import { normalizeLandmarkFrame, extractSeq, extractInferenceCompletedAt } from './helpers';

export interface NativeCameraViewProps {
  facing: 'front' | 'back';
  active: boolean;
  sessionId?: string;
  onLandmarks: (frame: LandmarkFrame | null, seq?: number, inferenceCompletedAtMs?: number) => void;
  onError?: (message: string) => void;
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Native implementation (iOS / Android)
// ---------------------------------------------------------------------------
// Imported lazily so the module is never evaluated on web (where VisionCamera
// and Worklets Core are not available).

let NativeCameraViewImpl: React.FC<NativeCameraViewProps> | null = null;

if (Platform.OS !== 'web') {
  const { Camera, useCameraDevice, useFrameProcessor, VisionCameraProxy } = require('react-native-vision-camera') as typeof import('react-native-vision-camera');
  const { useRunOnJS } = require('react-native-worklets-core') as typeof import('react-native-worklets-core');

  NativeCameraViewImpl = function NativeCameraViewNative({
    facing,
    active,
    sessionId = '',
    onLandmarks,
    onError,
    style,
  }: NativeCameraViewProps) {
    const device = useCameraDevice(facing);

    const pluginRef = useRef(VisionCameraProxy.initFrameProcessorPlugin('extractLandmarks', {}));

    // Keep a mutable ref so dispatchLandmarks never needs to change when onLandmarks changes.
    // This prevents useFrameProcessor from tearing down and re-creating the frame processor
    // on every React re-render of the parent (e.g., health polling state updates).
    const onLandmarksRef = useRef(onLandmarks);
    useEffect(() => { onLandmarksRef.current = onLandmarks; });

    const dispatchLandmarks = useRunOnJS(
      (raw: unknown) => {
        onLandmarksRef.current(
          normalizeLandmarkFrame(raw),
          extractSeq(raw),
          extractInferenceCompletedAt(raw),
        );
      },
      [],
    );

    const frameProcessor = useFrameProcessor(
      (frame) => {
        'worklet';
        const plugin = pluginRef.current;
        if (plugin != null) {
          const result = plugin.call(frame, { sessionId });
          if (result != null) {
            void dispatchLandmarks(result);
          }
        }
      },
      [dispatchLandmarks, sessionId],
    );

    if (!device) {
      if (onError) onError('No camera device found for facing: ' + facing);
      return null;
    }

    return (
      <Camera
        style={style}
        device={device}
        isActive={active}
        frameProcessor={frameProcessor}
        onError={(error) => onError?.(error.message)}
      />
    );
  };
}

// ---------------------------------------------------------------------------
// Public component — web returns null; native delegates to VisionCamera
// ---------------------------------------------------------------------------

export function NativeCameraView(props: NativeCameraViewProps): React.ReactElement | null {
  if (Platform.OS === 'web' || NativeCameraViewImpl === null) {
    return null;
  }
  return React.createElement(NativeCameraViewImpl, props);
}
