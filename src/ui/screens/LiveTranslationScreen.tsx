import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown, CircleX, Settings, SwitchCamera } from 'lucide-react-native';

import { useSessionController } from '../SessionController';

export function LiveTranslationScreen({ onBack }: { onBack: () => void }) {
  const { state, sessionId, activePath, stopSession } = useSessionController();

  const [language, setLanguage] = useState<'TR' | 'EN'>('EN');
  const [showSettings, setShowSettings] = useState(false);
  const [textSize, setTextSize] = useState(100);
  const [groupMode, setGroupMode] = useState(false);

  const baseFontSize = Math.max(24, (textSize / 100) * 30);

  return (
    <SafeAreaView className="flex-1 w-full self-stretch bg-gradient-to-br from-[#2ECC71]/5 via-white to-[#2ECC71]/5">
      <ScrollView className="flex-1 w-full" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 w-full items-center justify-center px-4 py-8">
          <View className="h-[680px] w-full max-w-sm rounded-[32px] border-[12px] border-gray-800 bg-black shadow-2xl overflow-hidden">
          {/* Top bar */}
          <View className="z-20 flex-row items-center justify-between bg-black/30 px-6 pt-3 pb-2">
            <Text className="text-xs font-semibold text-white">Sozia · {state}</Text>
            <TouchableOpacity onPress={onBack}>
              <Text className="text-xs font-semibold text-gray-300">Back</Text>
            </TouchableOpacity>
          </View>

          <View className="relative flex-1">
            {/* Camera background */}
            <View className="absolute inset-0 items-center justify-center bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900">
              <View className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/60" />
              <View className="z-0 items-center">
                <View className="mb-3 h-24 w-24 items-center justify-center rounded-full border-2 border-white/20">
                  <View className="h-16 w-16 rounded-full border-2 border-white/30" />
                </View>
                <Text className="text-sm font-medium text-white/40">Camera Feed Active</Text>
              </View>
            </View>

            {/* Active indicator */}
            <View className="absolute left-6 top-6 z-30 flex-row items-center gap-2 rounded-full border border-white/20 bg-black/60 px-4 py-2.5">
              <View className="relative">
                <View className="h-3 w-3 rounded-full bg-[#2ECC71]" />
              </View>
              <Text className="text-xs font-semibold text-white">Listening & Reading…</Text>
            </View>

            {/* Controls */}
            <View className="absolute right-6 top-6 z-30 flex-row items-center gap-3">
              <TouchableOpacity className="h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/60">
                <SwitchCamera size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                className="h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/60"
                onPress={() => setShowSettings((v) => !v)}
              >
                <Settings size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                className="h-12 w-12 items-center justify-center rounded-full border-2 border-red-400 bg-red-500"
                onPress={() => {
                  stopSession();
                  onBack();
                }}
              >
                <CircleX size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Settings popover */}
            {showSettings && (
              <View className="absolute right-6 top-20 z-40 w-72 rounded-3xl border border-gray-200 bg-white/95 p-5">
                <View className="mb-3 flex-row items-center justify-between border-b border-gray-200 pb-2">
                  <Text className="font-bold text-gray-900">Settings</Text>
                  <TouchableOpacity onPress={() => setShowSettings(false)}>
                    <ChevronDown size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                {/* Language */}
                <View className="mb-4">
                  <Text className="mb-2 text-sm font-semibold text-gray-900">Output Language</Text>
                  <View className="inline-flex w-full flex-row rounded-full bg-gray-100 p-1">
                    <TouchableOpacity
                      className={`flex-1 rounded-full px-4 py-2.5 text-sm font-bold ${
                        language === 'TR' ? 'bg-[#2ECC71] text-white shadow-md' : 'text-gray-600'
                      }`}
                      onPress={() => setLanguage('TR')}
                    >
                      <Text className={language === 'TR' ? 'text-white' : 'text-gray-600'}>
                        Turkish (TR)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className={`flex-1 rounded-full px-4 py-2.5 text-sm font-bold ${
                        language === 'EN' ? 'bg-[#2ECC71] text-white shadow-md' : 'text-gray-600'
                      }`}
                      onPress={() => setLanguage('EN')}
                    >
                      <Text className={language === 'EN' ? 'text-white' : 'text-gray-600'}>
                        English (EN)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Text size (simple preset buttons for RN) */}
                <View className="mb-4">
                  <Text className="mb-2 text-sm font-semibold text-gray-900">Text Size</Text>
                  <View className="flex-row justify-between">
                    {[80, 100, 130].map((size) => (
                      <TouchableOpacity
                        key={size}
                        className={`flex-1 items-center rounded-full px-3 py-2 ${
                          textSize === size ? 'bg-[#2ECC71] shadow-md' : 'bg-gray-100'
                        } mx-1`}
                        onPress={() => setTextSize(size)}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            textSize === size ? 'text-white' : 'text-gray-700'
                          }`}
                        >
                          {size}%
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Group mode */}
                <View className="flex-row items-center justify-between border-t border-gray-200 pt-3">
                  <View>
                    <Text className="text-sm font-semibold text-gray-900">Group Mode</Text>
                    <Text className="mt-0.5 text-xs text-gray-500">Track multiple speakers</Text>
                  </View>
                  <TouchableOpacity
                    className={`h-7 w-12 rounded-full p-1 ${
                      groupMode ? 'bg-[#2ECC71]' : 'bg-gray-200'
                    }`}
                    onPress={() => setGroupMode((v) => !v)}
                  >
                    <View
                      className={`h-5 w-5 rounded-full bg-white ${
                        groupMode ? 'ml-5' : 'ml-0'
                      }`}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Subtitle overlay */}
            <View className="absolute bottom-0 left-0 right-0 z-30 flex-col justify-end pb-6">
              <View className="mx-4 rounded-3xl border-t-2 border-white/20 bg-black/75 px-6 py-8">
                {groupMode && (
                  <View className="mb-2 flex-row items-center justify-center gap-2">
                    <View className="h-2.5 w-2.5 rounded-full bg-[#2ECC71]" />
                    <Text className="text-sm font-bold text-[#2ECC71]">Speaker 1</Text>
                  </View>
                )}
                <Text
                  className="text-center font-bold leading-relaxed text-white"
                  style={{ fontSize: baseFontSize }}
                >
                  {language === 'TR'
                    ? 'Merhaba, bugün size nasıl yardımcı olabilirim?'
                    : 'Hello, how can I help you today?'}
                </Text>
                <View className="mt-3 items-center">
                  <Text className="text-xs text-gray-400">
                    Session {sessionId ?? '—'} · Path {activePath ?? '—'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
