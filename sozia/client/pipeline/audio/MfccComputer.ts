/**
 * Pure-JS MFCC computation.
 *
 * Pipeline per frame:
 *   pre-emphasis → Hamming window → zero-pad to FFT size →
 *   FFT → power spectrum → Mel filterbank → log → DCT → first 13 coefficients
 *
 * Designed to operate on exactly FRAME_SIZE_SAMPLES (400) samples of Float32
 * PCM in the [-1, 1] range, as produced by @siteed/expo-audio-studio with
 * streamFormat: 'float32' at 16 kHz mono.
 */

const SAMPLE_RATE = 16_000; // Hz
const FRAME_SIZE_SAMPLES = 400; // 25 ms at 16 kHz
const FFT_SIZE = 512; // next power-of-2 above FRAME_SIZE_SAMPLES
const NUM_MEL_FILTERS = 26;
const NUM_MFCC_COEFFICIENTS = 13;
const PRE_EMPHASIS = 0.97;
const MEL_LOW_HZ = 80;
const MEL_HIGH_HZ = 8_000;

// ---------------------------------------------------------------------------
// Hz ↔ Mel conversions (O'Shaughnessy formula)
// ---------------------------------------------------------------------------

function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700);
}

function melToHz(mel: number): number {
  return 700 * (Math.pow(10, mel / 2595) - 1);
}

// ---------------------------------------------------------------------------
// Hamming window (pre-computed once per MfccComputer instance)
// ---------------------------------------------------------------------------

function buildHammingWindow(N: number): Float32Array {
  const w = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    w[n] = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (N - 1));
  }
  return w;
}

// ---------------------------------------------------------------------------
// Mel filterbank — returns NUM_MEL_FILTERS × (FFT_SIZE/2+1) weight matrix,
// stored row-major as a single Float32Array for cache efficiency.
// ---------------------------------------------------------------------------

function buildMelFilterbank(
  numFilters: number,
  fftSize: number,
  sampleRate: number,
  lowHz: number,
  highHz: number,
): Float32Array {
  const numBins = fftSize / 2 + 1;
  const bank = new Float32Array(numFilters * numBins);

  const lowMel = hzToMel(lowHz);
  const highMel = hzToMel(highHz);

  // numFilters + 2 centre points equally spaced in Mel
  const melPoints = new Float32Array(numFilters + 2);
  for (let i = 0; i < numFilters + 2; i++) {
    melPoints[i] = lowMel + (i * (highMel - lowMel)) / (numFilters + 1);
  }

  // Convert centre points to FFT bin indices
  const binPoints = new Float32Array(numFilters + 2);
  for (let i = 0; i < numFilters + 2; i++) {
    binPoints[i] = Math.floor(((fftSize + 1) * melToHz(melPoints[i])) / sampleRate);
  }

  for (let m = 0; m < numFilters; m++) {
    const left = binPoints[m];
    const centre = binPoints[m + 1];
    const right = binPoints[m + 2];
    const row = m * numBins;

    for (let k = left; k < centre; k++) {
      bank[row + k] = (k - left) / (centre - left);
    }
    for (let k = centre; k <= right; k++) {
      bank[row + k] = (right - k) / (right - centre);
    }
  }

  return bank;
}

// ---------------------------------------------------------------------------
// In-place Cooley-Tukey FFT (power-of-2 size, real input)
// ---------------------------------------------------------------------------

