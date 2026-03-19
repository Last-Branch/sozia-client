import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CircleCheckBig, CircleHelp, CircleUser, Hand, House, Mic } from 'lucide-react-native';

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

  const [activeTab, setActiveTab] = useState<'home' | 'help' | 'profile'>('home');
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  const tips = [
    'Tip: Ensure you are in a well-lit environment for accurate lip and sign tracking.',
    'Tip: Position your camera at eye level for best results.',
    'Tip: Minimize background noise for clearer speech detection.',
    'Tip: Keep your hands visible and centered for sign language.',
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % tips.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView className="flex-1 w-full self-stretch bg-gradient-to-br from-[#2ECC71]/5 via-white to-[#2ECC71]/5">
      <ScrollView className="flex-1 w-full" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 w-full items-center px-4 py-8">
          <View className="w-full max-w-sm overflow-hidden rounded-[32px] border-[12px] border-gray-800 bg-white shadow-2xl">
            <View className="flex-row items-center justify-between px-6 pt-6 pb-4">
              <Text className="text-3xl font-black text-gray-900">Hello!</Text>
              <TouchableOpacity
                className="h-10 w-10 items-center justify-center rounded-full bg-gray-100"
                onPress={onOpenSettings}
              >
                <CircleUser size={20} color="#374151" />
              </TouchableOpacity>
            </View>

            <View className="gap-6 px-6 pb-6">
              <TouchableOpacity
                className="relative min-h-[180px] items-center justify-center rounded-[32px] bg-gradient-to-br from-[#2ECC71] to-[#27AE60] p-8 shadow-xl"
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
                <Text className="mb-1 text-2xl font-black text-white">Start Lip Reading</Text>
                <Text className="max-w-[200px] text-center text-white/90">Real-time speech to text</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="relative min-h-[180px] items-center justify-center rounded-[32px] bg-gradient-to-br from-[#1E8449] to-[#145A32] p-8 shadow-xl"
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
                <Text className="mb-1 text-2xl font-black text-white">Start Sign Language</Text>
                <Text className="max-w-[200px] text-center text-white/90">
                  Gesture to text translation
                </Text>
              </TouchableOpacity>
            </View>

            <View className="px-6 pb-4">
              <View className="rounded-3xl border border-gray-100 bg-gray-50 p-4">
                <View className="flex-row items-start gap-3">
                  <CircleCheckBig size={24} color="#2ECC71" />
                  <View className="flex-1">
                    <Text className="mb-1 font-bold text-gray-900">Ready to Start?</Text>
                    <View className="mb-1 flex-row items-center gap-2">
                      <View className="h-2 w-2 rounded-full bg-[#2ECC71]" />
                      <Text className="text-sm text-gray-600">
                        Path: {activePath ?? 'not selected'} · State: {state}
                      </Text>
                    </View>
                    <Text className="text-xs text-gray-500">{tips[currentTipIndex]}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View className="border-t border-gray-200 bg-white px-6 py-3">
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
                    Home
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
                    Help
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
                    Profile
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
