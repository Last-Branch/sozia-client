import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Apple, Eye, EyeOff, Lock, Mail, MessageCircle } from 'lucide-react-native';

export function LoginScreen({
  onSignIn,
  onSignUp,
}: {
  onSignIn: () => void;
  onSignUp: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [language, setLanguage] = useState<'TR' | 'EN'>('EN');

  return (
    <SafeAreaView className="flex-1 w-full self-stretch bg-gradient-to-br from-[#2ECC71]/10 via-white dark:via-gray-900 to-[#2ECC71]/5">
      <ScrollView
        className="flex-1 w-full"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 w-full items-center justify-center px-4 py-8">
          <View className="w-full max-w-sm overflow-hidden rounded-[32px] border-[12px] border-gray-800 dark:border-gray-700 bg-white dark:bg-gray-800 px-8 py-8 shadow-2xl">
            <View className="mb-4 items-end">
              <View className="flex-row rounded-full bg-gray-100 dark:bg-gray-800 p-1">
                <TouchableOpacity
                  onPress={() => setLanguage('TR')}
                  className={`rounded-full px-3 py-2 ${
                    language === 'TR' ? 'bg-[#2ECC71] shadow-sm' : ''
                  }`}
                  activeOpacity={0.85}
                >
                  <Text className={language === 'TR' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}>TR</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setLanguage('EN')}
                  className={`rounded-full px-3 py-2 ${
                    language === 'EN' ? 'bg-[#2ECC71] shadow-sm' : ''
                  }`}
                  activeOpacity={0.85}
                >
                  <Text className={language === 'EN' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}>EN</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View className="mb-10 items-center">
              <View className="mb-4 h-20 w-20 items-center justify-center rounded-3xl bg-[#2ECC71] shadow-lg">
                <MessageCircle size={48} color="#fff" />
              </View>
              <Text className="mb-1 text-5xl font-black tracking-tight text-gray-900 dark:text-gray-100">SOZIA</Text>
              <Text className="text-gray-500 dark:text-gray-400">
                {language === 'EN' ? 'Assistive Communication' : 'Yardimci Iletisim'}
              </Text>
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-gray-700 dark:text-gray-300">{language === 'EN' ? 'Email' : 'E-posta'}</Text>
              <View className="relative flex-row items-center">
                <Mail size={20} color="#9CA3AF" style={{ position: 'absolute', left: 16, zIndex: 1 }} />
                <TextInput
                  keyboardType="email-address"
                  placeholder={language === 'EN' ? 'your.email@example.com' : 'ornek@email.com'}
                  placeholderTextColor="#9CA3AF"
                  className="h-14 w-full rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-12 pr-4 text-base text-gray-900 dark:text-gray-100"
                />
              </View>
            </View>

            <View className="mb-3">
              <Text className="mb-2 text-gray-700 dark:text-gray-300">
                {language === 'EN' ? 'Password' : 'Sifre'}
              </Text>
              <View className="relative flex-row items-center">
                <Lock size={20} color="#9CA3AF" style={{ position: 'absolute', left: 16, zIndex: 1 }} />
                <TextInput
                  secureTextEntry={!showPassword}
                  placeholder={language === 'EN' ? 'Enter your password' : 'Sifrenizi girin'}
                  placeholderTextColor="#9CA3AF"
                  className="h-14 w-full rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-12 pr-14 text-base text-gray-900 dark:text-gray-100"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  className="absolute right-4 h-8 w-8 items-center justify-center"
                  activeOpacity={0.8}
                  hitSlop={8}
                >
                  {showPassword ? (
                    <EyeOff size={20} color="#9CA3AF" />
                  ) : (
                    <Eye size={20} color="#9CA3AF" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View className="mb-4 items-end">
              <TouchableOpacity activeOpacity={0.8}>
                <Text className="text-sm text-[#2ECC71]">
                  {language === 'EN' ? 'Forgot Password?' : 'Sifremi Unuttum?'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              className="mb-4 h-14 w-full items-center justify-center rounded-2xl bg-[#2ECC71] shadow-lg"
              onPress={onSignIn}
              activeOpacity={0.9}
            >
              <Text className="text-base font-semibold text-white">
                {language === 'EN' ? 'Sign In' : 'Giris Yap'}
              </Text>
            </TouchableOpacity>

            <View className="mb-4 flex-row items-center">
              <View className="h-px flex-1 bg-gray-200" />
              <Text className="px-3 text-sm text-gray-400">
                {language === 'EN' ? 'or continue with' : 'veya sununla devam et'}
              </Text>
              <View className="h-px flex-1 bg-gray-200" />
            </View>

            <View className="mb-6 flex-row gap-3">
              <TouchableOpacity
                className="h-14 flex-1 flex-row items-center justify-center rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                activeOpacity={0.85}
              >
                <Text className="mr-2 text-base text-gray-700 dark:text-gray-300">G</Text>
                <Text className="text-base text-gray-700 dark:text-gray-300">Google</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="h-14 flex-1 flex-row items-center justify-center rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                activeOpacity={0.85}
              >
                <Apple size={20} color="#111827" style={{ marginRight: 8 }} />
                <Text className="text-base text-gray-700 dark:text-gray-300">Apple</Text>
              </TouchableOpacity>
            </View>

            <View className="items-center border-t border-gray-100 dark:border-gray-700 pt-4">
              <View className="flex-row items-center">
                <Text className="text-gray-600 dark:text-gray-400">
                  {language === 'EN' ? "Don't have an account? " : 'Hesabiniz yok mu? '}
                </Text>
                <TouchableOpacity onPress={onSignUp} hitSlop={8} activeOpacity={0.8}>
                  <Text className="font-semibold text-[#2ECC71]">
                    {language === 'EN' ? 'Sign Up' : 'Kayit Ol'}
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
