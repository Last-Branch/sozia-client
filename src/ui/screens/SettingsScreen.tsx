import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { useLanguage } from '../LanguageContext';
import { ArrowLeft, ChevronRight, FileText, Globe, MessageCircle, Moon } from 'lucide-react-native';

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { t, language, setLanguage } = useLanguage();
  const { colorScheme, setColorScheme } = useColorScheme();
  const darkMode = colorScheme === 'dark';
  const toggleDarkMode = () => setColorScheme(darkMode ? 'light' : 'dark');
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);

  return (
    <SafeAreaView className="flex-1 w-full self-stretch bg-gradient-to-br from-[#2ECC71]/5 via-white dark:via-gray-900 to-[#2ECC71]/5">
      <View className="flex-1 w-full items-center justify-center p-4">
        <View className="w-full flex-1 max-h-[1000px] max-w-sm overflow-hidden rounded-[40px] border-[12px] border-gray-800 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
            <View className="mb-6 flex-row items-center px-4 pt-4">
        <TouchableOpacity
          onPress={onBack}
          className="mr-3 h-10 w-10 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800"
          activeOpacity={0.8}
        >
          <ArrowLeft size={20} color={darkMode ? '#D1D5DB' : '#374151'} />
        </TouchableOpacity>
        <Text className="text-3xl font-black text-gray-900 dark:text-gray-100">{t('settings.title')}</Text>
      </View>

      <ScrollView className="flex-1 w-full px-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="mb-6 rounded-3xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-4 shadow-sm">
          <View className="mb-4 flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-2xl bg-[#2ECC71]/10">
              <Globe size={18} color="#2ECC71" />
            </View>
            <View className="flex-1">
              <Text className="font-bold text-gray-900 dark:text-gray-100">{t('settings.language')}</Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">{t('settings.languageDesc')}</Text>
            </View>
          </View>
          <View className="flex-row gap-2">
            {['TR', 'EN'].map((option) => (
              <TouchableOpacity
                key={option}
                className="flex-1 rounded-2xl px-3 py-3"
                style={language === option ? { backgroundColor: '#2ECC71' } : { backgroundColor: darkMode ? '#1f2937' : '#ffffff' }}
                onPress={() => setLanguage(option as 'EN' | 'TR')}
                activeOpacity={0.85}
              >
                <Text
                  style={language === option ? { color: '#ffffff', fontWeight: '600', textAlign: 'center' } : { color: darkMode ? '#d1d5db' : '#374151', fontWeight: '600', textAlign: 'center' }}
                >
                  {option === 'TR' ? t('settings.tr') : t('settings.en')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="mb-6 rounded-3xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-4 shadow-sm">
          <View className="flex-row gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/10">
              <Moon size={18} color="#A855F7" />
            </View>
            <View className="flex-1 justify-center">
              <Text className="font-bold text-gray-900 dark:text-gray-100">{t('settings.darkMode')}</Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">{t('settings.darkModeDesc')}</Text>
            </View>
            <TouchableOpacity
              className={`h-8 w-14 justify-center rounded-full px-1 ${
                darkMode ? 'bg-[#2ECC71]' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              onPress={toggleDarkMode}
              activeOpacity={0.8}
            >
              <View
                className="h-6 w-6 rounded-full bg-white shadow-sm"
                style={{
                  transform: [{ translateX: darkMode ? 24 : 0 }],
                }}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          className="mb-4 rounded-3xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-4 shadow-sm"
          onPress={() => setShowPrivacyDetails((value) => !value)}
          activeOpacity={0.85}
        >
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-2xl bg-orange-500/10">
              <FileText size={18} color="#F97316" />
            </View>
            <View className="flex-1">
              <Text className="font-bold text-gray-900 dark:text-gray-100">{t('settings.privacyPolicy')}</Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">{t('settings.privacyPolicyDesc')}</Text>
            </View>
            <ChevronRight size={20} color="#9CA3AF" style={{ transform: [{ rotate: showPrivacyDetails ? '90deg' : '0deg' }] }} />
          </View>
          {showPrivacyDetails && (
            <View className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
              <Text className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                {t('settings.privacyDetails')}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View className="mt-8">
          <Text className="mb-4 pl-1 text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {t('settings.currentPrefs')}
          </Text>
          <View className="rounded-3xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-5 shadow-sm">
            <Text className="mb-2 text-sm text-gray-600 dark:text-gray-400">
              {t('settings.langPref')}: {language === 'EN' ? t('settings.en') : t('settings.tr')}
            </Text>
            <Text className="text-sm text-gray-600 dark:text-gray-400">
              {t('settings.themePref')}: {darkMode ? t('settings.darkEnabled') : t('settings.lightEnabled')}
            </Text>
          </View>

          <View className="items-center pt-4">
            <View className="mb-2 h-16 w-16 items-center justify-center rounded-[24px] bg-[#2ECC71]/10">
              <MessageCircle size={32} color="#2ECC71" />
            </View>
            <Text className="text-xl font-black text-gray-900 dark:text-gray-100">SOZIA</Text>
            <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500">{t('settings.version')}</Text>
          </View>
        </View>
      </ScrollView>
          </View>
        </View>
    </SafeAreaView>
  );
}
