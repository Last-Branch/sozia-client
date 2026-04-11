/**
 * @jest-environment node
 */
/**
 * Unit tests — AudioChunker
 *
 * Verifies that MFCCFrames are batched into AudioFeatureChunks correctly,
 * listeners are notified, and start/stop resets internal state.
 *
 * Test plan reference: TP-CLIENT-AUDIO-005 through TP-CLIENT-AUDIO-008
 */

import { AudioChunker } from '../../../src/pipeline/audio/AudioChunker';
import { VoiceActivityDetector } from '../../../src/pipeline/audio/VoiceActivityDetector';
import { AudioFeatureExtractor } from '../../../src/pipeline/audio/AudioFeatureExtractor';
import type { MFCCFrame } from '../../../src/pipeline/audio/AudioPipeline';
import type { AudioFeatureChunk } from '../../../src/common/models';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fake MFCCFrame with a given timestamp and deterministic coefficients. */
function fakeFrame(timestampMs: number, seed = 0): MFCCFrame {
  return {
    timestampMs,
    coefficients: Array.from({ length: 13 }, (_, i) => seed + i * 0.1),
    energy: 0.5 + seed * 0.01,
  };
}

/** Push `count` fake frames into the chunker, spaced 25 ms apart starting at `startMs`. */
function pushFrames(chunker: AudioChunker, count: number, startMs = 0): void {
  for (let i = 0; i < count; i++) {
    chunker.push(fakeFrame(startMs + i * 25, i));
  }
}

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

  it('emits a chunk after 20 frames', () => {
    const chunks: AudioFeatureChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    pushFrames(chunker, 20);

    expect(chunks).toHaveLength(1);
  });

  it('does not emit a chunk before 20 frames', () => {
    const chunks: AudioFeatureChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    pushFrames(chunker, 19);

    expect(chunks).toHaveLength(0);
  });

  it('emits two chunks after 40 frames', () => {
    const chunks: AudioFeatureChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    pushFrames(chunker, 40);

    expect(chunks).toHaveLength(2);
  });

  it('buffers leftover frames for the next chunk', () => {
    const chunks: AudioFeatureChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    pushFrames(chunker, 25);
    expect(chunks).toHaveLength(1);

    // 5 leftover + 15 more = 20 → second chunk
    pushFrames(chunker, 15, 25 * 25);
    expect(chunks).toHaveLength(2);
  });

  // -- TP-CLIENT-AUDIO-006: chunk content correctness -----------------------

  it('sets sessionId from start()', () => {
    const chunks: AudioFeatureChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    pushFrames(chunker, 20);

    expect(chunks[0].sessionId).toBe('session-1');
  });

  it('uses the first frame timestamp as chunk timestampMs', () => {
    const chunks: AudioFeatureChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    pushFrames(chunker, 20, 1000);

    expect(chunks[0].timestampMs).toBe(1000);
  });

  it('maps frame coefficients into features array', () => {
    const chunks: AudioFeatureChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    pushFrames(chunker, 20);

    expect(chunks[0].features).toHaveLength(20);
    expect(chunks[0].features[0]).toHaveLength(13);
  });

  it('sets featureType to mfcc', () => {
    const chunks: AudioFeatureChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    pushFrames(chunker, 20);

    expect(chunks[0].featureType).toBe('mfcc');
  });

  it('sets sampleRateHz to 16000', () => {
    const chunks: AudioFeatureChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    pushFrames(chunker, 20);

    expect(chunks[0].sampleRateHz).toBe(16000);
  });

  it('calculates chunkDurationMs as frames × 25ms', () => {
    const chunks: AudioFeatureChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    pushFrames(chunker, 20);

    expect(chunks[0].chunkDurationMs).toBe(500);
  });

  // -- TP-CLIENT-AUDIO-007: listener management -----------------------------

  it('notifies multiple listeners', () => {
    let countA = 0;
    let countB = 0;
    chunker.onChunk(() => countA++);
    chunker.onChunk(() => countB++);

    pushFrames(chunker, 20);

    expect(countA).toBe(1);
    expect(countB).toBe(1);
  });

  it('stops notifying after unsubscribe', () => {
    let count = 0;
    const unsub = chunker.onChunk(() => count++);

    pushFrames(chunker, 20);
    expect(count).toBe(1);

    unsub();
    pushFrames(chunker, 20, 20 * 25);
    expect(count).toBe(1);
  });

  // -- TP-CLIENT-AUDIO-008: start/stop lifecycle ----------------------------

  it('clears buffer on stop', () => {
    const chunks: AudioFeatureChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    pushFrames(chunker, 10);
    chunker.stop();
    chunker.start('session-2');
    pushFrames(chunker, 20);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].sessionId).toBe('session-2');
  });

  it('uses new sessionId after restart', () => {
    const chunks: AudioFeatureChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    pushFrames(chunker, 20);
    chunker.stop();
    chunker.start('session-2');
    pushFrames(chunker, 20, 20 * 25);

    expect(chunks[0].sessionId).toBe('session-1');
    expect(chunks[1].sessionId).toBe('session-2');
  });

  it('clears buffer on start (fresh session)', () => {
    const chunks: AudioFeatureChunk[] = [];
    chunker.onChunk((c) => chunks.push(c));

    pushFrames(chunker, 15);
    chunker.start('session-2'); // restart without stop — should clear buffer
    pushFrames(chunker, 20);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].sessionId).toBe('session-2');
  });

  it('drops all listeners when clearListeners() is called', () => {
    let received = 0;
    chunker.onChunk(() => {
      received += 1;
    });

    pushFrames(chunker, 20);
    expect(received).toBe(1);

    chunker.clearListeners();
    pushFrames(chunker, 20, 20 * 25);
    expect(received).toBe(1);
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

      pushFrames(silentChunker, 20);

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

      pushFrames(speechChunker, 20);

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

      pushFrames(c, 20);

      expect(extractSpy).toHaveBeenCalledTimes(1);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].sessionId).toBe('session-extract');
      c.stop();
    });

    it('emits nothing before start() because the extractor is not ready', () => {
      const c = new AudioChunker();
      const chunks: AudioFeatureChunk[] = [];
      c.onChunk((ch) => chunks.push(ch));

      pushFrames(c, 20);

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