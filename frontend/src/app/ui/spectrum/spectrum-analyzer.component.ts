import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  NgZone,
  viewChild,
} from '@angular/core';
import {
  frequencyToSpectralPosition,
  spectralColor,
  spectralPositionToFrequency,
} from '../../visual/spectral-palette';

/** Bars across the spectral scale, each covering about 1.9 semitones. */
const BAR_COUNT = 48;
/** Height of a bar at rest, as a share of the full height: enough to show its colour. */
export const SPECTRUM_REST_HEIGHT = 0.16;
/** Gap between bars, as a share of the distance from one bar to the next. */
const GAP_RATIO = 0.25;
/** Radius of the rounded bar tops, in CSS pixels. */
const BAR_RADIUS_PX = 2;
/** Thickness of a peak cap, and its distance above the bar it rests on, in CSS pixels. */
const CAP_THICKNESS_PX = 1.5;
const CAP_OFFSET_PX = 1;
/** Bar ballistics: exponential time constants (s) for rising and for falling. */
const ATTACK_S = 0.025;
const RELEASE_S = 0.2;
/** Peak caps hold for this long (s), then fall with this acceleration (full heights per s²). */
const PEAK_HOLD_S = 0.6;
const PEAK_GRAVITY = 4;
/** Caps fade out below this level, so they do not linger on bars at rest. */
const CAP_FADE_LEVEL = 0.05;
/** Level below which a bar or a cap counts as back at rest. */
const SETTLED_LEVEL = 0.002;
/** Longest step (s) the ballistics take in one frame, so the bars glide on after a stall. */
const MAX_STEP_S = 0.1;
/** With reduced motion the bars redraw at about 15 fps; the slack absorbs frame jitter. */
const REDUCED_MOTION_FRAME_MS = 1000 / 15;
const FRAME_SLACK_MS = 4;

/** Colour of each bar: the spectral colour at the centre of its band. */
const BAR_COLORS: readonly string[] = Array.from({ length: BAR_COUNT }, (_, i) =>
  spectralColor((i + 0.5) / BAR_COUNT),
);

interface AxisLabel {
  readonly text: string;
  /** Position of the frequency on the scale, in percent of the width. */
  readonly left: number;
  /** Which part of the label sits on its position; the outermost labels keep inside the box. */
  readonly anchor: 'start' | 'middle' | 'end';
}

const AXIS_LABELS: readonly AxisLabel[] = [
  axisLabel(100, '100 Hz'),
  axisLabel(1_000, '1 kHz'),
  axisLabel(10_000, '10 kHz'),
];

/** Bar placement in device pixels, recomputed when the canvas resizes. */
interface Geometry {
  readonly width: number;
  readonly height: number;
  /** Left edge of each bar, on whole pixels so every edge is crisp. */
  readonly barX: Float32Array;
  readonly barWidth: number;
  /** Corner radii of a bar: rounded at the top, square at the base. */
  readonly radii: number[];
  readonly capThickness: number;
  readonly capOffset: number;
  /** Height a full bar reaches, leaving room for its cap above it. */
  readonly span: number;
}

/** The FFT bins behind each bar, for one analyser's sample rate and FFT size. */
interface Bands {
  readonly analyser: AnalyserNode;
  readonly binCount: number;
  /**
   * Inclusive range of the bins whose centres fall inside each band; empty (last < first) for a
   * band narrower than one bin.
   */
  readonly first: Int16Array;
  readonly last: Int16Array;
  /** Where each band centre falls between bins: the bin below it, and how far towards the next. */
  readonly below: Int16Array;
  readonly fraction: Float32Array;
}

/**
 * A compact live spectrum that doubles as the colour legend of the waveforms: bars spaced
 * logarithmically from 50 Hz to 10 kHz, each in the spectral colour of its band.
 *
 * Without an analyser, or once `active` turns false and the bars have settled, it shows low
 * bars in their colours and stops its frame loop. Frames run outside the Angular zone, so the
 * animation never triggers change detection. With reduced motion the levels stay live, since
 * they carry information, but the peak caps go and the redraw rate drops to about 15 fps.
 */
