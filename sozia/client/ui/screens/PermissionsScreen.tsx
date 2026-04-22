import { requestRecordingPermissionsAsync } from 'expo-audio';
import { Camera as ExpoCamera } from 'expo-camera';
import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, Mic } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import { useSessionController } from '../controller/SessionController';
import { SoziaLogo } from '../components/SoziaLogo';

export function PermissionsScreen({ onNext }: { onNext: () => void }) {
  const { t } = useLanguage();
  const { config } = useSessionController();

  const [isRequesting, setIsRequesting] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const handleAccept = async () => {
    if (isRequesting) return;
    setIsRequesting(true);
    setPermissionError(null);
    try {
      const cameraPermission = await ExpoCamera.requestCameraPermissionsAsync();
      const microphonePermission = await requestRecordingPermissionsAsync();
      if (!cameraPermission.granted || !microphonePermission.granted) {
        setPermissionError(t('permissions.permissionError'));
        return;
      }
      config.set('hasConsented', true);
      onNext();
    } catch {
      setPermissionError(t('permissions.permissionError'));
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDecline = () => {
    config.set('hasConsented', false);
    onNext();
  };

  return (
    <SafeAreaView className="flex-1 w-full self-stretch bg-gradient-to-br from-[#2ECC71]/5 via-white dark:via-gray-900 to-[#2ECC71]/5">
      <View className="flex-1 w-full bg-white dark:bg-gray-800">
        <ScrollView
          className="flex-1 w-full"
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 32, paddingVertical: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-8 items-center">
            <SoziaLogo size={80} style={{ marginBottom: 16 }} />
            <Text className="text-4xl font-black tracking-tight text-gray-900 dark:text-gray-100">SOZIA</Text>
          </View>

          <View className="mb-6 items-center px-2">
            <Text className="mb-3 text-center text-2xl font-black text-gray-900 dark:text-gray-100">
              {t('consent.title')}
            </Text>
            <Text className="text-center text-sm leading-6 text-gray-600 dark:text-gray-400">
              {t('consent.body')}
            </Text>
          </View>

          <View className="mb-6 flex-row justify-between gap-6">
            <View className="flex-1 items-center gap-3">
              <View className="h-16 w-16 items-center justify-center rounded-3xl bg-[#2ECC71]/10">
                <Camera size={32} color="#2ECC71" />
              </View>
              <View className="items-center">
                <Text className="font-bold text-gray-900 dark:text-gray-100">{t('permissions.camera')}</Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400">{t('permissions.cameraDesc')}</Text>
              </View>
            </View>
            <View className="flex-1 items-center gap-3">
              <View className="h-16 w-16 items-center justify-center rounded-3xl bg-[#2ECC71]/10">
                <Mic size={32} color="#2ECC71" />
              </View>
              <View className="items-center">
                <Text className="font-bold text-gray-900 dark:text-gray-100">{t('permissions.microphone')}</Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400">{t('permissions.micDesc')}</Text>
              </View>
            </View>
          </View>

          <View className="mb-6 rounded-3xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-4">
            <Text className="text-center text-sm text-gray-600 dark:text-gray-400">
              <Text className="font-semibold text-gray-900 dark:text-gray-100">{t('permissions.privacy')} </Text>
              {t('permissions.privacyDesc')}
            </Text>
          </View>

          {permissionError && (
            <View className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/40">
              <Text className="text-center text-sm text-red-700 dark:text-red-300">
                {permissionError}
              </Text>
            </View>
          )}

          <TouchableOpacity
            className={`mb-3 h-14 w-full items-center justify-center rounded-2xl bg-[#2ECC71] shadow-xl ${isRequesting ? 'opacity-70' : ''}`}
            onPress={() => { void handleAccept(); }}
            activeOpacity={0.9}
            disabled={isRequesting}
          >
            <Text className="text-base font-bold text-white">
              {isRequesting ? t('permissions.requestingAccess') : t('consent.accept')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="h-14 w-full items-center justify-center rounded-2xl border border-gray-200 dark:border-gray-700"
            onPress={handleDecline}
            activeOpacity={0.8}
            disabled={isRequesting}
          >
            <Text className="text-base font-semibold text-gray-600 dark:text-gray-400">{t('consent.decline')}</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
