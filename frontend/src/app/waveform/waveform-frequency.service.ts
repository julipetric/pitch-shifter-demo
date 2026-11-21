import { Injectable } from '@angular/core';

const FFT_SIZE = 2048;
const NUM_FREQ_SEGMENTS = 128;
/** Segments per chunk: yield and re-render after each chunk. Larger = faster total time, smaller = more responsive UI. */
const FREQ_CHUNK_SIZE = 8;

export type WaveformFrequencyComputeOptions = {
  /** Called after each chunk so the UI can re-render. */
  onChunkDone?: () => void;
  /** When aborted, computation stops. */
  signal?: AbortSignal;
};

@Injectable()
export class WaveformFrequencyService {
  private frequencyBySegment: (number | undefined)[] = [];

  /** Number of frequency segments (used when mapping bar index to segment index). */
  get numFreqSegments(): number {
    return NUM_FREQ_SEGMENTS;
  }

  getFrequencyBySegment(): (number | undefined)[] {
    return this.frequencyBySegment;
  }

  /** Clear state (e.g. when stream URL changes). */
  reset(): void {
    this.frequencyBySegment = [];
  }

  /**
   * Compute dominant frequency per segment via chunked FFT; updates internal state
   * and calls onChunkDone after each chunk for progressive re-rendering.
   *
   * A run writes its results only into the segment array it creates, so an aborted run
   * cannot leak into the state of a later run or of `reset()`.
   */
  async computeFrequencyBySegment(
    buffer: AudioBuffer,
    options: WaveformFrequencyComputeOptions = {}
  ): Promise<void> {
    const { onChunkDone, signal } = options;
    const segments: (number | undefined)[] = new Array(NUM_FREQ_SEGMENTS);
    this.frequencyBySegment = segments;
    const sampleRate = buffer.sampleRate;
    const channel = buffer.getChannelData(0);
    const length = channel.length;
    const step = Math.max(1, Math.floor((length - FFT_SIZE) / NUM_FREQ_SEGMENTS));

    for (let chunkStart = 0; chunkStart < NUM_FREQ_SEGMENTS; chunkStart += FREQ_CHUNK_SIZE) {
      if (signal?.aborted) break;
      const chunkEnd = Math.min(chunkStart + FREQ_CHUNK_SIZE, NUM_FREQ_SEGMENTS);
      for (let s = chunkStart; s < chunkEnd; s++) {
        const offset = Math.min(s * step, length - FFT_SIZE);
        if (offset < 0) {
          segments[s] = 0;
          continue;
        }
        const slice = channel.slice(offset, offset + FFT_SIZE);
        const segmentBuffer = this.audioBufferSlice(slice, sampleRate);
        const freqHz = await this.peakFrequencyFromBuffer(segmentBuffer, sampleRate);
        segments[s] = freqHz;
      }
      await this.yieldToMain();
      try {
        onChunkDone?.();
      } catch {
        break;
      }
    }
  }

  private yieldToMain(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  private audioBufferSlice(samples: Float32Array, sampleRate: number): AudioBuffer {
    const ctx = new OfflineAudioContext(1, samples.length, sampleRate);
    const buf = ctx.createBuffer(1, samples.length, sampleRate);
    buf.getChannelData(0).set(samples);
    return buf;
  }

  private async peakFrequencyFromBuffer(buffer: AudioBuffer, sampleRate: number): Promise<number> {
    const ctx = new OfflineAudioContext(1, FFT_SIZE, sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    source.start(0);
    await ctx.startRendering();

    const data = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(data);

    let maxMag = -Infinity;
    let peakBin = 0;
    for (let i = 1; i < data.length; i++) {
      const v = data[i] ?? -Infinity;
      if (v > maxMag && Number.isFinite(v)) {
        maxMag = v;
        peakBin = i;
      }
    }
    return (peakBin * sampleRate) / FFT_SIZE;
  }
}
