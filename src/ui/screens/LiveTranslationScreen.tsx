import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown, CircleX, Settings, SwitchCamera } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { ModalityType, SegmentStatus, type TranscriptSegment } from '../../common/models';
import { useSessionController } from '../SessionController';

// ---------------------------------------------------------------------------
// DEV-only test data
// ---------------------------------------------------------------------------

const DEV_LINES = [
  { partial: 'Merhaba, bugün size nasıl…', final: 'Merhaba, bugün size nasıl yardımcı olabilirim?' },
  { partial: 'Evet, anlıyorum sizi…', final: 'Evet, sizi anlıyorum. Devam edebilirsiniz.' },
  { partial: 'Teşekkür ederim…', final: 'Çok teşekkür ederim, iyi günler.' },
];

let _devIdCounter = 0;
function devId() { return `dev-${++_devIdCounter}`; }

// ---------------------------------------------------------------------------

export function LiveTranslationScreen({ onBack }: { onBack: () => void }) {
  const { state, sessionId, activePath, stopSession, store } = useSessionController();

  const [segments, setSegments] = useState<TranscriptSegment[]>([]);

  useEffect(() => {
    setSegments(store.getAll());
    const unsub = store.onUpdate((s) => setSegments(s));
    return unsub;
  }, [store]);

  const [outputLanguage, setOutputLanguage] = useState<'TR' | 'EN'>('EN');
  const { t } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);
  const [textSize, setTextSize] = useState(100);
  const [groupMode, setGroupMode] = useState(false);

  const baseFontSize = (textSize / 100) * 30;

  // DEV inject: cycles through lines, partial → final → next line
  const devStep = useRef<{ lineIdx: number; partialId: string | null }>({ lineIdx: 0, partialId: null });

  function handleDevInject() {
    const { lineIdx, partialId } = devStep.current;
    const line = DEV_LINES[lineIdx % DEV_LINES.length];
    const now = Date.now();

    if (partialId === null) {
      // Step 1: inject PARTIAL
      const id = devId();
      store.append({
        segmentId: id,
        sessionId: sessionId ?? 'dev',
        status: SegmentStatus.PARTIAL,
        text: line.partial,
        source: ModalityType.ASR,
        confidence: 0.72,
        timestampMs: now,
        durationMs: 500,
        createdAtMs: now,
        replacesSegmentId: null,
      });
      devStep.current = { lineIdx, partialId: id };
    } else {
      // Step 2: upgrade to FINAL
      store.append({
        segmentId: devId(),
        sessionId: sessionId ?? 'dev',
        status: SegmentStatus.FINAL,
        text: line.final,
        source: ModalityType.ASR,
        confidence: 0.91,
        timestampMs: now,
        durationMs: 800,
        createdAtMs: now,
        replacesSegmentId: partialId,
      });
      devStep.current = { lineIdx: lineIdx + 1, partialId: null };
    }
  }

  return (
    <SafeAreaView className="flex-1 w-full self-stretch bg-gradient-to-br from-[#2ECC71]/5 via-white dark:via-gray-900 to-[#2ECC71]/5">
      <View className="flex-1 w-full items-center justify-center p-4">
        <View className="w-full flex-1 max-h-[1000px] max-w-sm overflow-hidden rounded-[40px] border-[12px] border-gray-800 bg-black shadow-2xl">
          {/* Top bar */}
          <View className="z-20 flex-row items-center justify-between bg-black/30 px-6 pt-3 pb-2">
            <Text className="text-xs font-semibold text-white">Sozia · {state}</Text>
            <TouchableOpacity onPress={onBack}>
              <Text className="text-xs font-semibold text-gray-300">{t('live.back')}</Text>
            </TouchableOpacity>
          </View>

          <View className="relative flex-1">
            {/* Camera background */}
            <View className="absolute inset-0 items-center justify-center bg-gray-800">
              <View className="absolute inset-0 bg-black/40" />
              <View className="z-0 items-center">
                <View className="mb-3 h-24 w-24 items-center justify-center rounded-full border-2 border-white/20">
                  <View className="h-16 w-16 rounded-full border-2 border-white/30" />
                </View>
                <Text className="text-sm font-medium text-white/40">{t('live.cameraFeed')}</Text>
              </View>
            </View>

            {/* Active indicator */}
            <View className="absolute left-6 top-6 z-30 flex-row items-center gap-2 rounded-full border border-white/20 bg-black/60 px-4 py-2.5">
              <View className="relative">
                <View className="h-3 w-3 rounded-full bg-[#2ECC71]" />
              </View>
              <Text className="text-xs font-semibold text-white">{t('live.listening')}</Text>
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
              <View className="absolute right-6 top-20 z-40 w-72 rounded-3xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 p-5">
                <View className="mb-3 flex-row items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                  <Text className="font-bold text-gray-900 dark:text-gray-100">{t('live.settings')}</Text>
                  <TouchableOpacity onPress={() => setShowSettings(false)}>
                    <ChevronDown size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                {/* Language */}
                <View className="mb-4">
                  <Text className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{t('live.outputLang')}</Text>
                  <View className="inline-flex w-full flex-row rounded-full bg-gray-100 dark:bg-gray-800 p-1">
                    <TouchableOpacity
                      className={`flex-1 rounded-full px-4 py-2.5 text-sm font-bold ${
                        outputLanguage === 'TR' ? 'bg-[#2ECC71] text-white shadow-md' : 'text-gray-600 dark:text-gray-400'
                      }`}
                      onPress={() => setOutputLanguage('TR')}
                    >
                      <Text className={outputLanguage === 'TR' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}>
                        {t('live.tr')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className={`flex-1 rounded-full px-4 py-2.5 text-sm font-bold ${
                        outputLanguage === 'EN' ? 'bg-[#2ECC71] text-white shadow-md' : 'text-gray-600 dark:text-gray-400'
                      }`}
                      onPress={() => setOutputLanguage('EN')}
                    >
                      <Text className={outputLanguage === 'EN' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}>
                        {t('live.en')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Subtitle Size */}
                <View className="mb-4">
                  <View className="mb-2 flex-row items-center justify-between">
                    <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('live.subtitleSize')}</Text>
                    <Text className="text-xs font-bold text-[#2ECC71]">{textSize}%</Text>
                  </View>
                  <SimpleSlider 
                    value={textSize} 
                    onValueChange={setTextSize} 
                    min={50} 
                    max={150} 
                  />
                </View>

                {/* Group mode */}
                <View className="flex-row items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-3">
                  <View>
                    <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('live.groupMode')}</Text>
                    <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{t('live.groupModeDesc')}</Text>
                  </View>
                  <TouchableOpacity
                    className={`h-7 w-12 rounded-full p-1 ${
                      groupMode ? 'bg-[#2ECC71]' : 'bg-gray-200 dark:bg-gray-600'
                    }`}
                    onPress={() => setGroupMode((v) => !v)}
                  >
                    <View
                      className={`h-5 w-5 rounded-full bg-white dark:bg-gray-800 ${
                        groupMode ? 'ml-5' : 'ml-0'
                      }`}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* DEV: inject test segments */}
            {__DEV__ && (
              <View className="absolute bottom-44 left-0 right-0 z-40 flex-row items-center justify-center gap-2 px-4">
                <TouchableOpacity
                  className="rounded-full bg-yellow-400/90 px-4 py-2"
                  onPress={handleDevInject}
                >
                  <Text className="text-xs font-bold text-black">
                    {devStep.current.partialId === null ? '+ Partial' : '→ Final'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="rounded-full bg-white/20 px-4 py-2"
                  onPress={() => { store.clear(); devStep.current = { lineIdx: 0, partialId: null }; }}
                >
                  <Text className="text-xs font-bold text-white">Clear</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Subtitle overlay */}
            <View className="absolute bottom-0 left-0 right-0 z-30 flex-col justify-end pb-6">
              <View className="mx-4 rounded-3xl border-t-2 border-white/20 bg-black/75 px-6 py-8">
                {groupMode && (
                  <View className="mb-2 flex-row items-center justify-center gap-2">
                    <View className="h-2.5 w-2.5 rounded-full bg-[#2ECC71]" />
                    <Text className="text-sm font-bold text-[#2ECC71]">{t('live.speaker')} 1</Text>
                  </View>
                )}
                <TranscriptView segments={segments} baseFontSize={baseFontSize} />
                <View className="mt-3 items-center">
                  <Text className="text-xs text-gray-400">
                    {t('live.session')} {sessionId ?? '—'} · {t('live.path')} {activePath ?? '—'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// TranscriptView
// ---------------------------------------------------------------------------

/**
 * Renders the last few transcript segments inside the subtitle overlay.
 *
 * Visual contract (LLD Trade-off 3):
 * - FINAL segments: bold white — committed, fused text.
 * - PARTIAL segments: italic, muted white — tentative, may be revised.
 * - Empty timeline: shows a waiting prompt so the user knows the session is live.
 */
function TranscriptView({
  segments,
  baseFontSize,
}: {
  segments: TranscriptSegment[];
  baseFontSize: number;
}) {
  const { t } = useTranslation();
  // Show only the last 3 segments to keep the overlay readable.
  const visible = segments.slice(-3);

  if (visible.length === 0) {
    return (
      <Text
        className="text-center italic leading-relaxed text-white/40"
        style={{ fontSize: baseFontSize }}
      >
        {t('live.waiting')}
      </Text>
    );
  }

  return (
    <View className="gap-1">
      {visible.map((seg) => {
        const isPartial = seg.status === SegmentStatus.PARTIAL;
        return (
          <Text
            key={seg.segmentId}
            className={[
              'text-center leading-relaxed',
              isPartial ? 'italic text-white/50' : 'font-bold text-white',
            ].join(' ')}
            style={{ fontSize: baseFontSize }}
          >
            {seg.text}
          </Text>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// SimpleSlider
// ---------------------------------------------------------------------------

function SimpleSlider({ value, onValueChange, min, max }: { value: number; onValueChange: (v: number) => void; min: number; max: number }) {
  const [width, setWidth] = useState(0);
  const percent = Math.max(0, Math.min(1, (value - min) / (max - min)));

  return (
    <View 
      className="h-10 w-full justify-center" 
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onResponderGrant={(e) => {
        if (width > 0) {
          const x = e.nativeEvent.locationX;
          onValueChange(Math.round(min + Math.max(0, Math.min(1, x / width)) * (max - min)));
        }
      }}
      onResponderMove={(e) => {
        if (width > 0) {
          const x = e.nativeEvent.locationX;
          onValueChange(Math.round(min + Math.max(0, Math.min(1, x / width)) * (max - min)));
        }
      }}
    >
      <View className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700" pointerEvents="none">
        <View className="h-2 rounded-full bg-[#2ECC71]" style={{ width: `${percent * 100}%` }} />
      </View>
      <View 
        className="absolute h-6 w-6 rounded-full bg-white shadow-md border border-gray-200 dark:border-gray-600 dark:bg-gray-800" 
        style={{ left: `${percent * 100}%`, transform: [{ translateX: -12 }] }} 
        pointerEvents="none"
      />
    </View>
  );
}
