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
 * Test plan reference: TP-CLIENT-DEVICE-001 through TP-CLIENT-DEVICE-010
 */

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('react-native-vision-camera', () => ({
  Camera: {
    requestCameraPermission: jest.fn(),
  },
}));

jest.mock('expo-audio', () => ({
  requestRecordingPermissionsAsync: jest.fn(),
}));

jest.mock('expo-camera', () => ({
  Camera: {
    requestCameraPermissionsAsync: jest.fn(),
  },
}));

import { requestRecordingPermissionsAsync } from 'expo-audio';
import { Camera as ExpoCamera } from 'expo-camera';
import { DeviceManager } from '@/device/DeviceManager';
import type { IDeviceEnumerator } from '@/device/DeviceEnumerator';
import type { DeviceHandle } from '@/device/DeviceHandle';
import type {
  IAudioPipeline,
  MFCCFrame,
  RawAudioHandle,
  SensitivityLevel,
} from '@/pipeline/audio';
import type { IVideoPipeline, RawMediaHandle } from '@/pipeline/video';
import type { PipelineHealth } from '@common/models';
import type { TransmissionManager } from '@/transmission/TransmissionManager';

const mockRequestPermissions = requestRecordingPermissionsAsync as jest.Mock;
const mockRequestCameraPermissions = ExpoCamera.requestCameraPermissionsAsync as jest.Mock;

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
  startCalledWithTx: TransmissionManager | undefined = undefined;
  stopCalled = false;
  lastVadSensitivity: SensitivityLevel | null = null;

  async start(
    sessionId: string,
    _micHandle: RawAudioHandle = {},
    tx?: TransmissionManager,
  ): Promise<void> {
    this.sessionId = sessionId;
    this.available = true;
    this.startCalled = true;
    this.startCalledWith = sessionId;
    this.startCalledWithTx = tx;
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

  setVadSensitivity(level: SensitivityLevel): void {
    this.lastVadSensitivity = level;
  }
}

// ---------------------------------------------------------------------------
// MockVideoPipeline
// ---------------------------------------------------------------------------

class MockVideoPipeline implements IVideoPipeline {
  private sessionId = '';
  private running = false;
  startCalled = false;
  startCalledWithSessionId = '';
  stopCalled = false;

  start(sessionId: string, _cameraHandle: RawMediaHandle, _tx?: TransmissionManager): void {
    this.sessionId = sessionId;
    this.running = true;
    this.startCalled = true;
    this.startCalledWithSessionId = sessionId;
  }

  setCameraHandle(_handle: RawMediaHandle): void {}

  pause(): void {
    this.running = false;
  }

  resume(): void {
    this.running = true;
  }

  stop(): void {
    this.sessionId = '';
    this.running = false;
    this.stopCalled = true;
  }

