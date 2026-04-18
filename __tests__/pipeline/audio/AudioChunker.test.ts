/**
 * @jest-environment node
 */
/**
 * Unit tests — AudioChunker
 *
 * Verifies that MelFrames are batched into AudioFeatureChunks correctly,
 * listeners are notified, and start/stop resets internal state.
 *
 * Test plan reference: TP-CLIENT-AUDIO-005 through TP-CLIENT-AUDIO-008
 */

import { AudioChunker } from '@/pipeline/audio/AudioChunker';
import { VoiceActivityDetector } from '@/pipeline/audio/VoiceActivityDetector';
import { AudioFeatureExtractor } from '@/pipeline/audio/AudioFeatureExtractor';
import type { MelFrame } from '@/pipeline/audio/AudioPipeline';
import type { AudioFeatureChunk } from '@common/models';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fake MelFrame with a given timestamp and deterministic coefficients. */
function fakeFrame(timestampMs: number, seed = 0): MelFrame {
  return {
    timestampMs,
    coefficients: Array.from({ length: 80 }, (_, i) => seed + i * 0.1),
    energy: 0.5 + seed * 0.01,
  };
}

/** Push `count` fake frames into the chunker, spaced 10 ms apart starting at `startMs`. */
function pushFrames(chunker: AudioChunker, count: number, startMs = 0): void {
  for (let i = 0; i < count; i++) {
    chunker.push(fakeFrame(startMs + i * 10, i));
  }
}

