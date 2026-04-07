/**
 * @jest-environment node
 */
/**
 * Unit tests — sozia.client.device
 *
 * Scope: DeviceManager contract and DeviceHandle structure.
 * Uses mock IDeviceEnumerator and mock IAudioPipeline to verify DeviceManager
 * behaviour in isolation. ExpoDeviceEnumerator is excluded (requires platform APIs).
 *
 * Test plan reference: TP-CLIENT-DEVICE-001 through TP-CLIENT-DEVICE-008
 */

jest.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: jest.fn(),
  },
}));

import { Audio } from 'expo-av';
import { DeviceManager } from '../../src/device/DeviceManager';
import type { IDeviceEnumerator } from '../../src/device/DeviceEnumerator';
import type { DeviceHandle } from '../../src/device/DeviceHandle';
import type { IAudioPipeline, MFCCFrame } from '../../src/pipeline/audio';
import type { PipelineHealth } from '../../src/common/models';

const mockRequestPermissions = Audio.requestPermissionsAsync as jest.Mock;

// ---------------------------------------------------------------------------
// MockDeviceEnumerator
// ---------------------------------------------------------------------------

class MockDeviceEnumerator implements IDeviceEnumerator {
  private devices: DeviceHandle[];

  constructor(devices: DeviceHandle[] = []) {
    this.devices = devices;
  }

  async list(): Promise<DeviceHandle[]> {
    return [...this.devices];
  }

  onDeviceChange(_callback: (devices: DeviceHandle[]) => void): () => void {
    return () => {};
  }

  setDevices(devices: DeviceHandle[]): void {
    this.devices = devices;
  }
}

// ---------------------------------------------------------------------------
// MockAudioPipeline
// ---------------------------------------------------------------------------

class MockAudioPipeline implements IAudioPipeline {
  private sessionId = '';
  private available = false;
  startCalled = false;
  startCalledWith = '';
  stopCalled = false;

  async start(sessionId: string): Promise<void> {
    this.sessionId = sessionId;
    this.available = true;
    this.startCalled = true;
    this.startCalledWith = sessionId;
  }

  pause(): void {
    this.available = false;
  }

  resume(): void {
    this.available = true;
  }

  stop(): void {
    this.sessionId = '';
    this.available = false;
    this.stopCalled = true;
  }

  getHealth(): PipelineHealth {
    return {
      sessionId: this.sessionId,
      pipeline: 'audio',
      available: this.available,
      fps: null,
      snr: null,
      faceDetected: null,
      lastUpdatedMs: Date.now(),
    };
  }

