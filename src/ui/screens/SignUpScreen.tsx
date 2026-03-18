import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Apple, Eye, EyeOff, Lock, Mail, MessageCircle, User } from 'lucide-react-native';

export function SignUpScreen({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [language, setLanguage] = useState<'TR' | 'EN'>('EN');

  return (
    <SafeAreaView className="flex-1 w-full self-stretch bg-gradient-to-br from-[#2ECC71]/10 via-white to-[#2ECC71]/5">
      <ScrollView className="flex-1 w-full" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 w-full items-center justify-center px-4 py-8">
          <View className="w-full max-w-sm rounded-[32px] bg-white px-8 py-8 shadow-2xl">
          {/* Language toggle */}
          <View className="mb-4 items-end">
            <View className="inline-flex flex-row rounded-full bg-gray-100 p-1">
              <TouchableOpacity
                onPress={() => setLanguage('TR')}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  language === 'TR' ? 'bg-[#2ECC71] text-white shadow-sm' : 'text-gray-600'
                }`}
              >
                <Text className={language === 'TR' ? 'text-white' : 'text-gray-600'}>TR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setLanguage('EN')}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  language === 'EN' ? 'bg-[#2ECC71] text-white shadow-sm' : 'text-gray-600'
                }`}
              >
                <Text className={language === 'EN' ? 'text-white' : 'text-gray-600'}>EN</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Logo / brand */}
          <View className="mb-8 items-center">
            <View className="mb-4 h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#2ECC71] to-[#27AE60] shadow-lg">
              <MessageCircle size={48} color="#fff" />
            </View>
            <Text className="mb-1 text-5xl font-black tracking-tight text-gray-900">SOZIA</Text>
            <Text className="text-gray-500">
              {language === 'EN' ? 'Create your account' : 'Hesap Oluştur'}
            </Text>
          </View>

          {/* Full name */}
          <View className="mb-4">
            <Text className="mb-2 text-gray-700">
              {language === 'EN' ? 'Full Name' : 'Ad Soyad'}
            </Text>
            <View className="relative flex-row items-center">
              <User size={20} color="#9CA3AF" style={{ position: 'absolute', left: 16, zIndex: 1 }} />
              <TextInput
                placeholder={language === 'EN' ? 'John Doe' : 'Ad Soyad'}
                placeholderTextColor="#9CA3AF"
                className="h-14 w-full rounded-2xl border-2 border-gray-200 bg-white pl-12 pr-4 text-base text-gray-900"
              />
            </View>
          </View>

          {/* Email */}
          <View className="mb-4">
            <Text className="mb-2 text-gray-700">
              {language === 'EN' ? 'Email' : 'E-posta'}
            </Text>
            <View className="relative flex-row items-center">
              <Mail size={20} color="#9CA3AF" style={{ position: 'absolute', left: 16, zIndex: 1 }} />
              <TextInput
                keyboardType="email-address"
                placeholder={
                  language === 'EN' ? 'your.email@example.com' : 'ornek@email.com'
                }
                placeholderTextColor="#9CA3AF"
                className="h-14 w-full rounded-2xl border-2 border-gray-200 bg-white pl-12 pr-4 text-base text-gray-900"
              />
            </View>
          </View>

          {/* Password */}
          <View className="mb-4">
            <Text className="mb-2 text-gray-700">
              {language === 'EN' ? 'Password' : 'Şifre'}
            </Text>
            <View className="relative flex-row items-center">
              <Lock size={20} color="#9CA3AF" style={{ position: 'absolute', left: 16, zIndex: 1 }} />
              <TextInput
                secureTextEntry={!showPassword}
                placeholder={
                  language === 'EN' ? 'Enter your password' : 'Şifrenizi girin'
                }
                placeholderTextColor="#9CA3AF"
                className="h-14 w-full rounded-2xl border-2 border-gray-200 bg-white pl-12 pr-12 text-base text-gray-900"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                className="absolute right-4"
              >
                {showPassword ? (
                  <EyeOff size={20} color="#9CA3AF" />
                ) : (
                  <Eye size={20} color="#9CA3AF" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm password */}
          <View className="mb-6">
            <Text className="mb-2 text-gray-700">
              {language === 'EN' ? 'Confirm Password' : 'Şifre Tekrar'}
            </Text>
            <View className="relative flex-row items-center">
              <Lock size={20} color="#9CA3AF" style={{ position: 'absolute', left: 16, zIndex: 1 }} />
              <TextInput
                secureTextEntry={!showConfirmPassword}
                placeholder={
                  language === 'EN' ? 'Confirm your password' : 'Şifrenizi tekrar girin'
                }
                placeholderTextColor="#9CA3AF"
                className="h-14 w-full rounded-2xl border-2 border-gray-200 bg-white pl-12 pr-12 text-base text-gray-900"
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4"
              >
                {showConfirmPassword ? (
                  <EyeOff size={20} color="#9CA3AF" />
                ) : (
                  <Eye size={20} color="#9CA3AF" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Create account */}
          <TouchableOpacity
            className="mb-4 h-14 w-full items-center justify-center rounded-2xl bg-[#2ECC71] shadow-lg"
            onPress={onNext}
          >
            <Text className="text-base font-semibold text-white">
              {language === 'EN' ? 'Create Account' : 'Kayıt Ol'}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View className="mb-4 flex flex-row items-center">
            <View className="h-px flex-1 bg-gray-200" />
            <Text className="px-3 text-sm text-gray-400">
              {language === 'EN' ? 'or sign up with' : 'veya şununla kaydol'}
            </Text>
            <View className="h-px flex-1 bg-gray-200" />
          </View>

          {/* Social buttons */}
          <View className="mb-6 flex flex-row gap-3">
            <TouchableOpacity className="h-14 flex-1 flex-row items-center justify-center rounded-2xl border-2 border-gray-200 bg-white">
              <Text className="mr-2 text-base text-gray-700">G</Text>
              <Text className="text-base text-gray-700">Google</Text>
            </TouchableOpacity>
            <TouchableOpacity className="h-14 flex-1 flex-row items-center justify-center rounded-2xl border-2 border-gray-200 bg-white">
              <Apple size={20} color="#111827" style={{ marginRight: 8 }} />
              <Text className="text-base text-gray-700">Apple</Text>
            </TouchableOpacity>
          </View>

          {/* Sign in link */}
          <View className="items-center border-t border-gray-100 pt-4">
            <Text className="text-gray-600">
              {language === 'EN' ? 'Already have an account? ' : 'Zaten hesabınız var mı? '}
              <Text className="font-semibold text-[#2ECC71]" onPress={onBack}>
                {language === 'EN' ? 'Sign In' : 'Giriş Yap'}
              </Text>
            </Text>
          </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
