import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  NgZone,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import WaveSurfer from 'wavesurfer.js';
import { FormatTimePipe } from '../pipes/format-time.pipe';
import { frequencyToSpectralPosition, spectralColor } from '../visual/spectral-palette';
import { WaveformFrequencyService } from './waveform-frequency.service';

/** Bar width and gap in CSS pixels; the canvas draws them in whole device pixels. */
const BAR_WIDTH_PX = 2;
const BAR_GAP_PX = 1;
/** Height of the shortest bar in CSS pixels, so silence still shows as a dotted centre line. */
const MIN_BAR_HEIGHT_PX = 2;
/** Share of the lane height the loudest bar fills, leaving room above and below its tips. */
const BAR_SPAN = 0.88;
/** Colour of the bars whose segment is not analysed yet: the `--c-line-strong` token. */
const UNANALYSED_BAR_COLOR = '#3b3b4d';
/** Opacity down the lane, applied once over all the bars: full at the core, softer at the tips. */
const FADE_STOPS: ReadonlyArray<readonly [offset: number, color: string]> = [
  [0, 'rgb(0 0 0 / 0.5)'],
  [0.35, 'rgb(0 0 0 / 1)'],
  [0.65, 'rgb(0 0 0 / 1)'],
  [1, 'rgb(0 0 0 / 0.5)'],
];
/**
 * Sample rate WaveSurfer decodes at. The bars and the frequency analysis both read this
 * buffer: its 4 kHz limit lies above the dominant frequencies of music, and 2048-sample FFT
 * windows resolve 3.9 Hz, fine enough to tell bass notes apart.
 */
const DECODE_SAMPLE_RATE = 8000;
/** Delay before the frequency analysis starts when colouring is deferred. */
const DEFERRED_COLORING_DELAY_MS = 400;
/** Pointer travel in CSS pixels between press and click beyond which the click is a drag. */
const CLICK_SLOP_PX = 4;
/** Distance in CSS pixels the hover time keeps from the ends of the lane. */
const HOVER_TIME_INSET_PX = 4;

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * One whole track as mirrored amplitude bars, each coloured on the spectral scale by the
 * dominant frequency of its time segment. WaveSurfer only fetches and decodes the track and
 * hands its peaks to the renderer here; its own cursor, progress layer and interaction stay off.
 *
 * The playback position arrives as the inherited CSS custom property `--wf-progress` (0 to 1).
 * It moves a shade over the part not played yet, whose left edge is the playhead, by transform
 * alone, so the parent can update it every frame without change detection. Clicking emits
 * `seek` with the fraction of the track under the pointer, and hovering shows the time there.
 * The lane is not focusable: the transport's seek slider is the keyboard path.
 */
@Component({
  selector: 'app-waveform-view',
  templateUrl: './waveform-view.component.html',
  styleUrl: './waveform-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [WaveformFrequencyService],
})
export class WaveformViewComponent {
  /** Stream URL of the whole track; `null` leaves the lane empty. Another URL reloads the view. */
  readonly src = input.required<string | null>();
  /** Duration (s) of this view's timeline, for the time shown under the pointer. */
  readonly durationSeconds = input.required<number>();
  /** Shows the bars first and starts colouring them by frequency shortly after. */
  readonly deferColoring = input(false);
  /** Accessible description of the waveform. */
  readonly ariaLabel = input.required<string>();
  /** Text shown while the track is fetched and decoded. */
  readonly loadingLabel = input('Decoding audio…');

  /** Fraction of the track (0 to 1) where the user clicked. */
  readonly seek = output<number>();

  protected readonly state = signal<LoadState>('idle');
  /** True while the frequency analysis of the loaded track runs. */
  protected readonly analysing = signal(false);
  protected readonly ready = computed(() => this.state() === 'ready');

  private readonly lane = viewChild.required<ElementRef<HTMLElement>>('lane');
  private readonly wave = viewChild.required<ElementRef<HTMLElement>>('wave');
  private readonly hover = viewChild.required<ElementRef<HTMLElement>>('hover');
  private readonly hoverLine = viewChild.required<ElementRef<HTMLElement>>('hoverLine');
  private readonly hoverTime = viewChild.required<ElementRef<HTMLElement>>('hoverTime');

  private readonly freqService = inject(WaveformFrequencyService);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formatTime = new FormatTimePipe();

  private source: string | null = null;
  private viewReady = false;
  private wavesurfer: WaveSurfer | null = null;

  private freqAbortController: AbortController | null = null;
  private pendingFreqCompute = false;
  private freqComputeTimer: number | null = null;
  private freqComputeToken = 0;

