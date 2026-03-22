import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Apple, Eye, EyeOff, Lock, Mail, MessageCircle, User } from 'lucide-react-native';
import { useLanguage } from '../LanguageContext';

export function SignUpScreen({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { t, language, setLanguage } = useLanguage();

  return (
    <SafeAreaView className="flex-1 w-full self-stretch bg-gradient-to-br from-[#2ECC71]/10 via-white dark:via-gray-900 to-[#2ECC71]/5">
      <View className="flex-1 w-full items-center justify-center p-4">
        <View className="w-full flex-1 max-h-[1000px] max-w-sm overflow-hidden rounded-[40px] border-[12px] border-gray-800 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
          <ScrollView
            className="flex-1 w-full"
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View className="mb-4 items-end">
              <View className="flex-row rounded-full bg-gray-100 dark:bg-gray-800 p-1">
                <TouchableOpacity
                  onPress={() => setLanguage('TR')}
                  className="rounded-full px-3 py-2"
                  style={language === 'TR' ? { backgroundColor: '#2ECC71' } : {}}
                  activeOpacity={0.85}
                >
                  <Text style={language === 'TR' ? { color: '#ffffff', fontWeight: 'bold' } : { color: '#4b5563', fontWeight: 'bold' }}>TR</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setLanguage('EN')}
                  className="rounded-full px-3 py-2"
                  style={language === 'EN' ? { backgroundColor: '#2ECC71' } : {}}
                  activeOpacity={0.85}
                >
                  <Text style={language === 'EN' ? { color: '#ffffff', fontWeight: 'bold' } : { color: '#4b5563', fontWeight: 'bold' }}>EN</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View className="mb-8 items-center">
              <View className="mb-4 h-20 w-20 items-center justify-center rounded-3xl bg-[#2ECC71] shadow-lg">
                <MessageCircle size={48} color="#fff" />
              </View>
              <Text className="mb-1 text-5xl font-black tracking-tight text-gray-900 dark:text-gray-100">SOZIA</Text>
              <Text className="text-gray-500 dark:text-gray-400">
                {t('signup.subtitle')}
              </Text>
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-gray-700 dark:text-gray-300">
                {t('signup.fullName')}
              </Text>
              <View className="relative flex-row items-center">
                <User size={20} color="#9CA3AF" style={{ position: 'absolute', left: 16, zIndex: 1 }} />
                <TextInput
                  placeholder={t('signup.fullNamePlaceholder')}
                  placeholderTextColor="#9CA3AF"
                  className="h-14 w-full rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-12 pr-4 text-base text-gray-900 dark:text-gray-100"
                />
              </View>
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-gray-700 dark:text-gray-300">{t('login.email')}</Text>
              <View className="relative flex-row items-center">
                <Mail size={20} color="#9CA3AF" style={{ position: 'absolute', left: 16, zIndex: 1 }} />
                <TextInput
                  keyboardType="email-address"
                  placeholder={t('login.emailPlaceholder')}
                  placeholderTextColor="#9CA3AF"
                  className="h-14 w-full rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-12 pr-4 text-base text-gray-900 dark:text-gray-100"
                />
              </View>
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-gray-700 dark:text-gray-300">
                {t('login.password')}
              </Text>
              <View className="relative flex-row items-center">
                <Lock size={20} color="#9CA3AF" style={{ position: 'absolute', left: 16, zIndex: 1 }} />
                <TextInput
                  secureTextEntry={!showPassword}
                  placeholder={t('login.passwordPlaceholder')}
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

            <View className="mb-6">
              <Text className="mb-2 text-gray-700 dark:text-gray-300">
                {t('signup.confirmPassword')}
              </Text>
              <View className="relative flex-row items-center">
                <Lock size={20} color="#9CA3AF" style={{ position: 'absolute', left: 16, zIndex: 1 }} />
                <TextInput
                  secureTextEntry={!showConfirmPassword}
                  placeholder={t('signup.confirmPasswordPlaceholder')}
                  placeholderTextColor="#9CA3AF"
                  className="h-14 w-full rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-12 pr-14 text-base text-gray-900 dark:text-gray-100"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 h-8 w-8 items-center justify-center"
                  activeOpacity={0.8}
                  hitSlop={8}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={20} color="#9CA3AF" />
                  ) : (
                    <Eye size={20} color="#9CA3AF" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              className="mb-4 h-14 w-full items-center justify-center rounded-2xl bg-[#2ECC71] shadow-lg"
              onPress={onNext}
              activeOpacity={0.9}
            >
              <Text className="text-base font-semibold text-white">
                {t('signup.createAccount')}
              </Text>
            </TouchableOpacity>

            <View className="mb-4 flex-row items-center">
              <View className="h-px flex-1 bg-gray-200 dark:border-gray-700" />
              <Text className="px-3 text-sm text-gray-400 dark:text-gray-500">
                {t('signup.orSignUpWith')}
              </Text>
              <View className="h-px flex-1 bg-gray-200 dark:border-gray-700" />
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
                <Apple size={20} color="#9ca3af" style={{ marginRight: 8 }} />
                <Text className="text-base text-gray-700 dark:text-gray-300">Apple</Text>
              </TouchableOpacity>
            </View>

            <View className="items-center border-t border-gray-100 dark:border-gray-700 pt-4">
              <View className="flex-row items-center">
                <Text className="text-gray-600 dark:text-gray-400">
                  {t('signup.haveAccount')}
                </Text>
                <TouchableOpacity onPress={onBack} hitSlop={8} activeOpacity={0.8}>
                  <Text className="font-semibold text-[#2ECC71]">
                    {t('login.signIn')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}
