import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AudioAnalysisService } from '../../services/audio-analysis.service';
import { frequencyToSpectralPosition, SPECTRAL_MAX_HZ, spectralColor } from '../../visual/spectral-palette';
import { StageLightDirective } from './stage-light.directive';

@Component({
  template: `<div [appStageLight]="active()"></div>`,
  imports: [StageLightDirective],
})
class StageComponent {
  readonly active = signal(false);
}

/** Stands in for the audio analysis, reporting whatever frequency and RMS level a test sets. */
class AnalysisStub {
  hz = 0;
  rms = 0;
  readonly dominantFrequency = jasmine.createSpy('dominantFrequency').and.callFake(() => this.hz);
  readonly level = jasmine.createSpy('level').and.callFake(() => this.rms);
}

/** Stands in for requestAnimationFrame, so a test runs frames at the times it chooses. */
class Frames {
  private readonly requests = new Map<number, FrameRequestCallback>();
  private lastId = 0;
  private now = 0;

  constructor() {
    spyOn(window, 'requestAnimationFrame').and.callFake((callback) => {
      this.requests.set(++this.lastId, callback);
      return this.lastId;
    });
    spyOn(window, 'cancelAnimationFrame').and.callFake((id) => {
      this.requests.delete(id);
    });
  }

  /** Whether a frame has been requested and has not run or been cancelled yet. */
  get pending(): boolean {
    return this.requests.size > 0;
  }

  /** Runs frames `interval` ms apart for `duration` ms, or until none is requested. */
  runFor(duration: number, interval = 1000 / 60): void {
    for (let elapsed = interval; elapsed <= duration + 1e-6 && this.pending; elapsed += interval) {
      this.now += interval;
      const due = [...this.requests.values()];
      this.requests.clear();
      for (const callback of due) callback(this.now);
    }
  }
}

/** A prefers-reduced-motion query whose answer a test can change. */
class MotionQuery {
  private readonly listeners = new Set<(event: MediaQueryListEvent) => void>();

  constructor(public matches: boolean) {}

  readonly media = '(prefers-reduced-motion: reduce)';

  get list(): MediaQueryList {
    return this as unknown as MediaQueryList;
  }

  get listening(): boolean {
    return this.listeners.size > 0;
  }

  addEventListener(_type: 'change', listener: (event: MediaQueryListEvent) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'change', listener: (event: MediaQueryListEvent) => void): void {
    this.listeners.delete(listener);
  }

  change(reduce: boolean): void {
    this.matches = reduce;
    for (const listener of this.listeners) listener({ matches: reduce } as MediaQueryListEvent);
  }
}

/** Position on the spectral scale of a colour that spectralColor produced. */
function positionOf(color: string): number {
  for (let i = 0; i < 256; i++) {
    if (spectralColor(i / 255) === color) return i / 255;
  }
  return Number.NaN;
}

