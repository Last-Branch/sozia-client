import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { useLanguage } from '../../context/LanguageContext';
import { useSessionController } from '../../controller/SessionController';
import { getStatusBanner } from './helpers';

export function StatusBar() {
  const { state, healthReports, stopSession } = useSessionController();
  const { t } = useLanguage();
  const banner = getStatusBanner(state, healthReports);

  if (!banner) return null;

  return (
    <View
      className={`z-50 w-full flex-row items-center justify-center gap-2 px-4 py-2 ${banner.bg}`}
    >
      {banner.showSpinner && (
        <ActivityIndicator size="small" color="#ffffff" />
      )}
      <Text className={`text-xs font-semibold ${banner.text}`}>
        {t(banner.messageKey)}
      </Text>
      {banner.showRestart && (
        <TouchableOpacity
          className="ml-3 rounded-full bg-white/20 px-3 py-1"
          onPress={stopSession}
        >
          <Text className={`text-xs font-semibold ${banner.text}`}>
            {t('health.restart')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
