import { Configuration, getDefaultAppConfig } from '@/config/Configuration';
import { ModalityPath } from '@common/models';

type KV = {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
};

function makeStorage(seed: Record<string, string> = {}): KV & { data: Record<string, string> } {
  const data = { ...seed };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

const KEY = 'sozia.config.v1';

describe('Configuration', () => {
  test('loads defaults when empty', async () => {
    const s = makeStorage();
    const cfg = new Configuration(s);
    await cfg.load();

    const d = getDefaultAppConfig();
    expect(cfg.get('defaultPath')).toBe(d.defaultPath);
    expect(cfg.get('fontSize')).toBe(d.fontSize);
    expect(cfg.get('diagnosticsEnabled')).toBe(false);
  });

  test('set() updates and persists', () => {
    const s = makeStorage();
    const cfg = new Configuration(s);

    cfg.set('fontSize', 22);
    expect(cfg.get('fontSize')).toBe(22);

    const persisted = JSON.parse(s.data[KEY]);
    expect(persisted.fontSize).toBe(22);
  });

  test('load() reads persisted config', async () => {
    const s = makeStorage({
      [KEY]: JSON.stringify({
        defaultPath: ModalityPath.SIGN,
        fontSize: 20,
        confidenceThreshold: 0.4,
      }),
    });
    const cfg = new Configuration(s);
    await cfg.load();

    expect(cfg.get('defaultPath')).toBe(ModalityPath.SIGN);
    expect(cfg.get('fontSize')).toBe(20);
    expect(cfg.get('confidenceThreshold')).toBe(0.4);
  });

  test('reset() restores defaults and persists', () => {
    const s = makeStorage();
    const cfg = new Configuration(s);

    cfg.set('fontSize', 30);
    cfg.reset();

    const d = getDefaultAppConfig();
    expect(cfg.get('fontSize')).toBe(d.fontSize);
    expect(JSON.parse(s.data[KEY]).fontSize).toBe(d.fontSize);
  });

  test('invalid/corrupt JSON falls back to defaults', async () => {
    const s = makeStorage({ [KEY]: '{bad-json' });
    const cfg = new Configuration(s);
    await cfg.load();

    expect(cfg.get('defaultPath')).toBe(ModalityPath.SPEECH);
  });

  test('apiKey defaults to empty string', async () => {
    const s = makeStorage();
    const cfg = new Configuration(s);
    await cfg.load();

    expect(cfg.get('apiKey')).toBe('');
  });

  test('apiKey round-trips through set/get', () => {
    const s = makeStorage();
    const cfg = new Configuration(s);

    cfg.set('apiKey', 'sk-test-abc123');
    expect(cfg.get('apiKey')).toBe('sk-test-abc123');

    const persisted = JSON.parse(s.data[KEY]);
    expect(persisted.apiKey).toBe('sk-test-abc123');
  });

  // TC-07: Privacy Consent Flow — hasConsented persists in Configuration
  test('TC-07: hasConsented defaults to false', async () => {
    const s = makeStorage();
    const cfg = new Configuration(s);
    await cfg.load();

    expect(cfg.get('hasConsented')).toBe(false);
  });

  test('TC-07: hasConsented persists after set', () => {
    const s = makeStorage();
    const cfg = new Configuration(s);

    cfg.set('hasConsented', true);

    expect(cfg.get('hasConsented')).toBe(true);
    expect(JSON.parse(s.data[KEY]).hasConsented).toBe(true);
  });

  test('TC-07: hasConsented survives a load() round-trip', async () => {
    const s = makeStorage({ [KEY]: JSON.stringify({ hasConsented: true }) });
    const cfg = new Configuration(s);
    await cfg.load();

    expect(cfg.get('hasConsented')).toBe(true);
  });

  // TC-06: Device Selection — selected IDs persist in Configuration
  test('TC-06: selectedMicId persists after set', () => {
    const s = makeStorage();
    const cfg = new Configuration(s);

    cfg.set('selectedMicId', 'mic-abc');

    expect(cfg.get('selectedMicId')).toBe('mic-abc');
    expect(JSON.parse(s.data[KEY]).selectedMicId).toBe('mic-abc');
  });

  test('TC-06: selectedCameraId persists after set', () => {
    const s = makeStorage();
    const cfg = new Configuration(s);

    cfg.set('selectedCameraId', 'cam-xyz');

    expect(cfg.get('selectedCameraId')).toBe('cam-xyz');
    expect(JSON.parse(s.data[KEY]).selectedCameraId).toBe('cam-xyz');
  });

  test('TC-06: persisted device IDs survive a load() round-trip', async () => {
    const s = makeStorage({
      [KEY]: JSON.stringify({ selectedMicId: 'mic-persisted', selectedCameraId: 'cam-persisted' }),
    });
    const cfg = new Configuration(s);
    await cfg.load();

    expect(cfg.get('selectedMicId')).toBe('mic-persisted');
    expect(cfg.get('selectedCameraId')).toBe('cam-persisted');
  });
});
