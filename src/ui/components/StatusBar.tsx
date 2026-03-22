import React from 'react';
import { Text, View } from 'react-native';

import { SessionState } from '../../common/models';
import { useSessionController } from '../controller/SessionController';

/**
 * Advisory banner that appears inside the live session UI when the session
 * is in a non-running state. Renders nothing during normal RUNNING operation.
 *
 * Collaborators: SessionController (reads state), LiveTranslationScreen (hosts it).
 * Health-based banners (noisy environment, camera occlusion) will be added once
 * PipelineHealth signals flow from the transmission layer.
 *
 * Thread/concurrency: renders on the React JS thread, safe from any async context.
 */
export function StatusBar() {
  const { state } = useSessionController();
  const banner = getBanner(state);

  if (!banner) return null;

  return (
    <View
      className={`z-50 w-full flex-row items-center justify-center px-4 py-2 ${banner.bg}`}
    >
      <Text className={`text-xs font-semibold ${banner.text}`}>
        {banner.message}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

type Banner = { message: string; bg: string; text: string };

function getBanner(state: SessionState): Banner | null {
  switch (state) {
    case SessionState.INITIALIZING:
      return {
        message: 'Starting session…',
        bg: 'bg-blue-500/80',
        text: 'text-white',
      };
    case SessionState.PAUSED:
      return {
        message: 'Session paused',
        bg: 'bg-yellow-500/80',
        text: 'text-black',
      };
    case SessionState.DEGRADED:
      return {
        message: 'Running in degraded mode — one modality unavailable',
        bg: 'bg-orange-500/80',
        text: 'text-white',
      };
    case SessionState.ERROR:
      return {
        message: 'Session error — please go back and try again',
        bg: 'bg-red-600/90',
        text: 'text-white',
      };
    default:
      return null;
  }
}
