/**
 * @jest-environment node
 */
/**
 * Unit tests — AudioFeatureExtractor
 *
 * Verifies lifecycle (init/teardown), chunk production from MFCCFrames,
 * and null-safety for uninitialised or empty-input scenarios.
 */

import { AudioFeatureExtractor } from '@/pipeline/audio/AudioFeatureExtractor';
import type { MFCCFrame } from '@/pipeline/audio/AudioPipeline';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeFrame(timestampMs: number, seed = 0): MFCCFrame {
  return {
    timestampMs,
    coefficients: Array.from({ length: 80 }, (_, i) => seed + i * 0.01),
    energy: -30 + seed,
  };
}

function fakeFrames(count: number, startMs = 0): MFCCFrame[] {
  return Array.from({ length: count }, (_, i) => fakeFrame(startMs + i * 25, i));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AudioFeatureExtractor', () => {
  let extractor: AudioFeatureExtractor;

  beforeEach(() => {
    extractor = new AudioFeatureExtractor();
  });

  it('is not ready before init', () => {
    expect(extractor.isReady()).toBe(false);
  });

  it('returns null when not initialised', () => {
    const result = extractor.extract(fakeFrames(5));
    expect(result).toBeNull();
  });

  it('returns null for empty input', () => {
    extractor.init('session-1');
    expect(extractor.extract([])).toBeNull();
  });

  it('becomes ready after init', () => {
    extractor.init('session-1');
    expect(extractor.isReady()).toBe(true);
  });

  it('produces a valid AudioFeatureChunk from frames', () => {
    extractor.init('session-abc');
    const input = fakeFrames(10, 100);
    const chunk = extractor.extract(input);

    expect(chunk).not.toBeNull();
    expect(chunk!.sessionId).toBe('session-abc');
    expect(chunk!.timestampMs).toBe(100);
    expect(chunk!.features).toHaveLength(10);
    expect(chunk!.features[0]).toHaveLength(80);
    expect(chunk!.featureType).toBe('mel_spectrogram');
    expect(chunk!.sampleRateHz).toBe(16000);
    expect(chunk!.chunkDurationMs).toBeGreaterThan(0);
  });

  it('uses custom sample rate', () => {
    const custom = new AudioFeatureExtractor(44100);
    custom.init('s1');
    const chunk = custom.extract(fakeFrames(5));
    expect(chunk!.sampleRateHz).toBe(44100);
  });

  it('handles single-frame input', () => {
    extractor.init('s1');
    const chunk = extractor.extract([fakeFrame(500)]);

    expect(chunk).not.toBeNull();
    expect(chunk!.timestampMs).toBe(500);
    expect(chunk!.features).toHaveLength(1);
    expect(chunk!.chunkDurationMs).toBe(25); // fallback frame duration
  });

  it('becomes not ready after teardown', () => {
    extractor.init('s1');
    expect(extractor.isReady()).toBe(true);

    extractor.teardown();
    expect(extractor.isReady()).toBe(false);
    expect(extractor.extract(fakeFrames(3))).toBeNull();
  });

  it('can be re-initialised after teardown', () => {
    extractor.init('s1');
    extractor.teardown();
    extractor.init('s2');

    const chunk = extractor.extract(fakeFrames(3));
    expect(chunk).not.toBeNull();
    expect(chunk!.sessionId).toBe('s2');
  });
});
