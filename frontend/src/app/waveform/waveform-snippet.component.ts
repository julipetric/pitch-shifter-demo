import {
  ChangeDetectionStrategy,
  Component,
  ChangeDetectorRef,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import WaveSurfer from 'wavesurfer.js';
import { WaveformFrequencyService } from './waveform-frequency.service';

const BAR_WIDTH = 2;
const BAR_GAP = 1;
const BAR_RADIUS = 1;

@Component({
  selector: 'app-waveform-snippet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './waveform-snippet.component.html',
  styleUrl: './waveform-snippet.component.css',
  providers: [WaveformFrequencyService],
})
export class WaveformSnippetComponent implements OnChanges, OnDestroy, AfterViewInit {
  @ViewChild('container', { read: ElementRef }) containerRef?: ElementRef<HTMLDivElement>;

  /** Stream URL to load and display (original or processed). No playback – visualization only. */
  @Input() streamUrl: string | null = null;
  /** Playback progress 0–1; updates the waveform progress/cursor to match playback position. */
  @Input() progress = 0;
  /** When true, delay frequency coloring so the waveform renders quickly first. */
  @Input() deferColoring = false;

  private wavesurfer: WaveSurfer | null = null;
  private freqAbortController: AbortController | null = null;
  private pendingFreqCompute = false;
  private freqComputeTimer: number | null = null;
  private freqComputeToken = 0;
  isLoading = true;
  isAnalyzing = false;

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly freqService: WaveformFrequencyService
  ) {}

  ngAfterViewInit(): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.initWaveSurfer());
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    const url = changes['streamUrl']?.currentValue as string | null | undefined;
    if (changes['streamUrl']) {
      this.freqAbortController?.abort();
      this.freqService.reset();
      this.pendingFreqCompute = true;
      this.freqComputeToken += 1;
      this.isLoading = true;
      this.isAnalyzing = false;
      this.cdr.markForCheck();
      if (this.freqComputeTimer !== null) {
        window.clearTimeout(this.freqComputeTimer);
        this.freqComputeTimer = null;
      }
    }
    if (url && this.wavesurfer) {
      this.wavesurfer.load(url).catch(() => {});
    }
    if (changes['progress'] && this.wavesurfer && this.wavesurfer.getDuration() > 0) {
      const p = Math.max(0, Math.min(1, Number(changes['progress'].currentValue) ?? 0));
      this.wavesurfer.seekTo(p);
    }
  }

  ngOnDestroy(): void {
    if (this.freqComputeTimer !== null) {
      window.clearTimeout(this.freqComputeTimer);
      this.freqComputeTimer = null;
    }
    this.freqAbortController?.abort();
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
      this.isLoading = false;
      this.cdr.markForCheck();
      if (this.pendingFreqCompute) {
        this.pendingFreqCompute = false;
        this.freqAbortController = new AbortController();
        const token = this.freqComputeToken;
        if (this.deferColoring) {
          this.isAnalyzing = true;
          this.cdr.markForCheck();
          this.scheduleDeferredFrequencyCompute(token);
        } else {
          this.runFrequencyCompute();
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

    const normalization = this.freqService.getNormalizationPeak() || 1;
    const freqSegments = this.freqService.getFrequencyBySegment();
    const numFreqSegments = this.freqService.numFreqSegments;

    for (let i = 0; i < numBars; i++) {
      const sampleIndex = Math.floor((i / numBars) * len);
      const value = (channelData[sampleIndex] ?? 0) as number;
      const normalizedValue = Math.max(-1, Math.min(1, value / normalization));
      const barHeight = Math.max(1, Math.abs(normalizedValue) * canvasHeight);
      const x = i * barSpacing;
      const y = halfHeight - barHeight / 2;

      const segIndex = Math.min(Math.floor((i / numBars) * numFreqSegments), numFreqSegments - 1);
      const freqHz = freqSegments[segIndex];
      if (freqHz !== undefined && Number.isFinite(freqHz)) {
        const hue = this.freqService.frequencyToHue(freqHz);
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

  private async runFrequencyCompute(): Promise<void> {
    const buffer = this.wavesurfer?.getDecodedData() ?? null;
    if (!buffer || !this.freqAbortController) return;

    this.isAnalyzing = true;
    this.cdr.markForCheck();

    await this.freqService.computeFrequencyBySegment(buffer, {
      signal: this.freqAbortController.signal,
      onChunkDone: () => {
        try {
          this.wavesurfer?.getRenderer().reRender();
        } catch {
          // ignore
        }
      },
    });

    if (!this.freqAbortController.signal.aborted) {
      this.isAnalyzing = false;
      this.cdr.markForCheck();
    }
  }

  private scheduleDeferredFrequencyCompute(token: number): void {
    this.freqComputeTimer = window.setTimeout(() => {
      this.freqComputeTimer = null;
      if (this.freqAbortController?.signal.aborted || token !== this.freqComputeToken) return;
      this.runFrequencyCompute();
    }, 400);
  }

  private destroyWaveSurfer(): void {
    if (this.wavesurfer) {
      this.wavesurfer.destroy();
      this.wavesurfer = null;
    }
  }
}