@Component({
  selector: 'app-spectrum-analyzer',
  templateUrl: './spectrum-analyzer.component.html',
  styleUrl: './spectrum-analyzer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpectrumAnalyzerComponent {
  /** Analyser to read the spectrum from; without one the bars stay at rest. */
  readonly analyser = input<AnalyserNode | null>(null);
  /** True while the track plays; when it turns false the bars fall back to rest. */
  readonly active = input(false);

  protected readonly axisLabels = AXIS_LABELS;

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  private ctx: CanvasRenderingContext2D | null = null;
  private geometry: Geometry | null = null;
  private bands: Bands | null = null;
  private bins = new Uint8Array(0);
  private readonly targets = new Float32Array(BAR_COUNT);
  private readonly levels = new Float32Array(BAR_COUNT);
  private readonly peaks = new Float32Array(BAR_COUNT);
  private readonly peakHolds = new Float32Array(BAR_COUNT);
  private readonly peakSpeeds = new Float32Array(BAR_COUNT);
  private reducedMotion = false;
  private frameId = 0;
  private lastFrameAt: number | null = null;

  constructor() {
    // A change of either input wakes the loop, which reads both on every frame.
    effect(() => {
      this.analyser();
      this.active();
      this.zone.runOutsideAngular(() => this.wake());
    });
    afterNextRender(() => this.zone.runOutsideAngular(() => this.setUp()));
    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
      this.ctx = null;
    });
  }

  private setUp(): void {
    const canvas = this.canvas().nativeElement;
    this.ctx = canvas.getContext('2d');

    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionChange = (event: MediaQueryListEvent) => {
      this.reducedMotion = event.matches;
      this.draw();
    };
    this.reducedMotion = motion.matches;
    motion.addEventListener('change', onMotionChange);

    const resizer = new ResizeObserver((entries) => this.resize(canvas, entries[entries.length - 1]));
    try {
      // Exact device pixels keep the bars crisp at fractional pixel ratios and zoom levels.
      // Browsers that cannot report them throw here and size from CSS pixels instead.
      resizer.observe(canvas, { box: 'device-pixel-content-box' });
    } catch {
      resizer.observe(canvas);
    }

    this.destroyRef.onDestroy(() => {
      resizer.disconnect();
      motion.removeEventListener('change', onMotionChange);
    });
  }

  private resize(canvas: HTMLCanvasElement, entry: ResizeObserverEntry): void {
    const ratio = window.devicePixelRatio || 1;
    const exact = entry.devicePixelContentBoxSize?.[0];
    const width = exact?.inlineSize ?? Math.round(entry.contentRect.width * ratio);
    const height = exact?.blockSize ?? Math.round(entry.contentRect.height * ratio);
    // Assigning a size clears the bitmap even when it is unchanged.
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    this.geometry = width > 0 && height > 0 ? layOut(width, height, ratio) : null;
    this.draw();
    this.wake();
  }

  /** Starts the frame loop unless it is running already or there is nothing to animate. */
  private wake(): void {
    if (this.frameId !== 0 || !this.ctx || !this.geometry) return;
    if (!this.isLive() && this.isAtRest()) return;
    this.lastFrameAt = null;
    this.frameId = requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number): void => {
    this.frameId = 0;
    if (!this.ctx || !this.geometry) return;
    const previous = this.lastFrameAt;
    if (this.reducedMotion && previous !== null && now - previous < REDUCED_MOTION_FRAME_MS - FRAME_SLACK_MS) {
      this.frameId = requestAnimationFrame(this.frame);
      return;
    }
    const step = previous === null ? 0 : Math.min(MAX_STEP_S, (now - previous) / 1000);
    this.lastFrameAt = now;

    const live = this.readTargets();
    this.advance(step);
    const animating = live || !this.isAtRest();
    if (!animating) {
      this.levels.fill(0);
      this.peaks.fill(0);
    }
    this.draw();

    if (animating) {
      this.frameId = requestAnimationFrame(this.frame);
    } else {
      this.lastFrameAt = null;
    }
  };

  private isLive(): boolean {
    return this.analyser() !== null && this.active();
  }

  /** Fills `targets` with each band's magnitude (0 to 1); returns false, all at 0, when nothing plays. */
  private readTargets(): boolean {
    const analyser = this.analyser();
    if (!analyser || !this.active()) {
      this.targets.fill(0);
      return false;
    }
    const bands = this.bandsFor(analyser);
    const bins = this.bins;
    analyser.getByteFrequencyData(bins);
    for (let i = 0; i < BAR_COUNT; i++) {
      const first = bands.first[i];
      const last = bands.last[i];
      let magnitude = 0;
      if (first <= last) {
        for (let bin = first; bin <= last; bin++) {
          if (bins[bin] > magnitude) magnitude = bins[bin];
        }
      } else {
        const below = bands.below[i];
        magnitude = bins[below] + (bins[below + 1] - bins[below]) * bands.fraction[i];
      }
      this.targets[i] = magnitude / 255;
    }
    return true;
  }

  private bandsFor(analyser: AnalyserNode): Bands {
    let bands = this.bands;
    if (!bands || bands.analyser !== analyser || bands.binCount !== analyser.frequencyBinCount) {
      bands = this.bands = mapBands(analyser);
      this.bins = new Uint8Array(bands.binCount);
    }
    return bands;
  }

  /**
   * Moves the bars towards their targets, `step` seconds on. A peak cap rises with its bar,
   * holds, then falls with constant acceleration until it lands on the bar.
   */
  private advance(step: number): void {
    const attack = 1 - Math.exp(-step / ATTACK_S);
    const release = 1 - Math.exp(-step / RELEASE_S);
    const caps = !this.reducedMotion;
    for (let i = 0; i < BAR_COUNT; i++) {
      const target = this.targets[i];
      let level = this.levels[i];
      level += (target - level) * (target > level ? attack : release);
      this.levels[i] = level;

      if (!caps || level >= this.peaks[i]) {
        this.peaks[i] = level;
        this.peakHolds[i] = PEAK_HOLD_S;
        this.peakSpeeds[i] = 0;
      } else if (this.peakHolds[i] > 0) {
        this.peakHolds[i] -= step;
      } else {
        this.peakSpeeds[i] += PEAK_GRAVITY * step;
        this.peaks[i] = Math.max(level, this.peaks[i] - this.peakSpeeds[i] * step);
      }
    }
  }

  private isAtRest(): boolean {
    for (let i = 0; i < BAR_COUNT; i++) {
      if (this.levels[i] > SETTLED_LEVEL || this.peaks[i] > SETTLED_LEVEL) return false;
    }
    return true;
  }

  private draw(): void {
    const ctx = this.ctx;
    const g = this.geometry;
    if (!ctx || !g) return;
    ctx.clearRect(0, 0, g.width, g.height);
    const caps = !this.reducedMotion;
    for (let i = 0; i < BAR_COUNT; i++) {
      const x = g.barX[i];
      const barHeight = Math.max(1, Math.round(g.span * heightOf(this.levels[i])));
      ctx.fillStyle = BAR_COLORS[i];
      ctx.beginPath();
      ctx.roundRect(x, g.height - barHeight, g.barWidth, barHeight, g.radii);
      ctx.fill();

      const peak = this.peaks[i];
      if (caps && peak > SETTLED_LEVEL) {
        const capBottom = g.height - Math.round(g.span * heightOf(peak)) - g.capOffset;
        ctx.globalAlpha = Math.min(1, peak / CAP_FADE_LEVEL);
        ctx.fillRect(x, capBottom - g.capThickness, g.barWidth, g.capThickness);
        ctx.globalAlpha = 1;
      }
    }
  }
}

