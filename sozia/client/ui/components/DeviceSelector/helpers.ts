import type { DeviceHandle } from '@/device/DeviceHandle';

export interface DeviceRow {
  deviceId: string;
  label: string;
  isDefault: boolean;
  isSelected: boolean;
}

export function buildDeviceRows(devices: DeviceHandle[], selectedId: string): DeviceRow[] {
  return devices.map((d) => ({
    deviceId: d.deviceId,
    label: d.label,
    isDefault: d.isDefault,
    isSelected: d.deviceId === selectedId,
  }));
}
