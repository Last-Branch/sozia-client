import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown, ChevronUp, CircleCheckBig, CircleHelp, CircleUser, Hand, House, Mic, Settings } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';

import { ModalityPath, SessionState } from '@common/models';
import type { DeviceHandle } from '@/device/DeviceHandle';
import { DeviceSelector } from '../components/DeviceSelector';
import { useSessionController } from '../controller/SessionController';

export function DashboardScreen({
  onOpenLive,
  onOpenSettings,
  onOpenHelp,
  onOpenProfile,
  onOpenPermissions,
}: {
  onOpenLive: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onOpenProfile: () => void;
  onOpenPermissions: () => void;
}) {
  const { state, activePath, startSession, enumerateDevices, selectMicrophone, selectCamera, config } = useSessionController();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<'home' | 'help' | 'profile'>('home');
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [deviceSetupOpen, setDeviceSetupOpen] = useState(false);
  const [devices, setDevices] = useState<DeviceHandle[]>([]);
  const [selectedMicId, setSelectedMicId] = useState('');
  const [selectedCamId, setSelectedCamId] = useState('');

  const hasConsented = config.get('hasConsented');
  const canStart = (state === SessionState.IDLE || state === SessionState.ERROR) && hasConsented;

  const requestSession = useCallback((path: ModalityPath) => {
    if (!canStart) return;
    onOpenLive();
    void (async () => {
      try { await startSession(path); } catch (e) {
        if (__DEV__) console.warn('Session start failed', e);
      }
    })();
  }, [canStart, onOpenLive, startSession]);

  const loadDevices = useCallback(async () => {
    const list = await enumerateDevices();
    setDevices(list);

    const savedMic = config.get('selectedMicId');
    const micId = (savedMic && list.some((d) => d.deviceId === savedMic))
      ? savedMic
      : list.find((d) => d.kind === 'audioinput' && d.isDefault)?.deviceId ?? '';
    setSelectedMicId(micId);

    const savedCam = config.get('selectedCameraId');
    const camId = (savedCam && list.some((d) => d.deviceId === savedCam))
      ? savedCam
      : list.find((d) => d.kind === 'videoinput' && d.isDefault)?.deviceId ?? '';
    setSelectedCamId(camId);
  }, [enumerateDevices, config]);

  useEffect(() => {
    if (deviceSetupOpen) {
      void loadDevices();
    }
  }, [deviceSetupOpen, loadDevices]);

  const mics = devices.filter((d) => d.kind === 'audioinput');
  const cameras = devices.filter((d) => d.kind === 'videoinput');

  const tips = t('dashboard.tips', { returnObjects: true }) as string[];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % tips.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [tips.length]);

  return (
    <SafeAreaView className="flex-1 w-full self-stretch bg-gradient-to-br from-[#2ECC71]/5 via-white dark:via-gray-900 to-[#2ECC71]/5">
      <View className="flex-1 w-full bg-white dark:bg-gray-800">
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
                <Settings size={20} color="#374151" />
              </TouchableOpacity>
            </View>

            {!hasConsented && (
              <View className="mx-6 mb-4 rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30 px-4 py-4 gap-2">
                <Text className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  {t('dashboard.consentDeclinedWarning')}
                </Text>
                <TouchableOpacity onPress={onOpenPermissions}>
                  <Text className="text-sm font-bold text-[#2ECC71]">{t('dashboard.grantConsent')} →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Device Setup */}
            <View className="px-6 pb-2">
              <TouchableOpacity
                className={`flex-row items-center justify-between rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-4 py-3 ${!hasConsented ? 'opacity-40' : ''}`}
                onPress={() => { if (hasConsented) setDeviceSetupOpen((v) => !v); }}
                disabled={!hasConsented}
              >
                <Text className="font-semibold text-gray-900 dark:text-gray-100">
                  {t('device.setupDevices')}
                </Text>
                {deviceSetupOpen
                  ? <ChevronUp size={18} color="#9CA3AF" />
                  : <ChevronDown size={18} color="#9CA3AF" />}
              </TouchableOpacity>
              {deviceSetupOpen && (
                <View className="mt-2 gap-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-4">
                  <View>
                    <Text className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {t('device.selectMicrophone')}
                    </Text>
                    <DeviceSelector
                      devices={mics}
                      selectedDeviceId={selectedMicId}
                      onSelect={(id) => { setSelectedMicId(id); selectMicrophone(id); }}
                    />
                  </View>
                  <View>
                    <Text className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {t('device.selectCamera')}
                    </Text>
                    <DeviceSelector
                      devices={cameras}
                      selectedDeviceId={selectedCamId}
                      onSelect={(id) => { setSelectedCamId(id); selectCamera(id); }}
                    />
                  </View>
                </View>
              )}
            </View>

            <View className="gap-6 px-6 pb-6">
              <TouchableOpacity
                className={`relative min-h-[180px] items-center justify-center rounded-[32px] bg-[#2ECC71] p-8 shadow-xl ${!canStart ? 'opacity-50' : ''}`}
                disabled={!canStart}
                onPress={() => requestSession(ModalityPath.SPEECH)}
              >
                <View className="mb-4 h-24 w-24 items-center justify-center rounded-full bg-white/20">
                  <Mic size={56} color="#fff" />
                </View>
                <Text className="mb-1 text-center text-2xl font-black text-white">{t('dashboard.startLipReading')}</Text>
                <Text className="max-w-[200px] text-center text-white/90">{t('dashboard.startLipReadingDesc')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`relative min-h-[180px] items-center justify-center rounded-[32px] bg-[#1E8449] p-8 shadow-xl ${!canStart ? 'opacity-50' : ''}`}
                disabled={!canStart}
                onPress={() => requestSession(ModalityPath.SIGN)}
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
                  onPress={() => { setActiveTab('profile'); onOpenProfile(); }}
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
    </SafeAreaView>
  );
}
