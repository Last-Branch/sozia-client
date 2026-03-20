import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, MessageCircle, Mic } from 'lucide-react-native';

export function PermissionsScreen({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <SafeAreaView className="flex-1 w-full self-stretch bg-gradient-to-br from-[#2ECC71]/5 via-white to-[#2ECC71]/5">
      <ScrollView className="flex-1 w-full" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 w-full items-center justify-center px-4 py-8">
          <View className="w-full max-w-sm overflow-hidden rounded-[32px] border-[12px] border-gray-800 bg-white px-8 py-10 shadow-2xl">
            <View className="mb-8 items-center">
              <View className="mb-4 h-20 w-20 items-center justify-center rounded-3xl bg-[#2ECC71] shadow-lg">
                <MessageCircle size={48} color="#fff" />
              </View>
              <Text className="text-4xl font-black tracking-tight text-gray-900">SOZIA</Text>
            </View>

            <View className="mb-8 items-center px-2">
              <Text className="mb-2 text-center text-2xl font-black text-gray-900">Access Needed</Text>
              <Text className="text-center text-base text-gray-600">
                Sozia needs camera and microphone access to read lips and translate signs.
              </Text>
            </View>

            <View className="mb-8 flex-row justify-between gap-6">
              <View className="flex-1 items-center gap-3">
                <View className="h-20 w-20 items-center justify-center rounded-3xl bg-[#2ECC71]/10">
                  <Camera size={40} color="#2ECC71" />
                </View>
                <View className="items-center">
                  <Text className="font-bold text-gray-900">Camera</Text>
                  <Text className="text-xs text-gray-500">For lip reading</Text>
                </View>
              </View>
              <View className="flex-1 items-center gap-3">
                <View className="h-20 w-20 items-center justify-center rounded-3xl bg-[#2ECC71]/10">
                  <Mic size={40} color="#2ECC71" />
                </View>
                <View className="items-center">
                  <Text className="font-bold text-gray-900">Microphone</Text>
                  <Text className="text-xs text-gray-500">For audio input</Text>
                </View>
              </View>
            </View>

            <View className="mb-6 rounded-3xl border border-gray-100 bg-gray-50 p-4">
              <Text className="text-center text-sm text-gray-600">
                <Text className="font-semibold text-gray-900">Your privacy matters. </Text>
                All processing happens on your device. No video or audio is stored or transmitted.
              </Text>
            </View>

            <TouchableOpacity
              className="mb-3 h-14 w-full items-center justify-center rounded-2xl bg-[#2ECC71] shadow-xl"
              onPress={onNext}
              activeOpacity={0.9}
            >
              <Text className="text-base font-bold text-white">Allow Access</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="h-10 w-full items-center justify-center"
              onPress={onNext}
              activeOpacity={0.8}
            >
              <Text className="text-sm text-gray-400">Skip for now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="mt-4 h-10 w-full items-center justify-center"
              onPress={onBack}
              activeOpacity={0.8}
            >
              <Text className="text-sm font-semibold text-gray-500">Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