/** Share of the span a bar fills at `level`: never below the rest height, so the legend stays. */
function heightOf(level: number): number {
  return SPECTRUM_REST_HEIGHT + (1 - SPECTRUM_REST_HEIGHT) * level;
}

function axisLabel(hz: number, text: string): AxisLabel {
  const position = frequencyToSpectralPosition(hz);
  const anchor = position < 0.1 ? 'start' : position > 0.9 ? 'end' : 'middle';
  return { text, left: position * 100, anchor };
}

/**
 * Spreads the bars over the full width. Every bar gets the same whole-pixel width; the gaps
 * absorb the remainder, so neither edge of the strip is left empty.
 */
function layOut(width: number, height: number, ratio: number): Geometry {
  const gap = Math.max(1, Math.round((width / BAR_COUNT) * GAP_RATIO));
  const pitch = (width + gap) / BAR_COUNT;
  const barWidth = Math.max(1, Math.floor(pitch - gap));
  const barX = new Float32Array(BAR_COUNT);
  for (let i = 0; i < BAR_COUNT; i++) barX[i] = Math.round(i * pitch);
  const radius = Math.min(barWidth / 2, BAR_RADIUS_PX * ratio);
  const capThickness = Math.max(1, Math.round(CAP_THICKNESS_PX * ratio));
  const capOffset = Math.round(CAP_OFFSET_PX * ratio);
  return {
    width,
    height,
    barX,
    barWidth,
    radii: [radius, radius, 0, 0],
    capThickness,
    capOffset,
    span: Math.max(1, height - capThickness - capOffset),
  };
}

/**
 * Maps each bar onto FFT bins. Band edges are evenly spaced on the spectral scale, so below
 * about 200 Hz a band is narrower than one bin: such a band samples the spectrum at its centre,
 * between the two nearest bins, which keeps neighbouring bass bars from repeating one bin.
 * Wider bands take their loudest bin.
 */
function mapBands(analyser: AnalyserNode): Bands {
  const binCount = analyser.frequencyBinCount;
  const binHz = analyser.context.sampleRate / analyser.fftSize;
  const top = binCount - 1;
  const first = new Int16Array(BAR_COUNT);
  const last = new Int16Array(BAR_COUNT);
  const below = new Int16Array(BAR_COUNT);
  const fraction = new Float32Array(BAR_COUNT);
  for (let i = 0; i < BAR_COUNT; i++) {
    // Band edges and centre, in bins.
    const low = spectralPositionToFrequency(i / BAR_COUNT) / binHz;
    const high = spectralPositionToFrequency((i + 1) / BAR_COUNT) / binHz;
    const centre = Math.min(top, spectralPositionToFrequency((i + 0.5) / BAR_COUNT) / binHz);
    const narrow = high - low < 1;
    first[i] = narrow ? 0 : Math.min(top, Math.ceil(low));
    last[i] = narrow ? -1 : Math.min(top, Math.ceil(high) - 1);
    below[i] = Math.min(top - 1, Math.floor(centre));
    fraction[i] = centre - below[i];
  }
  return { analyser, binCount, first, last, below, fraction };
}
