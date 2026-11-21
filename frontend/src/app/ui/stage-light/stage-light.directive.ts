import { DestroyRef, Directive, effect, ElementRef, inject, input, NgZone } from '@angular/core';
import { AudioAnalysisService } from '../../services/audio-analysis.service';
import { frequencyToSpectralPosition, spectralColor } from '../../visual/spectral-palette';

/** Smoothing time constants (s): the colour drifts with the music, the level pulses with it. */
const COLOR_SMOOTHING_S = 0.4;
const LEVEL_SMOOTHING_S = 0.15;
/**
 * RMS levels (dBFS) written as 0 and 1. A decibel scale follows how loudness is heard, and
 * typical music, between -26 and -10 dBFS, lands between 0.4 and 0.9.
 */
const LEVEL_FLOOR_DB = -42;
const LEVEL_CEILING_DB = -6;
/** Smallest level change written to the host; a smaller one is invisible in a glow. */
const LEVEL_WRITE_STEP = 0.002;
/** A fading level below this snaps to 0, and the loop stops. */
const LEVEL_SETTLED = 0.001;
/** Longest step (s) the smoothing takes in one frame, so the light glides on after a stall. */
const MAX_STEP_S = 0.1;

/**
 * Lights its host with the music. While `appStageLight` is true it reads the audio analysis
 * every animation frame and writes two custom properties on the host for its styles to use:
 *
 * - `--stage-glow`: the spectral colour of the dominant frequency, smoothed over about 400 ms.
 *   It starts at the middle of the scale and keeps its last colour through silence.
 * - `--stage-glow-level`: the loudness, from 0 to 1 with three decimals, smoothed over about
 *   150 ms. Typical music sits between 0.4 and 0.9.
 *
 * When `appStageLight` turns false the level eases to 0 and the loop stops. With reduced
 * motion the light does not animate and the level stays at 0. Frames run outside the Angular
 * zone and write to the element directly, only when a value changes, so the light never
 * triggers change detection.
 */
@Directive({ selector: '[appStageLight]' })
export class StageLightDirective {
  /** True while the track plays. */
  readonly appStageLight = input(false);

  private readonly analysis = inject(AudioAnalysisService);
  private readonly style = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.style;
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  /** Smoothed position of the dominant frequency on the spectral scale. */
  private position = 0.5;
  private level = 0;
  private writtenColor = '';
  /** Level last written to the host; -1 before the first write. */
  private writtenLevel = -1;
  private reducedMotion = false;
  private frameId = 0;
  private lastFrameAt: number | null = null;

  constructor() {
    this.write();
    this.zone.runOutsideAngular(() => this.watchMotionPreference());
    // A change of the input wakes the loop, which reads it on every frame.
    effect(() => {
      this.appStageLight();
      this.zone.runOutsideAngular(() => this.wake());
    });
    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
    });
  }

  private watchMotionPreference(): void {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => {
      this.reducedMotion = event.matches;
      if (!event.matches) {
        this.wake();
        return;
      }
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
      this.level = 0;
      this.write();
    };
    this.reducedMotion = query.matches;
    query.addEventListener('change', onChange);
    this.destroyRef.onDestroy(() => query.removeEventListener('change', onChange));
  }

  /** Starts the frame loop unless it is running already or there is nothing to animate. */
  private wake(): void {
    if (this.frameId !== 0 || (!this.isLive() && this.level === 0)) return;
    this.lastFrameAt = null;
    this.frameId = requestAnimationFrame(this.frame);
  }

  private isLive(): boolean {
    return this.appStageLight() && !this.reducedMotion;
  }

  private readonly frame = (now: number): void => {
    this.frameId = 0;
    const previous = this.lastFrameAt;
    this.lastFrameAt = now;
    const step = previous === null ? 0 : Math.min(MAX_STEP_S, (now - previous) / 1000);

    const live = this.isLive();
    if (live) {
      const hz = this.analysis.dominantFrequency();
      if (hz > 0) {
        // Smoothing on the scale itself, which is logarithmic, treats every octave alike.
        this.position = ease(this.position, frequencyToSpectralPosition(hz), step, COLOR_SMOOTHING_S);
      }
      this.level = ease(this.level, loudness(this.analysis.level()), step, LEVEL_SMOOTHING_S);
    } else {
      this.level = this.level < LEVEL_SETTLED ? 0 : ease(this.level, 0, step, LEVEL_SMOOTHING_S);
    }
    this.write();

    if (live || this.level > 0) this.frameId = requestAnimationFrame(this.frame);
  };

  private write(): void {
    // Colours come from a lookup table, so an unchanged colour is the same string.
    const color = spectralColor(this.position);
    if (color !== this.writtenColor) {
      this.style.setProperty('--stage-glow', color);
      this.writtenColor = color;
    }
    const level = this.level;
    // Zero is always written, so the light goes fully dark however small the last step.
    if (Math.abs(level - this.writtenLevel) >= LEVEL_WRITE_STEP || (level === 0 && this.writtenLevel !== 0)) {
      this.style.setProperty('--stage-glow-level', level.toFixed(3));
      this.writtenLevel = level;
    }
  }
}

/** Moves `value` towards `target` as a first-order low-pass with a time constant of `seconds`. */
function ease(value: number, target: number, step: number, seconds: number): number {
  return value + (target - value) * (1 - Math.exp(-step / seconds));
}

/** Maps an RMS level onto 0 to 1 between LEVEL_FLOOR_DB and LEVEL_CEILING_DB. */
function loudness(rms: number): number {
  if (!(rms > 0)) return 0;
  const db = 20 * Math.log10(rms);
  return Math.min(1, Math.max(0, (db - LEVEL_FLOOR_DB) / (LEVEL_CEILING_DB - LEVEL_FLOOR_DB)));
}