// framesPerChunk = 500ms / 10ms = 50
const FRAMES_PER_CHUNK = 50;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AudioChunker', () => {
  let chunker: AudioChunker;

  beforeEach(() => {
    chunker = new AudioChunker();
    chunker.start('session-1');
  });

  afterEach(() => {
    chunker.stop();
  });

  // -- TP-CLIENT-AUDIO-005: chunk emission after FRAMES_PER_CHUNK frames ---

  it('emits a chunk after 50 frames', () => {
    const chunks: AudioFeatureChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    pushFrames(chunker, FRAMES_PER_CHUNK);

    expect(chunks).toHaveLength(1);
  });

  it('does not emit a chunk before 50 frames', () => {
    const chunks: AudioFeatureChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    pushFrames(chunker, FRAMES_PER_CHUNK - 1);

    expect(chunks).toHaveLength(0);
  });

  it('emits two chunks after 100 frames', () => {
    const chunks: AudioFeatureChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    pushFrames(chunker, FRAMES_PER_CHUNK * 2);

    expect(chunks).toHaveLength(2);
  });

  it('buffers leftover frames for the next chunk', () => {
    const chunks: AudioFeatureChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    pushFrames(chunker, FRAMES_PER_CHUNK + 10);
    expect(chunks).toHaveLength(1);

    // 10 leftover + 40 more = 50 → second chunk
    pushFrames(chunker, FRAMES_PER_CHUNK - 10, (FRAMES_PER_CHUNK + 10) * 10);
    expect(chunks).toHaveLength(2);
  });

  // -- TP-CLIENT-AUDIO-006: chunk content correctness -----------------------

  it('sets sessionId from start()', () => {
    const chunks: AudioFeatureChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    pushFrames(chunker, FRAMES_PER_CHUNK);

    expect(chunks[0].sessionId).toBe('session-1');
  });

  it('uses the first frame timestamp as chunk timestampMs', () => {
    const chunks: AudioFeatureChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    pushFrames(chunker, FRAMES_PER_CHUNK, 1000);

    expect(chunks[0].timestampMs).toBe(1000);
  });

  it('maps frame coefficients into features array', () => {
    const chunks: AudioFeatureChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    pushFrames(chunker, FRAMES_PER_CHUNK);

    expect(chunks[0].features).toHaveLength(FRAMES_PER_CHUNK);
    expect(chunks[0].features[0]).toHaveLength(80);
  });

  it('sets featureType to mel_spectrogram', () => {
    const chunks: AudioFeatureChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    pushFrames(chunker, FRAMES_PER_CHUNK);

    expect(chunks[0].featureType).toBe('mel_spectrogram');
  });

  it('sets sampleRateHz to 16000', () => {
    const chunks: AudioFeatureChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    pushFrames(chunker, FRAMES_PER_CHUNK);

    expect(chunks[0].sampleRateHz).toBe(16000);
  });

  it('calculates chunkDurationMs as frames × 10ms', () => {
    const chunks: AudioFeatureChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    pushFrames(chunker, FRAMES_PER_CHUNK);

    expect(chunks[0].chunkDurationMs).toBe(500);
  });

  // -- TP-CLIENT-AUDIO-007: listener management -----------------------------

  it('notifies multiple listeners', () => {
    let countA = 0;
    let countB = 0;
    chunker.onChunk(() => countA++);
    chunker.onChunk(() => countB++);

    pushFrames(chunker, FRAMES_PER_CHUNK);

    expect(countA).toBe(1);
    expect(countB).toBe(1);
  });

  it('stops notifying after unsubscribe', () => {
    let count = 0;
    const unsub = chunker.onChunk(() => count++);

    pushFrames(chunker, FRAMES_PER_CHUNK);
    expect(count).toBe(1);

    unsub();
    pushFrames(chunker, FRAMES_PER_CHUNK, FRAMES_PER_CHUNK * 10);
    expect(count).toBe(1);
  });

  // -- TP-CLIENT-AUDIO-008: start/stop lifecycle ----------------------------

  it('clears buffer on stop', () => {
    const chunks: AudioFeatureChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    pushFrames(chunker, 10);
    chunker.stop();
    chunker.start('session-2');
    pushFrames(chunker, FRAMES_PER_CHUNK);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].sessionId).toBe('session-2');
  });

  it('uses new sessionId after restart', () => {
    const chunks: AudioFeatureChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    pushFrames(chunker, FRAMES_PER_CHUNK);
    chunker.stop();
    chunker.start('session-2');
    pushFrames(chunker, FRAMES_PER_CHUNK, FRAMES_PER_CHUNK * 10);

    expect(chunks[0].sessionId).toBe('session-1');
    expect(chunks[1].sessionId).toBe('session-2');
  });

  it('clears buffer on start (fresh session)', () => {
    const chunks: AudioFeatureChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    pushFrames(chunker, 15);
    chunker.start('session-2'); // restart without stop — should clear buffer
    pushFrames(chunker, FRAMES_PER_CHUNK);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].sessionId).toBe('session-2');
  });

  // -- VAD + FeatureExtractor wiring ---------------------------------------

  describe('VAD gating', () => {
    it('drops chunks whose frames are classified as silence', () => {
      const silentVad: VoiceActivityDetector = {
        isSpeechPresent: () => false,
        setSensitivity: () => {},
        getSensitivity: () => 'medium',
      } as unknown as VoiceActivityDetector;

      const silentChunker = new AudioChunker(500, 16000, silentVad);
      silentChunker.start('session-silent');

      const chunks: AudioFeatureChunk[] = [];
      silentChunker.onChunk((c) => chunks.push(c));

      pushFrames(silentChunker, FRAMES_PER_CHUNK);

      expect(chunks).toHaveLength(0);
      silentChunker.stop();
    });

    it('emits when VAD reports speech present', () => {
      const speechVad: VoiceActivityDetector = {
        isSpeechPresent: () => true,
        setSensitivity: () => {},
        getSensitivity: () => 'medium',
      } as unknown as VoiceActivityDetector;

      const speechChunker = new AudioChunker(500, 16000, speechVad);
      speechChunker.start('session-speech');

      const chunks: AudioFeatureChunk[] = [];
      speechChunker.onChunk((c) => chunks.push(c));

      pushFrames(speechChunker, FRAMES_PER_CHUNK);

      expect(chunks).toHaveLength(1);
      speechChunker.stop();
    });

    it('exposes the internal VAD for sensitivity configuration', () => {
      const vad = new VoiceActivityDetector();
      const c = new AudioChunker(500, 16000, vad);

      expect(c.getVoiceActivityDetector()).toBe(vad);
    });
  });

  describe('feature extractor wiring', () => {
    it('delegates chunk construction to the injected extractor', () => {
      const extractor = new AudioFeatureExtractor();
      const extractSpy = jest.spyOn(extractor, 'extract');

      const c = new AudioChunker(500, 16000, new VoiceActivityDetector(), extractor);
      c.start('session-extract');

      const chunks: AudioFeatureChunk[] = [];
      c.onChunk((ch) => chunks.push(ch));

      pushFrames(c, FRAMES_PER_CHUNK);

      expect(extractSpy).toHaveBeenCalledTimes(1);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].sessionId).toBe('session-extract');
      c.stop();
    });

    it('emits nothing before start() because the extractor is not ready', () => {
      const c = new AudioChunker();
      const chunks: AudioFeatureChunk[] = [];
      c.onChunk((ch) => chunks.push(ch));

      pushFrames(c, FRAMES_PER_CHUNK);

      expect(chunks).toHaveLength(0);
    });

    it('tears down the extractor on stop()', () => {
      const extractor = new AudioFeatureExtractor();
      const c = new AudioChunker(500, 16000, new VoiceActivityDetector(), extractor);

      c.start('session-teardown');
      expect(extractor.isReady()).toBe(true);

      c.stop();
      expect(extractor.isReady()).toBe(false);
    });
  });
});
