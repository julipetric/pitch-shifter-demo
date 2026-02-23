import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import WaveSurfer from 'wavesurfer.js';

const FFT_SIZE = 2048;
const NUM_FREQ_SEGMENTS = 128;
/** Segments per chunk: yield and re-render after each chunk. Larger = faster total time, smaller = more responsive UI. */
const FREQ_CHUNK_SIZE = 8;
const BAR_WIDTH = 2;
const BAR_GAP = 1;
const BAR_RADIUS = 1;
const MAX_FREQ_HZ = 4000;

/** Map frequency (Hz) to HSL hue: low=red, mid=purple, high=blue (like reference image). */
function frequencyToHue(freqHz: number): number {
  const t = Math.min(1, Math.max(0, freqHz / MAX_FREQ_HZ));
  return Math.round(t * 280) % 360;
}

@Component({
  selector: 'app-waveform-snippet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './waveform-snippet.component.html',
  styleUrl: './waveform-snippet.component.css',
})
export class WaveformSnippetComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit {
  @ViewChild('container', { read: ElementRef }) containerRef?: ElementRef<HTMLDivElement>;

  /** Stream URL to load and display (original or processed). No playback – visualization only. */
  @Input() streamUrl: string | null = null;
  /** Playback progress 0–1; updates the waveform progress/cursor to match playback position. */
  @Input() progress = 0;
  /** When true, delay frequency coloring so the waveform renders quickly first. */
  @Input() deferColoring = false;