function fftInPlace(real: Float32Array, imag: Float32Array): void {
  const N = real.length;

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let tmp = real[i];
      real[i] = real[j];
      real[j] = tmp;
      tmp = imag[i];
      imag[i] = imag[j];
      imag[j] = tmp;
    }
  }

  // Butterfly passes
  for (let len = 2; len <= N; len <<= 1) {
    const ang = (2 * Math.PI) / len;
    const wReal = Math.cos(ang);
    const wImag = -Math.sin(ang);

    for (let i = 0; i < N; i += len) {
      let tReal = 1.0;
      let tImag = 0.0;

      for (let j = 0; j < len >> 1; j++) {
        const uR = real[i + j];
        const uI = imag[i + j];
        const vR = real[i + j + (len >> 1)] * tReal - imag[i + j + (len >> 1)] * tImag;
        const vI = real[i + j + (len >> 1)] * tImag + imag[i + j + (len >> 1)] * tReal;

        real[i + j] = uR + vR;
        imag[i + j] = uI + vI;
        real[i + j + (len >> 1)] = uR - vR;
        imag[i + j + (len >> 1)] = uI - vI;

        const nextR = tReal * wReal - tImag * wImag;
        tImag = tReal * wImag + tImag * wReal;
        tReal = nextR;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// DCT-II — maps NUM_MEL_FILTERS log-Mel energies to NUM_MFCC_COEFFICIENTS
// ---------------------------------------------------------------------------

function dctCoefficients(logMel: Float32Array, numCoeffs: number): number[] {
  const N = logMel.length;
  const coeffs: number[] = new Array(numCoeffs);
  for (let k = 0; k < numCoeffs; k++) {
    let sum = 0;
    for (let n = 0; n < N; n++) {
      sum += logMel[n] * Math.cos((Math.PI / N) * (n + 0.5) * k);
    }
    coeffs[k] = sum;
  }
  return coeffs;
}

// ---------------------------------------------------------------------------
// MfccComputer — stateless computation with pre-built, reusable buffers
// ---------------------------------------------------------------------------

export class MfccComputer {
  private readonly hammingWindow: Float32Array;
  private readonly melBank: Float32Array;

  // Reusable work buffers (avoids GC pressure at 40 Hz)
  private readonly fftReal: Float32Array;
  private readonly fftImag: Float32Array;
  private readonly melEnergies: Float32Array;

  constructor() {
    this.hammingWindow = buildHammingWindow(FRAME_SIZE_SAMPLES);
    this.melBank = buildMelFilterbank(
      NUM_MEL_FILTERS,
      FFT_SIZE,
      SAMPLE_RATE,
      MEL_LOW_HZ,
      MEL_HIGH_HZ,
    );
    this.fftReal = new Float32Array(FFT_SIZE);
    this.fftImag = new Float32Array(FFT_SIZE);
    this.melEnergies = new Float32Array(NUM_MEL_FILTERS);
  }

  /**
   * Compute 13 MFCC coefficients from a single audio frame.
   *
   * @param samples - Exactly FRAME_SIZE_SAMPLES (400) Float32 PCM values in [-1, 1].
   *   If fewer samples are provided the remainder is treated as zero-padded silence.
   */
  compute(samples: Float32Array): number[] {
    // 1. Pre-emphasis
    this.fftReal[0] = samples[0];
    const len = Math.min(samples.length, FRAME_SIZE_SAMPLES);
    for (let i = 1; i < len; i++) {
      this.fftReal[i] = samples[i] - PRE_EMPHASIS * samples[i - 1];
    }
    // Zero-pad beyond FRAME_SIZE_SAMPLES
    for (let i = len; i < FFT_SIZE; i++) {
      this.fftReal[i] = 0;
    }

    // 2. Apply Hamming window (only over the live samples)
    for (let i = 0; i < len; i++) {
      this.fftReal[i] *= this.hammingWindow[i];
    }

    // 3. FFT (imaginary part starts as zero)
    this.fftImag.fill(0);
    fftInPlace(this.fftReal, this.fftImag);

    // 4. Power spectrum (first FFT_SIZE/2+1 bins)
    const numBins = FFT_SIZE / 2 + 1;

    // 5. Mel filterbank
    const numFilters = NUM_MEL_FILTERS;
    for (let m = 0; m < numFilters; m++) {
      let energy = 0;
      const rowOffset = m * numBins;
      for (let k = 0; k < numBins; k++) {
        const power = this.fftReal[k] * this.fftReal[k] + this.fftImag[k] * this.fftImag[k];
        energy += this.melBank[rowOffset + k] * power;
      }
      this.melEnergies[m] = energy;
    }

    // 6. Log (with floor to avoid log(0))
    for (let m = 0; m < numFilters; m++) {
      this.melEnergies[m] = Math.log(this.melEnergies[m] + 1e-10);
    }

    // 7. DCT → first 13 coefficients
    return dctCoefficients(this.melEnergies, NUM_MFCC_COEFFICIENTS);
  }
}

/**
 * Compute the log-energy of a frame in dBFS.
 * Returns a value in (-∞, 0], clamped to −96 dBFS for silence.
 */
export function frameLogEnergy(samples: Float32Array): number {
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSq += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sumSq / samples.length);
  return Math.max(20 * Math.log10(rms + 1e-9), -96);
}