  getHealth(): PipelineHealth {
    return {
      sessionId: this.sessionId,
      pipeline: 'video',
      available: this.running,
      fps: this.running ? 30 : 0,
      snr: null,
      faceDetected: this.running ? true : null,
      lastUpdatedMs: Date.now(),
    };
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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('TP-CLIENT-DEVICE-004a: isCameraAvailable() returns true after permission is granted', async () => {
    mockRequestCameraPermissions.mockResolvedValue({ granted: true, status: 'granted' });
    const manager = new DeviceManager(new MockDeviceEnumerator());

    await manager.activateCamera();

    expect(manager.isCameraAvailable()).toBe(true);
  });

  it('TP-CLIENT-DEVICE-004b: throws with an actionable message when permission is denied', async () => {
    mockRequestCameraPermissions.mockResolvedValue({ granted: false, status: 'denied' });
    const manager = new DeviceManager(new MockDeviceEnumerator());

    await expect(manager.activateCamera()).rejects.toThrow(/camera/i);
  });

  it('TP-CLIENT-DEVICE-004c: isCameraAvailable() remains false when permission is denied', async () => {
    mockRequestCameraPermissions.mockResolvedValue({ granted: false, status: 'denied' });
    const manager = new DeviceManager(new MockDeviceEnumerator());

    await manager.activateCamera().catch(() => {});

    expect(manager.isCameraAvailable()).toBe(false);
  });

  it('TP-CLIENT-DEVICE-004d: isCameraAvailable() resets to false after stopAllPipelines()', async () => {
    mockRequestCameraPermissions.mockResolvedValue({ granted: true, status: 'granted' });
    const manager = new DeviceManager(new MockDeviceEnumerator());
    await manager.activateCamera();

    manager.stopAllPipelines();

    expect(manager.isCameraAvailable()).toBe(false);
  });

  it('TP-CLIENT-DEVICE-004e: returns a Promise', () => {
    mockRequestCameraPermissions.mockResolvedValue({ granted: true, status: 'granted' });
    const manager = new DeviceManager(new MockDeviceEnumerator());

    const result = manager.activateCamera();

    expect(result).toBeInstanceOf(Promise);
    return result;
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

  it('TP-CLIENT-DEVICE-005d: forwards the TransmissionManager to the pipeline', async () => {
    const pipeline = new MockAudioPipeline();
    const manager = new DeviceManager(new MockDeviceEnumerator(), pipeline);
    await manager.activateMicrophone();
    const fakeTx = { sendFeatures: () => {} } as unknown as TransmissionManager;

    await manager.startAudioPipeline('sess-tx', {}, fakeTx);

    expect(pipeline.startCalledWithTx).toBe(fakeTx);
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
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestCameraPermissions.mockResolvedValue({ granted: true, status: 'granted' });
  });

  it('TP-CLIENT-DEVICE-006a: throws when camera has not been activated', async () => {
    const pipeline = new MockVideoPipeline();
    const manager = new DeviceManager(new MockDeviceEnumerator(), null, pipeline);

    await expect(manager.startVideoPipeline('sess-abc')).rejects.toThrow(/camera/i);
  });

  it('TP-CLIENT-DEVICE-006b: throws when no video pipeline is configured', async () => {
    const manager = new DeviceManager(new MockDeviceEnumerator()); // videoPipeline = null
    await manager.activateCamera();

    await expect(manager.startVideoPipeline('sess-abc')).rejects.toThrow(/video pipeline/i);
  });

  it('TP-CLIENT-DEVICE-006c: delegates to videoPipeline.start() with the given sessionId', async () => {
    const pipeline = new MockVideoPipeline();
    const manager = new DeviceManager(new MockDeviceEnumerator(), null, pipeline);
    await manager.activateCamera();

    await manager.startVideoPipeline('sess-video');

    expect(pipeline.startCalled).toBe(true);
    expect(pipeline.startCalledWithSessionId).toBe('sess-video');
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

// ---------------------------------------------------------------------------
// TP-CLIENT-DEVICE-009: getVideoHealth()
// ---------------------------------------------------------------------------

describe('DeviceManager.getVideoHealth()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestCameraPermissions.mockResolvedValue({ granted: true, status: 'granted' });
  });

  it('TP-CLIENT-DEVICE-009a: returns a zeroed health object when no video pipeline is configured', () => {
    const manager = new DeviceManager(new MockDeviceEnumerator());

    const health = manager.getVideoHealth();

    expect(health.pipeline).toBe('video');
    expect(health.available).toBe(false);
    expect(health.sessionId).toBe('');
  });

  it('TP-CLIENT-DEVICE-009b: delegates to videoPipeline.getHealth() when configured', async () => {
    const pipeline = new MockVideoPipeline();
    const manager = new DeviceManager(new MockDeviceEnumerator(), null, pipeline);
    await manager.activateCamera();
    await manager.startVideoPipeline('sess-health');

    const health = manager.getVideoHealth();

    expect(health.pipeline).toBe('video');
    expect(health.sessionId).toBe('sess-health');
    expect(health.available).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TP-CLIENT-DEVICE-010: setAudioVadSensitivity()
// ---------------------------------------------------------------------------

describe('DeviceManager.setAudioVadSensitivity()', () => {
  it('TP-CLIENT-DEVICE-010a: delegates to the audio pipeline when configured', () => {
    const pipeline = new MockAudioPipeline();
    const manager = new DeviceManager(new MockDeviceEnumerator(), pipeline);

    manager.setAudioVadSensitivity('high');

    expect(pipeline.lastVadSensitivity).toBe('high');
  });

  it('TP-CLIENT-DEVICE-010b: is a no-op when no audio pipeline is configured', () => {
    const manager = new DeviceManager(new MockDeviceEnumerator());

    expect(() => manager.setAudioVadSensitivity('low')).not.toThrow();
  });
});
