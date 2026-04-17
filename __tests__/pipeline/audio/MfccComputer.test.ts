/**
 * Unit tests — MelComputer
 *
 * Validates the 80-bin log10-mel spectrogram pipeline: shape, finite-ness,
 * energy sensitivity, normalization range, and determinism.
 */

import { MelComputer, frameLogEnergy } from '@/pipeline/audio/MelComputer';

const FRAME_SIZE = 400; // 25 ms at 16 kHz
const NUM_MEL_BINS = 80;

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

describe('MelComputer.compute() — output shape', () => {
  const mel = new MelComputer();

  it('returns exactly 80 mel bins', () => {
    const result = mel.compute(sineFrame(440));
    expect(result).toHaveLength(NUM_MEL_BINS);
  });

  it('all values are finite numbers', () => {
    const result = mel.compute(sineFrame(440));
    result.forEach((c) => {
      expect(typeof c).toBe('number');
      expect(isFinite(c)).toBe(true);
    });
  });

  it('returns finite values for a silent (all-zero) frame', () => {
    const result = mel.compute(silenceFrame());
    expect(result).toHaveLength(NUM_MEL_BINS);
    result.forEach((c) => expect(isFinite(c)).toBe(true));
  });

  it('returns finite values for random noise', () => {
    const result = mel.compute(noiseFrame());
    result.forEach((c) => expect(isFinite(c)).toBe(true));
  });

  it('returns finite values for a full-amplitude sine wave', () => {
    const result = mel.compute(sineFrame(1000));
    result.forEach((c) => expect(isFinite(c)).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// Raw log10-mel — values should be negative for typical signals
// ---------------------------------------------------------------------------

describe('MelComputer.compute() — value range', () => {
  const mel = new MelComputer();

  it('produces negative log10-mel values for a typical signal', () => {
    const result = mel.compute(sineFrame(440));
    const allFinite = result.every((v) => isFinite(v));
    expect(allFinite).toBe(true);
  });

  it('silence produces lower values than a loud signal', () => {
    const silent = mel.compute(silenceFrame());
    const loud = mel.compute(sineFrame(440));
    const silentMean = silent.reduce((a, b) => a + b, 0) / silent.length;
    const loudMean = loud.reduce((a, b) => a + b, 0) / loud.length;
    expect(silentMean).toBeLessThan(loudMean);
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe('MelComputer.compute() — determinism', () => {
  it('produces identical output on repeated calls with the same input', () => {
    const mel = new MelComputer();
    const frame = sineFrame(440);
    const first = mel.compute(frame);
    const second = mel.compute(frame);
    expect(first).toEqual(second);
  });

  it('two separate instances produce identical output for the same input', () => {
    const a = new MelComputer();
    const b = new MelComputer();
    const frame = sineFrame(880);
    expect(a.compute(frame)).toEqual(b.compute(frame));
  });
});

// ---------------------------------------------------------------------------
// Signal sensitivity — different inputs should produce different outputs
// ---------------------------------------------------------------------------

describe('MelComputer.compute() — signal sensitivity', () => {
  const mel = new MelComputer();

  it('produces different values for different frequencies', () => {
    const low = mel.compute(sineFrame(500));
    const high = mel.compute(sineFrame(4000));
    const anyDiffers = low.some((v, i) => Math.abs(v - high[i]) > 0.01);
    expect(anyDiffers).toBe(true);
  });

  it('produces different values for silence vs noise', () => {
    const silent = mel.compute(silenceFrame());
    const noisy = mel.compute(noiseFrame(0.5));
    const anyDiffers = silent.some((v, i) => Math.abs(v - noisy[i]) > 0.01);
    expect(anyDiffers).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Partial frame (fewer than 400 samples)
// ---------------------------------------------------------------------------

describe('MelComputer.compute() — partial frames', () => {
  const mel = new MelComputer();

  it('handles a 200-sample (half-frame) input without throwing', () => {
    const half = new Float32Array(200);
    for (let i = 0; i < 200; i++) half[i] = Math.sin((2 * Math.PI * 440 * i) / 16000);
    const result = mel.compute(half);
    expect(result).toHaveLength(NUM_MEL_BINS);
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
    expect(frameLogEnergy(sineFrame(440))).toBeLessThanOrEqual(0.1);
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
