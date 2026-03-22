import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CircleCheckBig, CircleHelp, CircleUser, Hand, House, Mic } from 'lucide-react-native';
import { useLanguage } from '../LanguageContext';

import { ModalityPath } from '../../common/models';
import { useSessionController } from '../SessionController';

export function DashboardScreen({
  onOpenLive,
  onOpenSettings,
  onOpenHelp,
}: {
  onOpenLive: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
}) {
  const { state, activePath, startSession } = useSessionController();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<'home' | 'help' | 'profile'>('home');
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  const tips = t('dashboard.tips', { returnObjects: true }) as string[];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % tips.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView className="flex-1 w-full self-stretch bg-gradient-to-br from-[#2ECC71]/5 via-white dark:via-gray-900 to-[#2ECC71]/5">
      <View className="flex-1 w-full items-center justify-center p-4">
        <View className="w-full flex-1 max-h-[1000px] max-w-sm overflow-hidden rounded-[40px] border-[12px] border-gray-800 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
          <ScrollView 
            className="flex-1 w-full" 
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-row items-center justify-between px-6 pt-6 pb-4">
              <Text className="text-3xl font-black text-gray-900 dark:text-gray-100">{t('dashboard.hello')}</Text>
              <TouchableOpacity
                className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
                onPress={onOpenSettings}
              >
                <CircleUser size={20} color="#374151" />
              </TouchableOpacity>
            </View>

            <View className="gap-6 px-6 pb-6">
              <TouchableOpacity
                className="relative min-h-[180px] items-center justify-center rounded-[32px] bg-[#2ECC71] p-8 shadow-xl"
                onPress={async () => {
                  if (state === 'IDLE') {
                    await startSession(ModalityPath.SPEECH);
                  }
                  onOpenLive();
                }}
              >
                <View className="mb-4 h-24 w-24 items-center justify-center rounded-full bg-white/20">
                  <Mic size={56} color="#fff" />
                </View>
                <Text className="mb-1 text-center text-2xl font-black text-white">{t('dashboard.startLipReading')}</Text>
                <Text className="max-w-[200px] text-center text-white/90">{t('dashboard.startLipReadingDesc')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="relative min-h-[180px] items-center justify-center rounded-[32px] bg-[#1E8449] p-8 shadow-xl"
                onPress={async () => {
                  if (state === 'IDLE') {
                    await startSession(ModalityPath.SIGN);
                  }
                  onOpenLive();
                }}
              >
                <View className="mb-4 h-24 w-24 items-center justify-center rounded-full bg-white/20">
                  <Hand size={56} color="#fff" />
                </View>
                <Text className="mb-1 text-center text-2xl font-black text-white">{t('dashboard.startSignLanguage')}</Text>
                <Text className="max-w-[200px] text-center text-white/90">
                  {t('dashboard.startSignLanguageDesc')}
                </Text>
              </TouchableOpacity>
            </View>

            <View className="px-6 pb-4">
              <View className="rounded-3xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-4">
                <View className="flex-row items-start gap-3">
                  <CircleCheckBig size={24} color="#2ECC71" />
                  <View className="flex-1">
                    <Text className="mb-1 font-bold text-gray-900 dark:text-gray-100">{t('dashboard.ready')}</Text>
                    <View className="mb-1 flex-row items-center gap-2">
                      <View className="h-2 w-2 rounded-full bg-[#2ECC71]" />
                      <Text className="text-sm text-gray-600 dark:text-gray-400">
                        {t('dashboard.path')}: {activePath ?? t('dashboard.notSelected')} · {t('dashboard.state')}: {state}
                      </Text>
                    </View>
                    <Text className="text-xs text-gray-500 dark:text-gray-400">{tips[currentTipIndex]}</Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>

          <View className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3">
              <View className="flex-row items-center justify-around">
                <TouchableOpacity
                  onPress={() => setActiveTab('home')}
                  className={`items-center gap-1 ${activeTab === 'home' ? 'text-[#2ECC71]' : 'text-gray-400'}`}
                >
                  <House size={24} color={activeTab === 'home' ? '#2ECC71' : '#9CA3AF'} />
                  <Text
                    className={`text-xs font-semibold ${
                      activeTab === 'home' ? 'text-[#2ECC71]' : 'text-gray-400'
                    }`}
                  >
                    {t('dashboard.home')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setActiveTab('help'); onOpenHelp(); }}
                  className={`items-center gap-1 ${activeTab === 'help' ? 'text-[#2ECC71]' : 'text-gray-400'}`}
                >
                  <CircleHelp size={24} color={activeTab === 'help' ? '#2ECC71' : '#9CA3AF'} />
                  <Text
                    className={`text-xs font-semibold ${
                      activeTab === 'help' ? 'text-[#2ECC71]' : 'text-gray-400'
                    }`}
                  >
                    {t('dashboard.help')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setActiveTab('profile'); onOpenSettings(); }}
                  className={`items-center gap-1 ${
                    activeTab === 'profile' ? 'text-[#2ECC71]' : 'text-gray-400'
                  }`}
                >
                  <CircleUser size={24} color={activeTab === 'profile' ? '#2ECC71' : '#9CA3AF'} />
                  <Text
                    className={`text-xs font-semibold ${
                      activeTab === 'profile' ? 'text-[#2ECC71]' : 'text-gray-400'
                    }`}
                  >
                    {t('dashboard.profile')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
    </SafeAreaView>
  );
}
