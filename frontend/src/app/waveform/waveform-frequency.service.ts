import { Injectable } from '@angular/core';

const FFT_SIZE = 2048;
const NUM_FREQ_SEGMENTS = 128;
/** Segments per chunk: yield and re-render after each chunk. Larger = faster total time, smaller = more responsive UI. */
const FREQ_CHUNK_SIZE = 8;
const MAX_FREQ_HZ = 10000;

export type WaveformFrequencyComputeOptions = {
  /** Called after each chunk so the UI can re-render. */
  onChunkDone?: () => void;
  /** When aborted, computation stops. */
  signal?: AbortSignal;
};

@Injectable()
export class WaveformFrequencyService {
  private frequencyBySegment: (number | undefined)[] = [];
  private normalizationPeak = 1;

  /** Number of frequency segments (used when mapping bar index to segment index). */
  get numFreqSegments(): number {
    return NUM_FREQ_SEGMENTS;
  }

  getFrequencyBySegment(): (number | undefined)[] {
    return this.frequencyBySegment;
  }

  getNormalizationPeak(): number {
    return this.normalizationPeak;
  }

  /** Map frequency (Hz) to HSL hue: low=red, mid=purple, high=blue. */
  frequencyToHue(freqHz: number): number {
    const t = Math.min(1, Math.max(0, freqHz / MAX_FREQ_HZ));
    return Math.round(t * 280) % 360;
  }

  /** Clear state (e.g. when stream URL changes). */
  reset(): void {
    this.frequencyBySegment = [];
    this.normalizationPeak = 1;
  }

  /**
   * Compute dominant frequency per segment via chunked FFT; updates internal state
   * and calls onChunkDone after each chunk for progressive re-rendering.
   */
  async computeFrequencyBySegment(
    buffer: AudioBuffer,
    options: WaveformFrequencyComputeOptions = {}
  ): Promise<void> {
    const { onChunkDone, signal } = options;
    this.frequencyBySegment = new Array(NUM_FREQ_SEGMENTS);
    const sampleRate = buffer.sampleRate;
    const channel = buffer.getChannelData(0);
    const length = channel.length;
    const step = Math.max(1, Math.floor((length - FFT_SIZE) / NUM_FREQ_SEGMENTS));

    this.normalizationPeak = await this.computeNormalizationPeakAsync(channel, signal);

    for (let chunkStart = 0; chunkStart < NUM_FREQ_SEGMENTS; chunkStart += FREQ_CHUNK_SIZE) {
      if (signal?.aborted) break;
      const chunkEnd = Math.min(chunkStart + FREQ_CHUNK_SIZE, NUM_FREQ_SEGMENTS);
      for (let s = chunkStart; s < chunkEnd; s++) {
        const offset = Math.min(s * step, length - FFT_SIZE);
        if (offset < 0) {
          this.frequencyBySegment[s] = 0;
          continue;
        }
        const slice = channel.slice(offset, offset + FFT_SIZE);
        const segmentBuffer = this.audioBufferSlice(slice, sampleRate);
        const freqHz = await this.peakFrequencyFromBuffer(segmentBuffer, sampleRate);
        this.frequencyBySegment[s] = freqHz;
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

  private async computeNormalizationPeakAsync(
    channel: Float32Array,
    signal?: AbortSignal
  ): Promise<number> {
    let maxAbs = 0;
    const length = channel.length;
    const chunkSize = Math.max(4096, Math.floor(length / 64));
    for (let i = 0; i < length; i += chunkSize) {
      if (signal?.aborted) return maxAbs > 0 ? maxAbs : 1;
      const end = Math.min(length, i + chunkSize);
      for (let j = i; j < end; j++) {
        const v = channel[j] ?? 0;
        maxAbs = Math.max(maxAbs, Math.abs(v));
      }
      await this.yieldToMain();
    }
    return maxAbs > 0 ? maxAbs : 1;
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