  private wavesurfer: WaveSurfer | null = null;
  private frequencyBySegment: (number | undefined)[] = [];
  private normalizationPeak = 1;
  private freqComputeAbort = false;
  private pendingFreqCompute = false;
  private freqComputeTimer: number | null = null;
  private freqComputeToken = 0;

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    // Defer until after layout so the container has non-zero dimensions
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.initWaveSurfer());
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    const url = changes['streamUrl']?.currentValue as string | null | undefined;
    if (changes['streamUrl']) {
      this.freqComputeAbort = true;
      this.frequencyBySegment = [];
      this.normalizationPeak = 1;
      this.pendingFreqCompute = true;
      this.freqComputeToken += 1;
      if (this.freqComputeTimer !== null) {
        window.clearTimeout(this.freqComputeTimer);
        this.freqComputeTimer = null;
      }
    }
    if (url && this.wavesurfer) {
      this.wavesurfer.load(url).catch(() => {});
    }
    if (changes['progress'] && this.wavesurfer && this.wavesurfer.getDuration() > 0) {
      const p = Math.max(0, Math.min(1, Number(changes['progress'].currentValue) || 0));
      this.wavesurfer.seekTo(p);
    }
  }

  ngOnDestroy(): void {
    if (this.freqComputeTimer !== null) {
      window.clearTimeout(this.freqComputeTimer);
      this.freqComputeTimer = null;
    }
    this.destroyWaveSurfer();
  }

  private initWaveSurfer(): void {
    const el = this.containerRef?.nativeElement;
    if (!el) return;

    const height = 120;
    el.style.width = '100%';
    el.style.height = `${height}px`;
    el.style.minHeight = `${height}px`;
    el.style.display = 'block';

    const component = this;
    this.wavesurfer = WaveSurfer.create({
      container: el,
      width: '100%',
      height,
      url: this.streamUrl ?? undefined,
      waveColor: '#4a7c9c',
      progressColor: 'rgba(255,255,255,0.35)',
      cursorColor: 'rgba(255,255,255,0.9)',
      cursorWidth: 2,
      barWidth: BAR_WIDTH,
      barGap: BAR_GAP,
      barRadius: BAR_RADIUS,
      normalize: true,
      fillParent: true,
      interact: false,
      autoplay: false,
      renderFunction: (peaks: Array<Float32Array | number[]>, ctx: CanvasRenderingContext2D) => {
        component.renderFrequencyColoredBars(peaks, ctx);
      },
    });

    if (this.streamUrl) {
      this.wavesurfer.load(this.streamUrl).catch(() => {});
    }

    this.wavesurfer.on('ready', () => {
      const p = Math.max(0, Math.min(1, this.progress));
      this.wavesurfer?.seekTo(p);
      if (this.pendingFreqCompute) {
        this.pendingFreqCompute = false;
        this.freqComputeAbort = false;
        const token = this.freqComputeToken;
        if (this.deferColoring) {
          this.scheduleDeferredFrequencyCompute(token);
        } else {
          this.computeFrequencyBySegment();
        }
      }
    });
  }

  private renderFrequencyColoredBars(peaks: Array<Float32Array | number[]>, ctx: CanvasRenderingContext2D): void {
    const channelData = (peaks[0] ?? []) as Float32Array | number[];
    const len = channelData.length;
    if (len === 0) return;

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    const halfHeight = canvasHeight / 2;
    const barSpacing = BAR_WIDTH + BAR_GAP;
    const numBars = Math.floor(canvasWidth / barSpacing) || 1;

    const normalization = this.normalizationPeak > 0 ? this.normalizationPeak : 1;

    const freqSegments = this.frequencyBySegment;

    for (let i = 0; i < numBars; i++) {
      const sampleIndex = Math.floor((i / numBars) * len);
      const value = (channelData[sampleIndex] ?? 0) as number;
      const normalizedValue = Math.max(-1, Math.min(1, value / normalization));
      // Scale to full height so the highest peak occupies 100% of the height.
      const barHeight = Math.max(1, Math.abs(normalizedValue) * canvasHeight);
      const x = i * barSpacing;
      const y = halfHeight - barHeight / 2;

      const segIndex = Math.min(Math.floor((i / numBars) * NUM_FREQ_SEGMENTS), NUM_FREQ_SEGMENTS - 1);
      const freqHz = freqSegments[segIndex];
      if (freqHz !== undefined && Number.isFinite(freqHz)) {
        const hue = frequencyToHue(freqHz);
        ctx.fillStyle = `hsla(${hue}, 75%, 58%, 0.92)`;
      } else {
        ctx.fillStyle = 'hsl(210, 45%, 55%)';
      }

      if (BAR_RADIUS && typeof (ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect === 'function') {
        ctx.beginPath();
        (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
          .roundRect(x, y, BAR_WIDTH, barHeight, BAR_RADIUS);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, BAR_WIDTH, barHeight);
      }
    }
  }

  private async computeFrequencyBySegment(): Promise<void> {
    const buffer = this.wavesurfer?.getDecodedData() ?? null;
    if (!buffer) return;

    this.freqComputeAbort = false;
    this.frequencyBySegment = new Array(NUM_FREQ_SEGMENTS);
    const sampleRate = buffer.sampleRate;
    const channel = buffer.getChannelData(0);
    const length = channel.length;
    const step = Math.max(1, Math.floor((length - FFT_SIZE) / NUM_FREQ_SEGMENTS));
    this.normalizationPeak = await this.computeNormalizationPeakAsync(channel);

    for (let chunkStart = 0; chunkStart < NUM_FREQ_SEGMENTS && !this.freqComputeAbort; chunkStart += FREQ_CHUNK_SIZE) {
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
        this.wavesurfer?.getRenderer().reRender();
      } catch {
        break;
      }
    }
  }

  /** Yield to main thread so UI can update and stay responsive during long frequency computation. */
  private yieldToMain(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  private scheduleDeferredFrequencyCompute(token: number): void {
    this.freqComputeTimer = window.setTimeout(() => {
      this.freqComputeTimer = null;
      if (this.freqComputeAbort || token !== this.freqComputeToken) return;
      this.computeFrequencyBySegment();
    }, 400);
  }

  private audioBufferSlice(samples: Float32Array, sampleRate: number): AudioBuffer {
    const ctx = new OfflineAudioContext(1, samples.length, sampleRate);
    const buf = ctx.createBuffer(1, samples.length, sampleRate);
    buf.getChannelData(0).set(samples);
    return buf;
  }

  private async computeNormalizationPeakAsync(channel: Float32Array): Promise<number> {
    let maxAbs = 0;
    const length = channel.length;
    const chunkSize = Math.max(4096, Math.floor(length / 64));
    for (let i = 0; i < length; i += chunkSize) {
      const end = Math.min(length, i + chunkSize);
      for (let j = i; j < end; j++) {
        const v = channel[j] ?? 0;
        maxAbs = Math.max(maxAbs, Math.abs(v));
      }
      if (this.freqComputeAbort) {
        return maxAbs > 0 ? maxAbs : 1;
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

  private destroyWaveSurfer(): void {
    if (this.wavesurfer) {
      this.wavesurfer.destroy();
      this.wavesurfer = null;
    }
  }
}
