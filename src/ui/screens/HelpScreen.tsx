import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Camera, ChevronDown, ChevronRight, Hand, MessageCircle, Mic, Shield } from 'lucide-react-native';

type FaqItem = { question: string; answer: string };

const FAQ_EN: FaqItem[] = [
  {
    question: 'How does lip reading work?',
    answer:
      'Sozia uses your device camera to track facial landmarks in real time. The lip movements are analysed locally on your device — no video is ever sent to the cloud.',
  },
  {
    question: 'How does sign language recognition work?',
    answer:
      'Your hand and body landmarks are extracted on-device using MediaPipe. Only the numerical landmark data (not video) is sent to the server for Turkish Sign Language classification.',
  },
  {
    question: 'Is my audio or video stored anywhere?',
    answer:
      'No. Raw audio and video never leave your device. Only anonymised numerical feature arrays are transmitted over an encrypted connection for inference.',
  },
  {
    question: 'What is the difference between Speech and Sign modes?',
    answer:
      'Speech mode combines microphone audio (ASR) with lip-reading for higher accuracy. Sign mode recognises Turkish Sign Language gestures and converts them to natural-language text. Only one mode can be active at a time.',
  },
  {
    question: 'Why does the subtitle sometimes appear twice and then change?',
    answer:
      'Sozia uses an optimistic display strategy: a preliminary subtitle appears immediately, then gets replaced by the final, more accurate result once all modalities finish processing.',
  },
  {
    question: 'What should I do if the app shows DEGRADED status?',
    answer:
      'DEGRADED means one modality (e.g. microphone or camera) became unavailable. The app continues with the remaining modality. Check that the required permissions are granted and try restarting the session.',
  },
];

const FAQ_TR: FaqItem[] = [
  {
    question: 'Dudak okuma nasıl çalışır?',
    answer:
      'Sozia, yüz referans noktalarını gerçek zamanlı olarak izlemek için cihaz kameranızı kullanır. Dudak hareketleri yalnızca cihazınızda analiz edilir; hiçbir video buluta gönderilmez.',
  },
  {
    question: 'İşaret dili tanıma nasıl çalışır?',
    answer:
      'El ve vücut referans noktaları, cihazınızda MediaPipe aracılığıyla çıkarılır. Yalnızca sayısal veri (video değil) şifreli bir bağlantı üzerinden Türk İşaret Dili sınıflandırması için sunucuya gönderilir.',
  },
  {
    question: 'Ses veya görüntüm bir yerde depolanıyor mu?',
    answer:
      'Hayır. Ham ses ve görüntü hiçbir zaman cihazınızı terk etmez. Yalnızca anonimleştirilmiş sayısal özellik dizileri çıkarım için şifreli bağlantı üzerinden iletilir.',
  },
  {
    question: 'Konuşma ve İşaret modları arasındaki fark nedir?',
    answer:
      'Konuşma modu, daha yüksek doğruluk için mikrofon sesini (ASR) dudak okumayla birleştirir. İşaret modu, Türk İşaret Dili hareketlerini tanır ve doğal dil metnine dönüştürür. Aynı anda yalnızca bir mod etkin olabilir.',
  },
  {
    question: 'Altyazı neden bazen iki kez görünüp değişiyor?',
    answer:
      'Sozia iyimser bir görüntüleme stratejisi kullanır: geçici bir altyazı hemen görünür, ardından tüm modaliteler işlemeyi bitirince daha doğru nihai sonuçla değiştirilir.',
  },
  {
    question: 'Uygulama DEGRADED durumu gösterirse ne yapmalıyım?',
    answer:
      "DEGRADED, mikrofon veya kamera gibi bir modalite'nin kullanılamaz hale geldiği anlamına gelir. Uygulama kalan modalite ile devam eder. Gerekli izinlerin verildiğini kontrol edin ve oturumu yeniden başlatmayı deneyin.",
  },
];

