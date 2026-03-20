import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight, FileText, Globe, MessageCircle, Moon, Type } from 'lucide-react-native';

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [language, setLanguage] = useState<'TR' | 'EN'>('EN');
  const [darkMode, setDarkMode] = useState(false);
  const [textSize, setTextSize] = useState(100);
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);

  return (
    <SafeAreaView className="flex-1 w-full self-stretch bg-gradient-to-br from-[#2ECC71]/5 via-white to-[#2ECC71]/5">
      <ScrollView className="flex-1 w-full" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 w-full items-center px-4 py-8">
          <View className="w-full max-w-sm overflow-hidden rounded-[32px] border-[12px] border-gray-800 bg-white shadow-2xl">
            <View className="flex-row items-center gap-3 border-b border-gray-100 px-6 pb-4 pt-5">
              <TouchableOpacity
                className="h-10 w-10 items-center justify-center rounded-full bg-gray-100"
                onPress={onBack}
                hitSlop={8}
                activeOpacity={0.8}
              >
                <ArrowLeft size={18} color="#374151" />
              </TouchableOpacity>
              <Text className="text-3xl font-black text-gray-900">Settings</Text>
            </View>

            <View className="px-6 py-6">
              <View className="mb-6 rounded-3xl border border-gray-100 bg-gray-50 p-4">
                <View className="mb-3 flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-2xl bg-[#2ECC71]/10">
                    <Globe size={18} color="#2ECC71" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-gray-900">Language</Text>
                    <Text className="text-sm text-gray-500">Choose your preferred language</Text>
                  </View>
                </View>
                <View className="flex-row rounded-2xl bg-white p-1">
                  {(['TR', 'EN'] as const).map((option) => (
                    <TouchableOpacity
                      key={option}
                      className={`flex-1 rounded-2xl px-4 py-3 ${
                        language === option ? 'bg-[#2ECC71]' : 'bg-white'
                      }`}
                      onPress={() => setLanguage(option)}
                      activeOpacity={0.85}
                    >
                      <Text
                        className={`text-center font-semibold ${
                          language === option ? 'text-white' : 'text-gray-600'
                        }`}
                      >
                        {option === 'TR' ? 'Turkish (TR)' : 'English (EN)'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View className="mb-6 rounded-3xl border border-gray-100 bg-gray-50 p-4">
                <View className="flex-row items-center justify-between gap-4">
                  <View className="flex-1 flex-row items-center gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-2xl bg-gray-800/10">
                      <Moon size={18} color="#111827" />
                    </View>
                    <View className="flex-1">
                      <Text className="font-bold text-gray-900">Dark Mode</Text>
                      <Text className="text-sm text-gray-500">Reduce eye strain</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    className={`h-8 w-14 rounded-full p-1 ${
                      darkMode ? 'bg-[#2ECC71]' : 'bg-gray-300'
                    }`}
                    onPress={() => setDarkMode((value) => !value)}
                    activeOpacity={0.85}
                    hitSlop={8}
                  >
                    <View
                      className={`h-6 w-6 rounded-full bg-white ${darkMode ? 'ml-6' : 'ml-0'}`}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View className="mb-6 rounded-3xl border border-gray-100 bg-gray-50 p-4">
                <View className="mb-3 flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10">
                    <Type size={18} color="#2563EB" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-gray-900">Adjust Text Size</Text>
                    <Text className="text-sm text-gray-500">Customize subtitle size</Text>
                  </View>
                </View>
                <View className="flex-row gap-2">
                  {[80, 100, 130].map((size) => (
                    <TouchableOpacity
                      key={size}
                      className={`flex-1 rounded-2xl px-3 py-3 ${
                        textSize === size ? 'bg-[#2ECC71]' : 'bg-white'
                      }`}
                      onPress={() => setTextSize(size)}
                      activeOpacity={0.85}
                    >
                      <Text
                        className={`text-center text-sm font-semibold ${
                          textSize === size ? 'text-white' : 'text-gray-700'
                        }`}
                      >
                        {size}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                className="mb-4 rounded-3xl border border-gray-100 bg-gray-50 p-4"
                onPress={() => setShowPrivacyDetails((value) => !value)}
                activeOpacity={0.85}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 flex-row items-center gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/10">
                      <FileText size={18} color="#7C3AED" />
                    </View>
                    <View className="flex-1">
                      <Text className="font-bold text-gray-900">Privacy Policy</Text>
                      <Text className="text-sm text-gray-500">View our privacy terms</Text>
                    </View>
                  </View>
                  <ChevronRight
                    size={18}
                    color="#9CA3AF"
                    style={{ transform: [{ rotate: showPrivacyDetails ? '90deg' : '0deg' }] }}
                  />
                </View>
              </TouchableOpacity>

              {showPrivacyDetails && (
                <View className="mb-6 rounded-3xl border border-purple-100 bg-purple-50 p-4">
                  <Text className="text-sm leading-6 text-gray-700">
                    This prototype stores settings locally in screen state only. No personal data is
                    sent to a backend yet, and policy/legal content can be connected here once the
                    final documents are ready.
                  </Text>
                </View>
              )}

              <View className="mb-6 rounded-3xl border border-gray-100 bg-gray-50 p-4">
                <Text className="mb-2 font-bold text-gray-900">Current Preferences</Text>
                <Text className="text-sm text-gray-600">Language: {language}</Text>
                <Text className="text-sm text-gray-600">
                  Theme: {darkMode ? 'Dark mode enabled' : 'Light mode enabled'}
                </Text>
                <Text className="text-sm text-gray-600">Text size: {textSize}%</Text>
              </View>

              <View className="items-center pt-4">
                <View className="mb-3 h-16 w-16 items-center justify-center rounded-3xl bg-[#2ECC71] shadow-lg">
                  <MessageCircle size={32} color="#fff" />
                </View>
                <Text className="mb-1 text-2xl font-black text-gray-900">SOZIA</Text>
                <Text className="text-sm text-gray-500">Version 1.0.0</Text>
                <Text className="mt-1 text-xs text-gray-400">Assistive Communication</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
