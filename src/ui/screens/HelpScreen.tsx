import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Camera, ChevronDown, ChevronRight, Hand, MessageCircle, Mic, Shield } from 'lucide-react-native';

export function HelpScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faq = t('help.faq', { returnObjects: true }) as Array<{ question: string; answer: string }>;

  return (
    <SafeAreaView className="flex-1 w-full self-stretch bg-gradient-to-br from-[#2ECC71]/5 via-white dark:via-gray-900 to-[#2ECC71]/5">
      <View className="flex-1 w-full items-center justify-center p-4">
        <View className="w-full flex-1 max-h-[1000px] max-w-sm overflow-hidden rounded-[40px] border-[12px] border-gray-800 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
            <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
        <TouchableOpacity
          onPress={onBack}
          className="h-11 w-11 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800"
          activeOpacity={0.8}
        >
          <ArrowLeft size={22} color="#374151" className="dark:text-gray-300" />
        </TouchableOpacity>
        <Text className="text-xl font-black text-gray-900 dark:text-gray-100">{t('help.title')}</Text>
        <View className="h-11 w-11" />
      </View>

      <ScrollView className="flex-1 w-full px-5" contentContainerStyle={{ paddingTop: 16, paddingBottom: 60 }}>
        <View className="mb-6 rounded-3xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-6">
          <Text className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {t('help.quickGuide')}
          </Text>

          <View className="mb-5 flex-row">
            <View className="mt-1 h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 dark:bg-blue-500/20">
              <Mic size={16} color="#3B82F6" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="font-bold text-gray-900 dark:text-gray-100">{t('help.speechMode')}</Text>
              <Text className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                {t('help.speechModeDesc')}
              </Text>
            </View>
          </View>

          <View className="mb-5 flex-row">
            <View className="mt-1 h-8 w-8 items-center justify-center rounded-xl bg-[#2ECC71]/10 dark:bg-[#2ECC71]/20">
              <Hand size={16} color="#2ECC71" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="font-bold text-gray-900 dark:text-gray-100">{t('help.signMode')}</Text>
              <Text className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                {t('help.signModeDesc')}
              </Text>
            </View>
          </View>

          <View className="mb-5 flex-row">
            <View className="mt-1 h-8 w-8 items-center justify-center rounded-xl bg-orange-500/10 dark:bg-orange-500/20">
              <Camera size={16} color="#F97316" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="font-bold text-gray-900 dark:text-gray-100">{t('help.bestConditions')}</Text>
              <Text className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                {t('help.bestConditionsDesc')}
              </Text>
            </View>
          </View>

          <View className="flex-row">
            <View className="mt-1 h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 dark:bg-purple-500/20">
              <Shield size={16} color="#A855F7" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="font-bold text-gray-900 dark:text-gray-100">{t('help.privacy')}</Text>
              <Text className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                {t('help.privacyDesc')}
              </Text>
            </View>
          </View>
        </View>

        <Text className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">{t('help.faqTitle')}</Text>
        <View className="mb-8 overflow-hidden rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/80 shadow-sm">
          {faq.map((item, index) => {
            const isOpen = openIndex === index;
            const isLast = index === faq.length - 1;

            return (
              <View key={index} className={`border-b ${isLast ? 'border-transparent' : 'border-gray-100 dark:border-gray-700'}`}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setOpenIndex(isOpen ? null : index)}
                  className="flex-row items-center justify-between p-4"
                >
                  <Text className="flex-1 pr-4 font-semibold text-gray-800 dark:text-gray-200">
                    {item.question}
                  </Text>
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-gray-50 dark:bg-gray-700">
                    <ChevronDown
                      size={18}
                      color="#6B7280"
                      style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
                    />
                  </View>
                </TouchableOpacity>

                {isOpen && (
                  <View className="bg-gray-50 dark:bg-gray-800/50 px-4 pb-4 pt-1">
                    <Text className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                      {item.answer}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <View className="items-center pb-8 pt-4">
          <View className="mb-3 h-16 w-16 items-center justify-center rounded-3xl bg-[#2ECC71]/10">
            <MessageCircle size={32} color="#2ECC71" />
          </View>
          <Text className="text-xl font-black text-gray-900 dark:text-gray-100">SOZIA</Text>
          <Text className="text-xs font-semibold text-gray-400 dark:text-gray-500">{t('help.subtitle')}</Text>
        </View>
            </ScrollView>
          </View>
        </View>
    </SafeAreaView>
  );
}