export function HelpScreen({ onBack }: { onBack: () => void }) {
  const [language, setLanguage] = useState<'TR' | 'EN'>('EN');
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faq = language === 'EN' ? FAQ_EN : FAQ_TR;

  return (
    <SafeAreaView className="flex-1 w-full self-stretch bg-gradient-to-br from-[#2ECC71]/5 via-white to-[#2ECC71]/5">
      <ScrollView className="flex-1 w-full" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 w-full items-center px-4 py-8">
          <View className="w-full max-w-sm overflow-hidden rounded-[32px] border-[12px] border-gray-800 bg-white shadow-2xl">

            {/* Header */}
            <View className="flex-row items-center justify-between border-b border-gray-100 px-6 pt-5 pb-4">
              <View className="flex-row items-center gap-3">
                <TouchableOpacity
                  className="h-10 w-10 items-center justify-center rounded-full bg-gray-100"
                  onPress={onBack}
                  hitSlop={8}
                >
                  <ArrowLeft size={18} color="#374151" />
                </TouchableOpacity>
                <Text className="text-3xl font-black text-gray-900">Help</Text>
              </View>
              <View className="flex-row rounded-full bg-gray-100 p-1">
                <TouchableOpacity
                  onPress={() => setLanguage('TR')}
                  className={`px-3 py-1 rounded-full ${language === 'TR' ? 'bg-[#2ECC71]' : ''}`}
                >
                  <Text className={language === 'TR' ? 'text-white font-semibold' : 'text-gray-600'}>TR</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setLanguage('EN')}
                  className={`px-3 py-1 rounded-full ${language === 'EN' ? 'bg-[#2ECC71]' : ''}`}
                >
                  <Text className={language === 'EN' ? 'text-white font-semibold' : 'text-gray-600'}>EN</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View className="px-6 py-6">

              {/* Quick guide */}
              <Text className="mb-3 font-black text-gray-900">
                {language === 'EN' ? 'Quick Guide' : 'Hızlı Kılavuz'}
              </Text>
              <View className="mb-6 gap-3">
                <View className="flex-row items-start gap-4 rounded-3xl border border-gray-100 bg-gray-50 p-4">
                  <View className="h-10 w-10 items-center justify-center rounded-2xl bg-[#2ECC71]/10">
                    <Mic size={20} color="#2ECC71" />
                  </View>
                  <View className="flex-1">
                    <Text className="mb-0.5 font-bold text-gray-900">
                      {language === 'EN' ? 'Speech Mode' : 'Konuşma Modu'}
                    </Text>
                    <Text className="text-xs leading-5 text-gray-500">
                      {language === 'EN'
                        ? 'Tap "Start Lip Reading" on the dashboard. Grant microphone and camera access. Speak clearly facing the camera.'
                        : '"Dudak Okumayı Başlat" düğmesine basın. Mikrofon ve kamera erişimine izin verin. Kameraya bakarak net konuşun.'}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-start gap-4 rounded-3xl border border-gray-100 bg-gray-50 p-4">
                  <View className="h-10 w-10 items-center justify-center rounded-2xl bg-[#1E8449]/10">
                    <Hand size={20} color="#1E8449" />
                  </View>
                  <View className="flex-1">
                    <Text className="mb-0.5 font-bold text-gray-900">
                      {language === 'EN' ? 'Sign Language Mode' : 'İşaret Dili Modu'}
                    </Text>
                    <Text className="text-xs leading-5 text-gray-500">
                      {language === 'EN'
                        ? 'Tap "Start Sign Language". Keep your hands centred and visible. Ensure good lighting.'
                        : '"İşaret Dilini Başlat" düğmesine basın. Ellerinizi ortalı ve görünür tutun. İyi aydınlatma sağlayın.'}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-start gap-4 rounded-3xl border border-gray-100 bg-gray-50 p-4">
                  <View className="h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10">
                    <Camera size={20} color="#2563EB" />
                  </View>
                  <View className="flex-1">
                    <Text className="mb-0.5 font-bold text-gray-900">
                      {language === 'EN' ? 'Best Conditions' : 'En İyi Koşullar'}
                    </Text>
                    <Text className="text-xs leading-5 text-gray-500">
                      {language === 'EN'
                        ? 'Well-lit environment, camera at eye level, minimal background noise, stable internet connection.'
                        : 'İyi aydınlatılmış ortam, kamera göz hizasında, minimum arka plan gürültüsü, kararlı internet bağlantısı.'}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-start gap-4 rounded-3xl border border-gray-100 bg-gray-50 p-4">
                  <View className="h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/10">
                    <Shield size={20} color="#7C3AED" />
                  </View>
                  <View className="flex-1">
                    <Text className="mb-0.5 font-bold text-gray-900">
                      {language === 'EN' ? 'Privacy' : 'Gizlilik'}
                    </Text>
                    <Text className="text-xs leading-5 text-gray-500">
                      {language === 'EN'
                        ? 'Raw audio and video never leave your device. Only anonymised numerical data is transmitted.'
                        : 'Ham ses ve video hiçbir zaman cihazınızı terk etmez. Yalnızca anonimleştirilmiş sayısal veriler iletilir.'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* FAQ */}
              <Text className="mb-3 font-black text-gray-900">
                {language === 'EN' ? 'Frequently Asked Questions' : 'Sık Sorulan Sorular'}
              </Text>
              <View className="gap-2">
                {faq.map((item, i) => (
                  <TouchableOpacity
                    key={i}
                    className="overflow-hidden rounded-3xl border border-gray-100 bg-gray-50"
                    onPress={() => setOpenIndex(openIndex === i ? null : i)}
                    activeOpacity={0.85}
                  >
                    <View className="flex-row items-center justify-between px-4 py-4">
                      <Text className="flex-1 pr-3 text-sm font-semibold text-gray-900">
                        {item.question}
                      </Text>
                      {openIndex === i ? (
                        <ChevronDown size={16} color="#9CA3AF" />
                      ) : (
                        <ChevronRight size={16} color="#9CA3AF" />
                      )}
                    </View>
                    {openIndex === i && (
                      <View className="border-t border-gray-200 px-4 pb-4 pt-3">
                        <Text className="text-sm leading-6 text-gray-600">{item.answer}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* App info */}
              <View className="mt-8 items-center">
                <View className="mb-3 h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-[#2ECC71] to-[#27AE60] shadow-lg">
                  <MessageCircle size={28} color="#fff" />
                </View>
                <Text className="text-lg font-black text-gray-900">SOZIA</Text>
                <Text className="text-xs text-gray-400">
                  {language === 'EN' ? 'Assistive Communication · v1.0.0' : 'Yardımcı İletişim · v1.0.0'}
                </Text>
              </View>

            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
