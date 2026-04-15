/**
 * @jest-environment node
 */
/**
 * Unit tests — VoiceActivityDetector
 *
 * Verifies energy-based speech detection across sensitivity levels,
 * edge cases (empty input, boundary thresholds), and sensitivity switching.
 */

import { VoiceActivityDetector } from '@/pipeline/audio/VoiceActivityDetector';
import type { MFCCFrame } from '@/pipeline/audio/AudioPipeline';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function frame(energy: number, timestampMs = 0): MFCCFrame {
  return {
    timestampMs,
    coefficients: Array.from({ length: 13 }, (_, i) => i * 0.1),
    energy,
  };
}

function frames(energies: number[]): MFCCFrame[] {
  return energies.map((e, i) => frame(e, i * 25));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('VoiceActivityDetector', () => {
  let vad: VoiceActivityDetector;

  beforeEach(() => {
    vad = new VoiceActivityDetector();
  });

  it('defaults to medium sensitivity', () => {
    expect(vad.getSensitivity()).toBe('medium');
  });

  it('returns false for an empty chunk', () => {
    expect(vad.isSpeechPresent([])).toBe(false);
  });

  it('detects speech when most frames have high energy (medium)', () => {
    // medium threshold: energy > -40, ratio >= 0.4
    const chunk = frames([-20, -25, -35, -50, -55]);
    // 3 out of 5 above -40 → ratio 0.6 >= 0.4
    expect(vad.isSpeechPresent(chunk)).toBe(true);
  });

  it('rejects silence when most frames have low energy (medium)', () => {
    const chunk = frames([-50, -55, -60, -45, -48]);
    // 0 out of 5 above -40 → ratio 0
    expect(vad.isSpeechPresent(chunk)).toBe(false);
  });

  it('low sensitivity requires stronger signal', () => {
    vad.setSensitivity('low');
    // low threshold: energy > -30, ratio >= 0.6
    const chunk = frames([-25, -28, -35, -40, -45]);
    // 2 out of 5 above -30 → ratio 0.4 < 0.6
    expect(vad.isSpeechPresent(chunk)).toBe(false);
  });

  it('low sensitivity accepts strong signal', () => {
    vad.setSensitivity('low');
    const chunk = frames([-10, -15, -20, -25, -45]);
    // 4 out of 5 above -30 → ratio 0.8 >= 0.6
    expect(vad.isSpeechPresent(chunk)).toBe(true);
  });

  it('high sensitivity triggers on quiet speech', () => {
    vad.setSensitivity('high');
    // high threshold: energy > -50, ratio >= 0.25
    const chunk = frames([-45, -55, -60, -65]);
    // 1 out of 4 above -50 → ratio 0.25 >= 0.25
    expect(vad.isSpeechPresent(chunk)).toBe(true);
  });

  it('high sensitivity still rejects deep silence', () => {
    vad.setSensitivity('high');
    const chunk = frames([-55, -60, -70, -80]);
    // 0 out of 4 above -50
    expect(vad.isSpeechPresent(chunk)).toBe(false);
  });

  it('setSensitivity changes the active level', () => {
    vad.setSensitivity('high');
    expect(vad.getSensitivity()).toBe('high');
    vad.setSensitivity('low');
    expect(vad.getSensitivity()).toBe('low');
  });

  it('handles a single-frame chunk', () => {
    const loud = frames([-20]);
    const quiet = frames([-55]);
    expect(vad.isSpeechPresent(loud)).toBe(true);
    expect(vad.isSpeechPresent(quiet)).toBe(false);
  });
});