  onFrame(_callback: (frame: MFCCFrame) => void): () => void {
    return () => {};
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAudioDevice(overrides: Partial<DeviceHandle> = {}): DeviceHandle {
  return { deviceId: 'mic-001', label: 'Default Microphone', kind: 'audioinput', isDefault: true, ...overrides };
}

function makeVideoDevice(overrides: Partial<DeviceHandle> = {}): DeviceHandle {
  return { deviceId: 'cam-001', label: 'Default Camera', kind: 'videoinput', isDefault: true, ...overrides };
}

// ---------------------------------------------------------------------------
// TP-CLIENT-DEVICE-001: enumerateDevices()
// ---------------------------------------------------------------------------

describe('DeviceManager.enumerateDevices()', () => {
  it('TP-CLIENT-DEVICE-001a: delegates to enumerator.list() and returns all devices', async () => {
    const mic = makeAudioDevice();
    const cam = makeVideoDevice();
    const manager = new DeviceManager(new MockDeviceEnumerator([mic, cam]));

    const devices = await manager.enumerateDevices();

    expect(devices).toHaveLength(2);
    expect(devices[0].deviceId).toBe('mic-001');
    expect(devices[1].deviceId).toBe('cam-001');
  });

  it('TP-CLIENT-DEVICE-001b: returns an empty array when the enumerator has no devices', async () => {
    const manager = new DeviceManager(new MockDeviceEnumerator());

    const devices = await manager.enumerateDevices();

    expect(devices).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TP-CLIENT-DEVICE-002: selectMicrophone() / selectCamera()
// ---------------------------------------------------------------------------

describe('DeviceManager.selectMicrophone() / selectCamera()', () => {
  it('TP-CLIENT-DEVICE-002a: selectMicrophone() does not immediately set mic as available', () => {
    const manager = new DeviceManager(new MockDeviceEnumerator());

    manager.selectMicrophone('mic-xyz');

    expect(manager.isMicrophoneAvailable()).toBe(false);
  });

  it('TP-CLIENT-DEVICE-002b: selectCamera() does not immediately set camera as available', () => {
    const manager = new DeviceManager(new MockDeviceEnumerator());

    manager.selectCamera('cam-xyz');

    expect(manager.isCameraAvailable()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TP-CLIENT-DEVICE-003: activateMicrophone()
// ---------------------------------------------------------------------------

describe('DeviceManager.activateMicrophone()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('TP-CLIENT-DEVICE-003a: isMicrophoneAvailable() returns true after permission is granted', async () => {
    mockRequestPermissions.mockResolvedValue({ granted: true, status: 'granted' });
    const manager = new DeviceManager(new MockDeviceEnumerator());

    await manager.activateMicrophone();

    expect(manager.isMicrophoneAvailable()).toBe(true);
  });

  it('TP-CLIENT-DEVICE-003b: throws with an actionable message when permission is denied', async () => {
    mockRequestPermissions.mockResolvedValue({ granted: false, status: 'denied' });
    const manager = new DeviceManager(new MockDeviceEnumerator());

    await expect(manager.activateMicrophone()).rejects.toThrow(/microphone/i);
  });

  it('TP-CLIENT-DEVICE-003c: isMicrophoneAvailable() remains false when permission is denied', async () => {
    mockRequestPermissions.mockResolvedValue({ granted: false, status: 'denied' });
    const manager = new DeviceManager(new MockDeviceEnumerator());

    await manager.activateMicrophone().catch(() => {});

    expect(manager.isMicrophoneAvailable()).toBe(false);
  });

  it('TP-CLIENT-DEVICE-003d: returns a Promise', () => {
    mockRequestPermissions.mockResolvedValue({ granted: true, status: 'granted' });
    const manager = new DeviceManager(new MockDeviceEnumerator());

    const result = manager.activateMicrophone();

    expect(result).toBeInstanceOf(Promise);
    return result;
  });
});

// ---------------------------------------------------------------------------
// TP-CLIENT-DEVICE-004: activateCamera()
// ---------------------------------------------------------------------------

describe('DeviceManager.activateCamera()', () => {
  it('TP-CLIENT-DEVICE-004a: resolves without throwing (video pipeline not yet implemented)', async () => {
    const manager = new DeviceManager(new MockDeviceEnumerator());

    await expect(manager.activateCamera()).resolves.toBeUndefined();
  });

  it('TP-CLIENT-DEVICE-004b: isCameraAvailable() returns false (video pipeline not yet implemented)', async () => {
    const manager = new DeviceManager(new MockDeviceEnumerator());

    await manager.activateCamera();

    expect(manager.isCameraAvailable()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TP-CLIENT-DEVICE-005: startAudioPipeline()
// ---------------------------------------------------------------------------

describe('DeviceManager.startAudioPipeline()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestPermissions.mockResolvedValue({ granted: true, status: 'granted' });
  });

  it('TP-CLIENT-DEVICE-005a: delegates to audioPipeline.start() with the given sessionId', async () => {
    const pipeline = new MockAudioPipeline();
    const manager = new DeviceManager(new MockDeviceEnumerator(), pipeline);
    await manager.activateMicrophone();

    await manager.startAudioPipeline('sess-abc');

    expect(pipeline.startCalled).toBe(true);
    expect(pipeline.startCalledWith).toBe('sess-abc');
  });

  it('TP-CLIENT-DEVICE-005b: throws when microphone has not been activated', async () => {
    const pipeline = new MockAudioPipeline();
    const manager = new DeviceManager(new MockDeviceEnumerator(), pipeline);
    // activateMicrophone() intentionally NOT called

    await expect(manager.startAudioPipeline('sess-abc')).rejects.toThrow();
  });

  it('TP-CLIENT-DEVICE-005c: throws when no audio pipeline is configured', async () => {
    const manager = new DeviceManager(new MockDeviceEnumerator()); // pipeline = null
    await manager.activateMicrophone();

    await expect(manager.startAudioPipeline('sess-abc')).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// TP-CLIENT-DEVICE-006: startVideoPipeline()
// ---------------------------------------------------------------------------

describe('DeviceManager.startVideoPipeline()', () => {
  it('TP-CLIENT-DEVICE-006a: resolves without throwing (video pipeline not yet implemented)', async () => {
    const manager = new DeviceManager(new MockDeviceEnumerator());

    await expect(manager.startVideoPipeline('sess-abc')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// TP-CLIENT-DEVICE-007: stopAllPipelines()
// ---------------------------------------------------------------------------

describe('DeviceManager.stopAllPipelines()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestPermissions.mockResolvedValue({ granted: true, status: 'granted' });
  });

  it('TP-CLIENT-DEVICE-007a: calls stop() on the audio pipeline', async () => {
    const pipeline = new MockAudioPipeline();
    const manager = new DeviceManager(new MockDeviceEnumerator(), pipeline);
    await manager.activateMicrophone();
    await manager.startAudioPipeline('sess-stop');

    manager.stopAllPipelines();

    expect(pipeline.stopCalled).toBe(true);
  });

  it('TP-CLIENT-DEVICE-007b: is safe to call when no audio pipeline is configured', () => {
    const manager = new DeviceManager(new MockDeviceEnumerator());

    expect(() => manager.stopAllPipelines()).not.toThrow();
  });

  it('TP-CLIENT-DEVICE-007c: resets isMicrophoneAvailable to false after stop', async () => {
    const pipeline = new MockAudioPipeline();
    const manager = new DeviceManager(new MockDeviceEnumerator(), pipeline);
    await manager.activateMicrophone();

    manager.stopAllPipelines();

    expect(manager.isMicrophoneAvailable()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TP-CLIENT-DEVICE-008: DeviceHandle shape
// ---------------------------------------------------------------------------

describe('DeviceHandle', () => {
  it('TP-CLIENT-DEVICE-008a: has deviceId, label, kind, and isDefault fields', () => {
    const device = makeAudioDevice();

    expect(typeof device.deviceId).toBe('string');
    expect(typeof device.label).toBe('string');
    expect(device.kind === 'audioinput' || device.kind === 'videoinput').toBe(true);
    expect(typeof device.isDefault).toBe('boolean');
  });

  it('TP-CLIENT-DEVICE-008b: kind discriminates audioinput from videoinput', () => {
    expect(makeAudioDevice().kind).toBe('audioinput');
    expect(makeVideoDevice().kind).toBe('videoinput');
  });
});