  /** Peak of every bar of the last draw, scaled so the loudest bar is 1. */
  private barPeaks = new Float32Array(0);
  private barCount = 0;
  private barWidth = 0;
  private barPitch = 0;
  private barOffset = 0;
  /** The canvas WaveSurfer drew on last; every analysed chunk repaints it in place. */
  private canvasContext: CanvasRenderingContext2D | null = null;

  private resizeObserver: ResizeObserver | null = null;
  private laneHeight = -1;
  private reRenderFrame: number | null = null;

  /** Where the primary button went down, to tell a click from a drag. */
  private pressAt: { x: number; y: number } | null = null;
  private hoverText = '';
  private hoverTimeWidth = 0;
  /** Length of the text `hoverTimeWidth` was measured for; 0 when it needs measuring. */
  private hoverTimeChars = 0;
  private removePointerListeners: (() => void) | null = null;

  constructor() {
    effect(() => {
      const url = this.src();
      untracked(() => this.setSource(url));
    });
    afterNextRender(() => {
      this.viewReady = true;
      this.zone.runOutsideAngular(() => {
        this.listenToPointer();
        this.observeLaneHeight();
        this.createWaveSurfer();
      });
    });
    this.destroyRef.onDestroy(() => this.tearDown());
  }

  protected onClick(event: MouseEvent): void {
    const press = this.pressAt;
    this.pressAt = null;
    if (event.button !== 0 || this.state() !== 'ready') return;
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > CLICK_SLOP_PX) return;
    const rect = this.lane().nativeElement.getBoundingClientRect();
    if (rect.width <= 0) return;
    this.seek.emit(clamp((event.clientX - rect.left) / rect.width, 0, 1));
  }

  /**
   * Switches the view to `url`. The analysis of the previous track is cancelled: its abort
   * controller is aborted, a deferred start is cleared, and the token moves on, so a deferred
   * start scheduled for the previous track never runs. The next track is analysed once, when
   * it is ready.
   */
  private setSource(url: string | null): void {
    this.source = url;
    this.freqAbortController?.abort();
    this.freqService.reset();
    this.pendingFreqCompute = true;
    this.freqComputeToken += 1;
    this.clearFreqComputeTimer();
    this.analysing.set(false);
    this.state.set(url ? 'loading' : 'idle');
    this.hideHover();
    if (this.viewReady) this.zone.runOutsideAngular(() => this.createWaveSurfer());
  }

  /**
   * Replaces the WaveSurfer instance with one for the current source. Each track gets its own
   * instance, so a decode of the previous track that finishes late cannot draw over the next.
   */
  private createWaveSurfer(): void {
    this.destroyWaveSurfer();
    const url = this.source;
    if (!url) return;
    const wavesurfer = WaveSurfer.create({
      container: this.wave().nativeElement,
      height: 'auto',
      sampleRate: DECODE_SAMPLE_RATE,
      waveColor: UNANALYSED_BAR_COLOR,
      progressColor: 'transparent',
      cursorColor: 'transparent',
      cursorWidth: 0,
      interact: false,
      dragToSeek: false,
      autoScroll: false,
      autoCenter: false,
      hideScrollbar: true,
      renderFunction: (peaks, ctx) => {
        if (wavesurfer === this.wavesurfer) this.draw(peaks, ctx);
      },
    });
    this.wavesurfer = wavesurfer;
    // A media error before the metadata arrives leaves `load` pending, so the event ends it too.
    wavesurfer.on('error', () => this.failLoading(wavesurfer));
    wavesurfer.load(url).then(
      () => this.finishLoading(wavesurfer),
      () => this.failLoading(wavesurfer),
    );
  }

  private finishLoading(wavesurfer: WaveSurfer): void {
    if (wavesurfer !== this.wavesurfer) return;
    this.state.set('ready');
    if (!this.pendingFreqCompute) return;
    this.pendingFreqCompute = false;
    this.freqAbortController = new AbortController();
    const token = this.freqComputeToken;
    if (this.deferColoring()) {
      this.analysing.set(true);
      this.scheduleDeferredFrequencyCompute(token);
    } else {
      void this.runFrequencyCompute();
    }
  }

  private failLoading(wavesurfer: WaveSurfer): void {
    if (wavesurfer !== this.wavesurfer || this.state() !== 'loading') return;
    this.state.set('error');
  }

  private async runFrequencyCompute(): Promise<void> {
    const controller = this.freqAbortController;
    if (!controller || controller.signal.aborted) return;
    const buffer = this.wavesurfer?.getDecodedData() ?? null;
    if (!buffer) {
      this.analysing.set(false);
      return;
    }
    this.analysing.set(true);
    try {
      await this.freqService.computeFrequencyBySegment(buffer, {
        signal: controller.signal,
        onChunkDone: () => this.repaint(),
      });
    } catch {
      // The segments left unanalysed keep the neutral colour; the waveform stays usable.
    } finally {
      if (!controller.signal.aborted) this.analysing.set(false);
    }
  }

  private scheduleDeferredFrequencyCompute(token: number): void {
    this.freqComputeTimer = window.setTimeout(() => {
      this.freqComputeTimer = null;
      if (this.freqAbortController?.signal.aborted || token !== this.freqComputeToken) return;
      void this.runFrequencyCompute();
    }, DEFERRED_COLORING_DELAY_MS);
  }

  private clearFreqComputeTimer(): void {
    if (this.freqComputeTimer === null) return;
    window.clearTimeout(this.freqComputeTimer);
    this.freqComputeTimer = null;
  }

  /** WaveSurfer's render callback: lays out the bars for its canvas and paints them. */
  private draw(channels: Array<Float32Array | number[]>, ctx: CanvasRenderingContext2D): void {
    this.measureBars(channels, ctx.canvas.width);
    this.canvasContext = ctx;
    this.paint(ctx);
  }

  /**
   * Lays out bars across `width` device pixels and keeps the peak of each, scaled so the
   * loudest bar is 1: the highest peak of the track spans the full bar height. The bars are
   * mirrored, so each takes the louder of the two channels. WaveSurfer draws a waveform up to
   * 8000 CSS pixels wide on a single canvas, so the canvas always holds the whole track.
   */
  private measureBars(channels: Array<Float32Array | number[]>, width: number): void {
    const ratio = pixelRatio();
    const barWidth = Math.max(1, Math.round(BAR_WIDTH_PX * ratio));
    const gap = Math.max(1, Math.round(BAR_GAP_PX * ratio));
    const pitch = barWidth + gap;
    const count = Math.max(0, Math.floor((width + gap) / pitch));
    const left = channels[0] ?? [];
    const right = channels[1] ?? left;
    const length = left.length;
    if (this.barPeaks.length !== count) this.barPeaks = new Float32Array(count);
    const peaks = this.barPeaks;

    let loudest = 0;
    for (let i = 0; i < count; i++) {
      const start = Math.floor((i * length) / count);
      const end = Math.min(length, Math.max(start + 1, Math.floor(((i + 1) * length) / count)));
      let peak = 0;
      for (let j = start; j < end; j++) {
        const sample = Math.max(Math.abs(left[j]), Math.abs(right[j]));
        if (sample > peak) peak = sample;
      }
      peaks[i] = peak;
      if (peak > loudest) loudest = peak;
    }
    if (loudest > 0) {
      for (let i = 0; i < count; i++) peaks[i] /= loudest;
    }

    this.barCount = count;
    this.barWidth = barWidth;
    this.barPitch = pitch;
    // The width left over by whole bars splits evenly between both ends.
    this.barOffset = count > 0 ? Math.floor((width - (count * pitch - gap)) / 2) : 0;
  }

  /**
   * Paints the measured bars, each in the colour of its segment as analysed so far, then
   * softens their tips with one `destination-in` pass. Bars of one colour share a single fill.
   */
  private paint(ctx: CanvasRenderingContext2D): void {
    const { width, height } = ctx.canvas;
    ctx.clearRect(0, 0, width, height);
    const count = this.barCount;
    if (count === 0 || height === 0) return;

    const peaks = this.barPeaks;
    const barWidth = this.barWidth;
    const pitch = this.barPitch;
    const offset = this.barOffset;
    const centre = height / 2;
    const span = height * BAR_SPAN;
    const minHeight = Math.min(span, Math.max(1, Math.round(MIN_BAR_HEIGHT_PX * pixelRatio())));
    const radius = barWidth / 2;
    const rounded = typeof ctx.roundRect === 'function';
    const frequencies = this.freqService.getFrequencyBySegment();
    const segments = this.freqService.numFreqSegments;

    let color = '';
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const hz = frequencies[Math.min(segments - 1, Math.floor((i * segments) / count))];
      const barColor =
        hz !== undefined && Number.isFinite(hz)
          ? spectralColor(frequencyToSpectralPosition(hz))
          : UNANALYSED_BAR_COLOR;
      if (barColor !== color) {
        if (color) {
          ctx.fillStyle = color;
          ctx.fill();
          ctx.beginPath();
        }
        color = barColor;
      }
      const barHeight = Math.max(minHeight, peaks[i] * span);
      const x = offset + i * pitch;
      const y = centre - barHeight / 2;
      if (rounded) ctx.roundRect(x, y, barWidth, barHeight, radius);
      else ctx.rect(x, y, barWidth, barHeight);
    }
    ctx.fillStyle = color;
    ctx.fill();

    const fade = ctx.createLinearGradient(0, 0, 0, height);
    for (const [stop, stopColor] of FADE_STOPS) fade.addColorStop(stop, stopColor);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Repaints the current canvas with the colours analysed so far. */
  private repaint(): void {
    const ctx = this.canvasContext;
    if (ctx?.canvas.isConnected) this.paint(ctx);
  }

  /**
   * WaveSurfer redraws on width changes by itself, but with `height: 'auto'` it reads the
   * container height only when it draws, so a change of `--wf-height` triggers a redraw here.
   */
  private observeLaneHeight(): void {
    if (typeof ResizeObserver !== 'function') return;
    const wave = this.wave().nativeElement;
    this.resizeObserver = new ResizeObserver(() => {
      const height = wave.clientHeight;
      if (height === this.laneHeight) return;
      this.laneHeight = height;
      this.scheduleReRender();
    });
    this.resizeObserver.observe(wave);
  }

  private scheduleReRender(): void {
    if (this.reRenderFrame !== null) return;
    this.reRenderFrame = requestAnimationFrame(() => {
      this.reRenderFrame = null;
      this.wavesurfer?.getRenderer().reRender();
    });
  }

  /**
   * Pointer moves arrive several times a frame. They place the hover line and time directly,
   * outside the Angular zone, so hovering never runs change detection; clicks go through the
   * template, inside the zone, so the parent's `seek` handler runs change detection as usual.
   */
  private listenToPointer(): void {
    const lane = this.lane().nativeElement;
    const onPointerDown = (event: PointerEvent) => {
      this.pressAt = event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
    };
    const onPointerMove = (event: PointerEvent) => this.trackHover(event);
    const onPointerLeave = () => this.hideHover();
    lane.addEventListener('pointerdown', onPointerDown);
    lane.addEventListener('pointermove', onPointerMove);
    lane.addEventListener('pointerleave', onPointerLeave);
    this.removePointerListeners = () => {
      lane.removeEventListener('pointerdown', onPointerDown);
      lane.removeEventListener('pointermove', onPointerMove);
      lane.removeEventListener('pointerleave', onPointerLeave);
    };
  }

  /** Shows the hover line under a mouse or pen and the time there, kept inside the lane. */
  private trackHover(event: PointerEvent): void {
    if (event.pointerType === 'touch' || this.state() !== 'ready') {
      this.hideHover();
      return;
    }
    const rect = this.lane().nativeElement.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = clamp(event.clientX - rect.left, 0, rect.width);
    const label = this.hoverTime().nativeElement;
    const text = this.formatTime.transform((x / rect.width) * this.timelineSeconds());
    if (text !== this.hoverText) {
      label.textContent = text;
      this.hoverText = text;
    }
    // The time is set in fixed-width digits, so its width changes only with its length.
    if (text.length !== this.hoverTimeChars) {
      this.hoverTimeWidth = label.offsetWidth;
      this.hoverTimeChars = text.length;
    }
    const labelLeft = clamp(
      x - this.hoverTimeWidth / 2,
      HOVER_TIME_INSET_PX,
      rect.width - this.hoverTimeWidth - HOVER_TIME_INSET_PX,
    );
    this.hoverLine().nativeElement.style.transform = `translateX(${x}px)`;
    label.style.transform = `translateX(${labelLeft}px)`;
    this.hover().nativeElement.classList.add('hover--visible');
  }

  private hideHover(): void {
    if (!this.viewReady) return;
    // Measured again on the next hover, in case the display font has loaded since.
    this.hoverTimeChars = 0;
    this.hover().nativeElement.classList.remove('hover--visible');
  }

  /** Duration of the timeline: the input, or the decoded duration while the input is unknown. */
  private timelineSeconds(): number {
    const seconds = this.durationSeconds();
    if (Number.isFinite(seconds) && seconds > 0) return seconds;
    return this.wavesurfer?.getDuration() ?? 0;
  }

  private tearDown(): void {
    this.clearFreqComputeTimer();
    this.freqAbortController?.abort();
    this.freqAbortController = null;
    this.destroyWaveSurfer();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.reRenderFrame !== null) {
      cancelAnimationFrame(this.reRenderFrame);
      this.reRenderFrame = null;
    }
    this.removePointerListeners?.();
    this.removePointerListeners = null;
  }

  private destroyWaveSurfer(): void {
    const wavesurfer = this.wavesurfer;
    if (!wavesurfer) return;
    this.wavesurfer = null;
    this.canvasContext = null;
    this.barCount = 0;
    wavesurfer.destroy();
    wavesurfer.unAll();
  }
}

/** Device pixels per CSS pixel, as WaveSurfer sizes its canvases. */
function pixelRatio(): number {
  return Math.max(1, window.devicePixelRatio || 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
