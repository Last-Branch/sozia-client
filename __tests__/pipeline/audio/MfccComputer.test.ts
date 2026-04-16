/**
 * Unit tests — MfccComputer
 *
 * Validates the pure-JS MFCC pipeline: shape, finite-ness, energy sensitivity,
 * and determinism. Does not assert exact coefficient values (they depend on
 * the filterbank, which is validated structurally rather than numerically).
 */

import { MfccComputer, frameLogEnergy } from '@/pipeline/audio/MfccComputer';

const FRAME_SIZE = 400; // 25 ms at 16 kHz

function sineFrame(frequency: number, sampleRate = 16_000): Float32Array {
  const samples = new Float32Array(FRAME_SIZE);
  for (let i = 0; i < FRAME_SIZE; i++) {
    samples[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return samples;
}

function silenceFrame(): Float32Array {
  return new Float32Array(FRAME_SIZE);
}

function noiseFrame(amplitude = 0.1): Float32Array {
  const samples = new Float32Array(FRAME_SIZE);
  for (let i = 0; i < FRAME_SIZE; i++) {
    samples[i] = (Math.random() * 2 - 1) * amplitude;
  }
  return samples;
}

// ---------------------------------------------------------------------------
// Output shape and finiteness
// ---------------------------------------------------------------------------

describe('MfccComputer.compute() — output shape', () => {
  const mfcc = new MfccComputer();

  it('returns exactly 13 coefficients', () => {
    const result = mfcc.compute(sineFrame(440));
    expect(result).toHaveLength(13);
  });

  it('all coefficients are finite numbers', () => {
    const result = mfcc.compute(sineFrame(440));
    result.forEach((c) => {
      expect(typeof c).toBe('number');
      expect(isFinite(c)).toBe(true);
    });
  });

  it('returns finite coefficients for a silent (all-zero) frame', () => {
    const result = mfcc.compute(silenceFrame());
    expect(result).toHaveLength(13);
    result.forEach((c) => expect(isFinite(c)).toBe(true));
  });

  it('returns finite coefficients for random noise', () => {
    const result = mfcc.compute(noiseFrame());
    result.forEach((c) => expect(isFinite(c)).toBe(true));
  });

  it('returns finite coefficients for a full-amplitude sine wave', () => {
    const result = mfcc.compute(sineFrame(1000));
    result.forEach((c) => expect(isFinite(c)).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe('MfccComputer.compute() — determinism', () => {
  it('produces identical output on repeated calls with the same input', () => {
    const mfcc = new MfccComputer();
    const frame = sineFrame(440);
    const first = mfcc.compute(frame);
    const second = mfcc.compute(frame);
    expect(first).toEqual(second);
  });

  it('two separate instances produce identical output for the same input', () => {
    const a = new MfccComputer();
    const b = new MfccComputer();
    const frame = sineFrame(880);
    expect(a.compute(frame)).toEqual(b.compute(frame));
  });
});

// ---------------------------------------------------------------------------
// Signal sensitivity — different inputs should produce different coefficients
// ---------------------------------------------------------------------------

describe('MfccComputer.compute() — signal sensitivity', () => {
  const mfcc = new MfccComputer();

  it('produces different coefficients for different frequencies', () => {
    const low = mfcc.compute(sineFrame(500));
    const high = mfcc.compute(sineFrame(4000));
    // At least one coefficient differs between a 500 Hz and 4000 Hz tone
    const anyDiffers = low.some((v, i) => Math.abs(v - high[i]) > 0.01);
    expect(anyDiffers).toBe(true);
  });

  it('produces different coefficients for silence vs noise', () => {
    const silent = mfcc.compute(silenceFrame());
    const noisy = mfcc.compute(noiseFrame(0.5));
    const anyDiffers = silent.some((v, i) => Math.abs(v - noisy[i]) > 0.01);
    expect(anyDiffers).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Partial frame (fewer than 400 samples)
// ---------------------------------------------------------------------------

describe('MfccComputer.compute() — partial frames', () => {
  const mfcc = new MfccComputer();

  it('handles a 200-sample (half-frame) input without throwing', () => {
    const half = new Float32Array(200);
    for (let i = 0; i < 200; i++) half[i] = Math.sin((2 * Math.PI * 440 * i) / 16000);
    const result = mfcc.compute(half);
    expect(result).toHaveLength(13);
    result.forEach((c) => expect(isFinite(c)).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// frameLogEnergy
// ---------------------------------------------------------------------------

describe('frameLogEnergy()', () => {
  it('returns a finite number for a sine wave', () => {
    const energy = frameLogEnergy(sineFrame(440));
    expect(typeof energy).toBe('number');
    expect(isFinite(energy)).toBe(true);
  });

  it('returns a value ≤ 0 for normalised PCM (samples in [-1,1])', () => {
    // RMS of a full-amplitude 0 dBFS signal is at most 0 dBFS
    expect(frameLogEnergy(sineFrame(440))).toBeLessThanOrEqual(0.1); // small tolerance
  });

  it('returns a more negative value for silence than for noise', () => {
    const silentEnergy = frameLogEnergy(silenceFrame());
    const noisyEnergy = frameLogEnergy(noiseFrame(0.5));
    expect(silentEnergy).toBeLessThan(noisyEnergy);
  });

  it('is clamped to -96 dBFS for a zero-amplitude frame', () => {
    expect(frameLogEnergy(silenceFrame())).toBeGreaterThanOrEqual(-96);
  });
});
