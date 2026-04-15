/**
 * @jest-environment node
 */
import type { DeviceHandle } from '@/device/DeviceHandle';
import {
  buildDeviceRows,
  type DeviceRow,
} from '@/ui/components/DeviceSelector/helpers';

function makeMic(overrides: Partial<DeviceHandle> = {}): DeviceHandle {
  return {
    deviceId: 'mic-1',
    label: 'Built-in Microphone',
    kind: 'audioinput',
    isDefault: false,
    ...overrides,
  };
}

function makeCamera(overrides: Partial<DeviceHandle> = {}): DeviceHandle {
  return {
    deviceId: 'cam-1',
    label: 'FaceTime HD Camera',
    kind: 'videoinput',
    isDefault: false,
    ...overrides,
  };
}

describe('buildDeviceRows', () => {
  it('returns empty array for empty device list', () => {
    expect(buildDeviceRows([], 'mic-1')).toEqual([]);
  });

  it('builds rows with correct fields', () => {
    const devices = [makeMic()];
    const rows = buildDeviceRows(devices, 'mic-1');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual<DeviceRow>({
      deviceId: 'mic-1',
      label: 'Built-in Microphone',
      isDefault: false,
      isSelected: true,
    });
  });

  it('marks selected device correctly', () => {
    const devices = [makeMic({ deviceId: 'a' }), makeMic({ deviceId: 'b' })];
    const rows = buildDeviceRows(devices, 'b');
    expect(rows[0].isSelected).toBe(false);
    expect(rows[1].isSelected).toBe(true);
  });

  it('marks no device as selected when selectedId does not match', () => {
    const devices = [makeMic({ deviceId: 'a' })];
    const rows = buildDeviceRows(devices, 'nonexistent');
    expect(rows[0].isSelected).toBe(false);
  });

  it('carries through isDefault flag', () => {
    const devices = [makeMic({ isDefault: true })];
    const rows = buildDeviceRows(devices, '');
    expect(rows[0].isDefault).toBe(true);
  });

  it('works with camera devices too', () => {
    const devices = [makeCamera({ deviceId: 'cam-1' })];
    const rows = buildDeviceRows(devices, 'cam-1');
    expect(rows[0].isSelected).toBe(true);
    expect(rows[0].label).toBe('FaceTime HD Camera');
  });
});
