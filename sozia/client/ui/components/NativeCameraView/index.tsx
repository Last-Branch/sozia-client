import React, { useRef } from 'react';
import { Platform, StyleProp, ViewStyle } from 'react-native';
import type { LandmarkFrame } from '@common/models';
import { normalizeLandmarkFrame } from './helpers';

export interface NativeCameraViewProps {
  facing: 'front' | 'back';
  active: boolean;
  onLandmarks: (frame: LandmarkFrame | null) => void;
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
    onLandmarks,
    onError,
    style,
  }: NativeCameraViewProps) {
    const device = useCameraDevice(facing);

    // Initialize the JSI plugin once per component instance.
    // VisionCameraProxy installs it into the worklet runtime so plugin.call()
    // can be invoked synchronously inside the frame processor worklet.
    const pluginRef = useRef(VisionCameraProxy.initFrameProcessorPlugin('extractLandmarks', {}));

    // useRunOnJS creates a worklet-callable function that hops back to the JS
    // thread to call onLandmarks (which updates React state).
    const dispatchLandmarks = useRunOnJS(
      (raw: unknown) => {
        onLandmarks(normalizeLandmarkFrame(raw));
      },
      [onLandmarks],
    );

    const frameProcessor = useFrameProcessor(
      (frame) => {
        'worklet';
        const plugin = pluginRef.current;
        if (plugin != null) {
          const result = plugin.call(frame);
          void dispatchLandmarks(result);
        }
      },
      [dispatchLandmarks],
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
