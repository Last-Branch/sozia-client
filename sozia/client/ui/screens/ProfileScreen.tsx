import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CircleUser, LogOut } from 'lucide-react-native';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../auth/AuthContext';

export function ProfileScreen({ onBack }: { onBack: () => void }) {
  const { t } = useLanguage();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    onBack();
    await signOut();
  };

  return (
    <SafeAreaView className="flex-1 w-full self-stretch bg-white dark:bg-gray-900">
      <View className="flex-1 w-full bg-white dark:bg-gray-800">
        <View className="flex-row items-center px-6 pt-4 pb-6">
          <TouchableOpacity
            onPress={onBack}
            className="mr-4 h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700"
            hitSlop={8}
            activeOpacity={0.8}
          >
            <ArrowLeft size={20} color="#374151" />
          </TouchableOpacity>
          <Text className="text-2xl font-black text-gray-900 dark:text-gray-100">{t('profile.title')}</Text>
        </View>

        <View className="items-center px-6 pb-8">
          <View className="mb-4 h-24 w-24 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
            <CircleUser size={56} color="#9CA3AF" />
          </View>
          {user?.displayName ? (
            <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">{user.displayName}</Text>
          ) : null}
          {user?.email ? (
            <Text className="mt-1 text-sm text-gray-500 dark:text-gray-400">{user.email}</Text>
          ) : null}
        </View>

        <View className="mx-6 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <TouchableOpacity
            className="flex-row items-center gap-3 px-4 py-4"
            onPress={handleSignOut}
            activeOpacity={0.8}
          >
            <LogOut size={20} color="#EF4444" />
            <Text className="text-base font-semibold text-red-500">{t('auth.signOut')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
