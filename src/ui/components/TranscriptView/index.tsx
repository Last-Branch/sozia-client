import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { useLanguage } from '../../context/LanguageContext';

import type { TranscriptSegment } from '../../../common/models';
import type { TranscriptStore } from '../../../store/TranscriptStore';
import { buildTranscriptRows } from './helpers';

interface TranscriptViewProps {
  store: TranscriptStore;
  fontSize: number;
}

export function TranscriptView({ store, fontSize }: TranscriptViewProps) {
  const { t } = useLanguage();
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const isAtBottomRef = useRef(true);

  useEffect(() => {
    setSegments(store.getAll());
    const unsub = store.onUpdate((updated) => {
      setSegments(updated);
    });
    return unsub;
  }, [store]);

  useEffect(() => {
    if (isAtBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollToEnd({ animated: true });
    }
  }, [segments]);

  const rows = buildTranscriptRows(segments);

  if (rows.length === 0) {
    return (
      <Text
        className="text-center italic leading-relaxed text-white/40"
        style={{ fontSize }}
      >
        {t('live.waiting')}
      </Text>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      className="flex-1"
      onScroll={(e) => {
        const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
        const SCROLL_BOTTOM_THRESHOLD = 20;
        const atBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - SCROLL_BOTTOM_THRESHOLD;
        isAtBottomRef.current = atBottom;
      }}
      scrollEventThrottle={100}
    >
      <View className="gap-2 p-2">
        {rows.map((row) => (
          <View key={row.segmentId} className="flex-row items-center gap-2">
            <View
              className={[
                'rounded-full px-2 py-0.5',
                row.isPartial ? 'bg-gray-600' : 'bg-[#2ECC71]/30',
              ].join(' ')}
            >
              <Text className="text-xs font-medium text-white/70">
                {t(row.sourceLabel)}
              </Text>
            </View>

            <Text
              className={[
                'flex-1 leading-relaxed',
                row.isPartial ? 'italic text-white/50' : 'font-bold text-white',
              ].join(' ')}
              style={{ fontSize }}
            >
              {row.text}
            </Text>

            {row.lowConfidence && (
              <AlertTriangle size={14} color="#F59E0B" />
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
