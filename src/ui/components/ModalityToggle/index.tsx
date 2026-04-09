import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Mic, Hand } from 'lucide-react-native';
import { useLanguage } from '../../context/LanguageContext';

import { ModalityPath } from '../../../common/models';
import { buildToggleState } from './helpers';

export { buildToggleState, type ToggleOption } from './helpers';

const ICON_MAP: Record<ModalityPath, typeof Mic> = {
  [ModalityPath.SPEECH]: Mic,
  [ModalityPath.SIGN]: Hand,
};

interface ModalityToggleProps {
  selectedPath: ModalityPath;
  onPathChange: (path: ModalityPath) => void;
  disabled: boolean;
}

export function ModalityToggle({ selectedPath, onPathChange, disabled }: ModalityToggleProps) {
  const { t } = useLanguage();
  const options = buildToggleState(selectedPath, disabled);

  return (
    <View>
      <View className="flex-row rounded-full bg-gray-100 p-1 dark:bg-gray-800">
        {options.map((opt) => {
          const Icon = ICON_MAP[opt.path];
          return (
            <TouchableOpacity
              key={opt.path}
              className={[
                'flex-1 flex-row items-center justify-center gap-1 rounded-full py-2',
                opt.isActive ? 'bg-[#2ECC71]' : '',
                opt.disabled ? 'opacity-50' : '',
              ].join(' ')}
              onPress={() => {
                if (!opt.disabled) onPathChange(opt.path);
              }}
              disabled={opt.disabled}
            >
              <Icon size={16} color={opt.isActive ? '#FFFFFF' : '#9CA3AF'} />
              <Text
                className={opt.isActive ? 'text-sm font-medium text-white' : 'text-sm text-gray-500'}
              >
                {t(opt.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {disabled && (
        <Text className="mt-1 text-center text-xs text-gray-400 dark:text-gray-500">
          {t('modality.toggleDisabled')}
        </Text>
      )}
    </View>
  );
}