describe('StageLightDirective', () => {
  let fixture: ComponentFixture<StageComponent>;
  let analysis: AnalysisStub;
  let frames: Frames;

  const stage = () => (fixture.nativeElement as HTMLElement).querySelector('div') as HTMLElement;
  const glow = () => stage().style.getPropertyValue('--stage-glow');
  const glowLevel = () => Number.parseFloat(stage().style.getPropertyValue('--stage-glow-level'));

  function create(): void {
    fixture = TestBed.createComponent(StageComponent);
    fixture.detectChanges();
  }

  function setActive(active: boolean): void {
    fixture.componentInstance.active.set(active);
    fixture.detectChanges();
  }

  beforeEach(() => {
    analysis = new AnalysisStub();
    frames = new Frames();
    TestBed.configureTestingModule({
      imports: [StageComponent],
      providers: [{ provide: AudioAnalysisService, useValue: analysis }],
    });
  });

  it('starts unlit, at the colour of the middle of the scale', () => {
    create();

    expect(glow()).toBe(spectralColor(0.5));
    expect(glowLevel()).toBe(0);
  });

  it('stays unlit and requests no frames while inactive', () => {
    analysis.hz = 2000;
    analysis.rms = 0.3;
    create();

    expect(frames.pending).toBeFalse();
    expect(analysis.dominantFrequency).not.toHaveBeenCalled();
    expect(glowLevel()).toBe(0);
  });

  it('follows the dominant frequency and the loudness while active', () => {
    analysis.hz = 2000;
    analysis.rms = 0.2;
    create();
    setActive(true);

    frames.runFor(3000);

    expect(glow()).toBe(spectralColor(frequencyToSpectralPosition(2000)));
    expect(glowLevel()).toBeGreaterThan(0.4);
    expect(frames.pending).toBeTrue();
  });

  it('lights typical music, from -26 to -10 dBFS RMS, between 0.4 and 0.9', () => {
    analysis.hz = 440;
    create();
    setActive(true);

    for (const rms of [0.05, 0.1, 0.2, 0.3]) {
      analysis.rms = rms;
      frames.runFor(2000);
      expect(glowLevel()).withContext(`RMS ${rms}`).toBeGreaterThanOrEqual(0.4);
      expect(glowLevel()).withContext(`RMS ${rms}`).toBeLessThanOrEqual(0.9);
    }
  });

  it('eases the colour more slowly than the level', () => {
    analysis.hz = SPECTRAL_MAX_HZ;
    analysis.rms = 0.5;
    create();
    setActive(true);

    frames.runFor(200);

    const colorProgress = (positionOf(glow()) - 0.5) / 0.5;
    expect(colorProgress).toBeGreaterThan(0);
    expect(glowLevel()).toBeGreaterThan(colorProgress * 1.5);
  });

  it('times its smoothing in seconds: the light moves alike at 60 and at 120 frames per second', () => {
    const levels: number[] = [];
    const positions: number[] = [];
    for (const rate of [60, 120]) {
      analysis.hz = SPECTRAL_MAX_HZ;
      analysis.rms = 0.5;
      create();
      setActive(true);
      frames.runFor(1000 / rate, 1000 / rate);
      frames.runFor(100, 1000 / rate);
      levels.push(glowLevel());
      positions.push(positionOf(glow()));
      fixture.destroy();
    }

    expect(levels[0]).toBeCloseTo(levels[1], 2);
    expect(positions[0]).toBeCloseTo(positions[1], 2);
  });

  it('keeps its last colour while the track is silent', () => {
    analysis.hz = 2000;
    analysis.rms = 0.2;
    create();
    setActive(true);
    frames.runFor(3000);
    const lit = glow();

    analysis.hz = 0;
    analysis.rms = 0;
    frames.runFor(1000);

    expect(glow()).toBe(lit);
  });

  it('eases the level to 0 when playback stops, then stops requesting frames', () => {
    analysis.hz = 2000;
    analysis.rms = 0.2;
    create();
    setActive(true);
    frames.runFor(2000);
    const lit = glowLevel();

    setActive(false);
    frames.runFor(100);

    expect(glowLevel()).toBeGreaterThan(0);
    expect(glowLevel()).toBeLessThan(lit);
    expect(frames.pending).toBeTrue();

    frames.runFor(3000);

    expect(glowLevel()).toBe(0);
    expect(frames.pending).toBeFalse();
  });

  it('writes its properties only when they change', () => {
    analysis.hz = 2000;
    analysis.rms = 0.2;
    create();
    setActive(true);
    frames.runFor(3000);
    const setProperty = spyOn(stage().style, 'setProperty').and.callThrough();

    frames.runFor(500);

    expect(setProperty).not.toHaveBeenCalled();

    analysis.rms = 0.05;
    frames.runFor(100);

    expect(setProperty).toHaveBeenCalledWith('--stage-glow-level', jasmine.any(String));
  });

  it('cancels its frame and stops listening for motion preference changes when destroyed', () => {
    const motion = new MotionQuery(false);
    spyOn(window, 'matchMedia').and.returnValue(motion.list);
    analysis.rms = 0.2;
    create();
    setActive(true);

    expect(frames.pending).toBeTrue();
    expect(motion.listening).toBeTrue();

    fixture.destroy();

    expect(frames.pending).toBeFalse();
    expect(motion.listening).toBeFalse();
  });

  describe('with reduced motion', () => {
    it('does not animate and keeps the level at 0', () => {
      spyOn(window, 'matchMedia').and.returnValue(new MotionQuery(true).list);
      analysis.hz = 2000;
      analysis.rms = 0.3;
      create();
      setActive(true);

      expect(frames.pending).toBeFalse();
      expect(analysis.level).not.toHaveBeenCalled();
      expect(glowLevel()).toBe(0);
    });

    it('goes dark at once when the preference turns on during playback', () => {
      const motion = new MotionQuery(false);
      spyOn(window, 'matchMedia').and.returnValue(motion.list);
      analysis.hz = 2000;
      analysis.rms = 0.3;
      create();
      setActive(true);
      frames.runFor(1000);
      expect(glowLevel()).toBeGreaterThan(0);

      motion.change(true);

      expect(glowLevel()).toBe(0);
      expect(frames.pending).toBeFalse();
    });
  });
});
