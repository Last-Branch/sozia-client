import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, MessageCircle, Mic } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

export function PermissionsScreen({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { t } = useTranslation();

  return (
    <SafeAreaView className="flex-1 w-full self-stretch bg-gradient-to-br from-[#2ECC71]/5 via-white dark:via-gray-900 to-[#2ECC71]/5">
      <View className="flex-1 w-full items-center justify-center p-4">
        <View className="w-full flex-1 max-h-[1000px] max-w-sm overflow-hidden rounded-[40px] border-[12px] border-gray-800 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
          <ScrollView
            className="flex-1 w-full"
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 32, paddingVertical: 40 }}
            showsVerticalScrollIndicator={false}
          >
            <View className="mb-8 items-center">
              <View className="mb-4 h-20 w-20 items-center justify-center rounded-3xl bg-[#2ECC71] shadow-lg">
                <MessageCircle size={48} color="#fff" />
              </View>
              <Text className="text-4xl font-black tracking-tight text-gray-900 dark:text-gray-100">SOZIA</Text>
            </View>

            <View className="mb-8 items-center px-2">
              <Text className="mb-2 text-center text-2xl font-black text-gray-900 dark:text-gray-100">{t('permissions.accessNeeded')}</Text>
              <Text className="text-center text-base text-gray-600 dark:text-gray-400">
                {t('permissions.description')}
              </Text>
            </View>

            <View className="mb-8 flex-row justify-between gap-6">
              <View className="flex-1 items-center gap-3">
                <View className="h-20 w-20 items-center justify-center rounded-3xl bg-[#2ECC71]/10">
                  <Camera size={40} color="#2ECC71" />
                </View>
                <View className="items-center">
                  <Text className="font-bold text-gray-900 dark:text-gray-100">{t('permissions.camera')}</Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400">{t('permissions.cameraDesc')}</Text>
                </View>
              </View>
              <View className="flex-1 items-center gap-3">
                <View className="h-20 w-20 items-center justify-center rounded-3xl bg-[#2ECC71]/10">
                  <Mic size={40} color="#2ECC71" />
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

            <TouchableOpacity
              className="mb-3 h-14 w-full items-center justify-center rounded-2xl bg-[#2ECC71] shadow-xl"
              onPress={onNext}
              activeOpacity={0.9}
            >
              <Text className="text-base font-bold text-white">{t('permissions.allowAccess')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="h-10 w-full items-center justify-center"
              onPress={onNext}
              activeOpacity={0.8}
            >
              <Text className="text-sm text-gray-400">{t('permissions.skip')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="mt-4 h-10 w-full items-center justify-center"
              onPress={onBack}
              activeOpacity={0.8}
            >
              <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400">{t('permissions.back')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}
