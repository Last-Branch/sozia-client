import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useLanguage } from '../../context/LanguageContext';

import type { DeviceHandle } from '../../../device/DeviceHandle';
import { buildDeviceRows } from './helpers';

interface DeviceSelectorProps {
  devices: DeviceHandle[];
  selectedDeviceId: string;
  onSelect: (deviceId: string) => void;
}

export function DeviceSelector({ devices, selectedDeviceId, onSelect }: DeviceSelectorProps) {
  const { t } = useLanguage();
  const rows = buildDeviceRows(devices, selectedDeviceId);

  if (rows.length === 0) {
    return (
      <Text className="text-center italic text-gray-400 dark:text-gray-500">
        {t('device.noDevicesFound')}
      </Text>
    );
  }

  return (
    <View className="gap-1">
      {rows.map((row) => (
        <TouchableOpacity
          key={row.deviceId}
          className={[
            'flex-row items-center rounded-lg px-3 py-2',
            row.isSelected ? 'bg-[#2ECC71]/20' : 'bg-gray-100 dark:bg-gray-800',
          ].join(' ')}
          onPress={() => onSelect(row.deviceId)}
        >
          <View className="flex-1">
            <Text className="text-sm text-gray-900 dark:text-white">
              {row.label}
            </Text>
            {row.isDefault && (
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                {t('device.default')}
              </Text>
            )}
          </View>
          {row.isSelected && <Check size={18} color="#2ECC71" />}
        </TouchableOpacity>
      ))}
    </View>
  );
}
