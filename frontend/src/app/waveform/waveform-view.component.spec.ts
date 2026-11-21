import { ApplicationRef } from '@angular/core';
import { ComponentFixture, fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import WaveSurfer, { type WaveSurferOptions } from 'wavesurfer.js';
import { frequencyToSpectralPosition, spectralRgb } from '../visual/spectral-palette';
import { WaveformFrequencyService } from './waveform-frequency.service';
import { WaveformViewComponent } from './waveform-view.component';

type Listener = (...args: unknown[]) => void;

/**
 * Stands in for WaveSurfer, so no audio is fetched or decoded. It keeps the options the view
 * passes, and `load` settles when a test calls `finishLoading` or `failLoading`.
 */
class FakeWaveSurfer {
  readonly renderer = { reRender: jasmine.createSpy('reRender') };
  decodedData: AudioBuffer | null = null;
  duration = 0;
  destroyed = false;
  url: string | null = null;
  private readonly listeners = new Map<string, Listener[]>();
  private settle: { resolve: () => void; reject: (error: Error) => void } | null = null;

  constructor(readonly options: WaveSurferOptions) {}

  on(event: string, listener: Listener): () => void {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
    return () => this.listeners.set(event, listeners.filter((l) => l !== listener));
  }

  unAll(): void {
    this.listeners.clear();
  }

  load(url: string): Promise<void> {
    this.url = url;
    return new Promise((resolve, reject) => (this.settle = { resolve, reject }));
  }

  getDecodedData(): AudioBuffer | null {
    return this.decodedData;
  }

  getDuration(): number {
    return this.duration;
  }

  getRenderer(): { reRender: jasmine.Spy } {
    return this.renderer;
  }

  destroy(): void {
    this.destroyed = true;
  }

  finishLoading(): void {
    this.settle?.resolve();
  }

  failLoading(): void {
    this.settle?.reject(new Error('Decoding failed'));
  }

  emit(event: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(event) ?? []) listener(...args);
  }
}

const ORIGINAL_URL = 'https://audio.test/api/audio/stream?tempoPercent=100&pitchSemitones=0';
const PROCESSED_URL = 'https://audio.test/api/audio/stream?tempoPercent=80&pitchSemitones=0';
const LOADING_TEXT = 'Decoding audio…';
const ERROR_TEXT = 'Couldn’t load this waveform.';
const COLOURING_TEXT = 'Colouring by frequency…';

/** Lets pending promise callbacks run. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve));

/** Alpha of one canvas pixel. */
function alphaAt(ctx: CanvasRenderingContext2D, x: number, y: number): number {
  return ctx.getImageData(x, y, 1, 1).data[3];
}

/** x of the first pixel of row `y` in [from, to) with at least `minAlpha`, or -1. */
function firstX(ctx: CanvasRenderingContext2D, y: number, from: number, to: number, minAlpha: number): number {
  for (let x = from; x < to; x++) {
    if (alphaAt(ctx, x, y) >= minAlpha) return x;
  }
  return -1;
}

/** x of the first fully opaque pixel of row `y` in [from, to), or -1. */
function opaqueX(ctx: CanvasRenderingContext2D, y: number, from: number, to: number): number {
  return firstX(ctx, y, from, to, 255);
}

/** Colour of the first fully opaque pixel of row `y` in [from, to). */
function opaqueColor(ctx: CanvasRenderingContext2D, y: number, from: number, to: number): number[] {
  const x = opaqueX(ctx, y, from, to);
  if (x < 0) return [];
  const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
  return [r, g, b];
}

function translateX(element: HTMLElement): number {
  const match = /translateX\((-?[\d.]+)px\)/.exec(element.style.transform);
  return match ? Number(match[1]) : Number.NaN;
}

describe('WaveformViewComponent', () => {
  let fixture: ComponentFixture<WaveformViewComponent>;
  let fakes: FakeWaveSurfer[];
  let service: WaveformFrequencyService;

  const host = () => fixture.nativeElement as HTMLElement;
  const lane = () => host().querySelector('[role="img"]') as HTMLElement;
  const hoverLayer = () => host().querySelector('.hover') as HTMLElement;
  const hoverTime = () => host().querySelector('.hover-time') as HTMLElement;
  const text = () => host().textContent ?? '';
  const latest = () => fakes[fakes.length - 1];

  /** Runs change detection and then the after-render hooks, as a browser frame does. */
  const renderView = () => {
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
  };

  /** Points the view at a track and lets the fake finish decoding it. */
  const showTrack = async (options: { decoded?: boolean } = {}) => {
    fixture.componentRef.setInput('src', ORIGINAL_URL);
    renderView();
    const fake = latest();
    if (options.decoded) fake.decodedData = {} as AudioBuffer;
    fake.finishLoading();
    await settle();
    fixture.detectChanges();
    return fake;
  };

  /** The lane spans 400 px from x = 100. */
  const stubLaneRect = () => spyOn(lane(), 'getBoundingClientRect').and.returnValue(new DOMRect(100, 0, 400, 80));

  const pointer = (type: string, clientX: number, pointerType = 'mouse') =>
    lane().dispatchEvent(new PointerEvent(type, { clientX, clientY: 20, pointerType, bubbles: true }));

  const click = (clientX: number) =>
    lane().dispatchEvent(new MouseEvent('click', { clientX, clientY: 20, button: 0, bubbles: true }));

  const seeks = () => {
    const fractions: number[] = [];
    fixture.componentInstance.seek.subscribe((fraction) => fractions.push(fraction));
    return fractions;
  };

  /** Draws `channels` through the view's render callback on a fresh 300 × 60 canvas. */
  const drawOnCanvas = (channels: Float32Array[]) => {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 60;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    latest().options.renderFunction?.(channels, ctx);
    return ctx;
  };

  beforeEach(() => {
    fakes = [];
    spyOn(WaveSurfer, 'create').and.callFake((options: WaveSurferOptions) => {
      const fake = new FakeWaveSurfer(options);
      fakes.push(fake);
      return fake as unknown as WaveSurfer;
    });
    TestBed.configureTestingModule({ imports: [WaveformViewComponent] });
    fixture = TestBed.createComponent(WaveformViewComponent);
    fixture.componentRef.setInput('src', null);
    fixture.componentRef.setInput('durationSeconds', 200);
    fixture.componentRef.setInput('ariaLabel', 'Original waveform');
    service = fixture.debugElement.injector.get(WaveformFrequencyService);
  });

  describe('without a source', () => {
    it('shows an empty lane and loads nothing', () => {
      const fetchSpy = spyOn(window, 'fetch').and.rejectWith(new Error('No network in unit tests'));

      renderView();

      expect(lane()).not.toBeNull();
      expect(WaveSurfer.create).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(text().trim()).toBe('');
    });

    it('presents the lane as an image named by ariaLabel, with its overlays hidden', () => {
      renderView();

      expect(lane().getAttribute('role')).toBe('img');
      expect(lane().getAttribute('aria-label')).toBe('Original waveform');
      expect(lane().hasAttribute('tabindex')).toBeFalse();
      expect(host().querySelector('.shade')?.getAttribute('aria-hidden')).toBe('true');
      expect(hoverLayer().getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('loading', () => {
    it('uses WaveSurfer only to fetch and decode, with its cursor, progress and interaction off', () => {
      fixture.componentRef.setInput('src', ORIGINAL_URL);
      renderView();

      const options = latest().options;
      expect(latest().url).toBe(ORIGINAL_URL);
      expect(options.container).toBe(host().querySelector('.wave') as HTMLElement);
      expect(options).toEqual(
        jasmine.objectContaining({ interact: false, cursorWidth: 0, progressColor: 'transparent', height: 'auto' }),
      );
      expect(options.renderFunction).toEqual(jasmine.any(Function));
    });

    it('shows a skeleton and the loading label until the track is decoded', async () => {
      fixture.componentRef.setInput('src', ORIGINAL_URL);
      renderView();

      expect(text()).toContain(LOADING_TEXT);
      expect(host().querySelector('.skeleton')).not.toBeNull();
      expect(lane().getAttribute('aria-busy')).toBe('true');

      fixture.componentRef.setInput('loadingLabel', 'Processing on the server…');
      fixture.detectChanges();
      expect(text()).toContain('Processing on the server…');

      latest().finishLoading();
      await settle();
      fixture.detectChanges();

      expect(text()).not.toContain('Processing on the server…');
      expect(host().querySelector('.skeleton')).toBeNull();
      expect(lane().hasAttribute('aria-busy')).toBeFalse();
    });

    it('shows an error when the track cannot be fetched or decoded', async () => {
      fixture.componentRef.setInput('src', ORIGINAL_URL);
      renderView();

      latest().failLoading();
      await settle();
      fixture.detectChanges();

      expect(text()).toContain(ERROR_TEXT);
      expect(text()).not.toContain(LOADING_TEXT);
    });

    it('shows an error when WaveSurfer reports a media error while loading', () => {
      fixture.componentRef.setInput('src', ORIGINAL_URL);
      renderView();

      latest().emit('error', new Error('Media error'));
      fixture.detectChanges();

      expect(text()).toContain(ERROR_TEXT);
    });

    it('loads a new source in a fresh WaveSurfer and cancels the analysis of the previous one', async () => {
      let signal: AbortSignal | undefined;
      spyOn(service, 'computeFrequencyBySegment').and.callFake((_buffer, options) => {
        signal = options?.signal;
        return new Promise<void>(() => undefined);
      });
      const reset = spyOn(service, 'reset').and.callThrough();
      const first = await showTrack({ decoded: true });
      expect(signal?.aborted).toBeFalse();

      fixture.componentRef.setInput('src', PROCESSED_URL);
      fixture.detectChanges();

      expect(first.destroyed).toBeTrue();
      expect(signal?.aborted).toBeTrue();
      expect(reset).toHaveBeenCalled();
      expect(latest()).not.toBe(first);
      expect(latest().url).toBe(PROCESSED_URL);
      expect(text()).toContain(LOADING_TEXT);
    });

    it('ignores the previous track when it finishes loading after the source changed', async () => {
      fixture.componentRef.setInput('src', ORIGINAL_URL);
      renderView();
      const first = latest();
      fixture.componentRef.setInput('src', PROCESSED_URL);
      fixture.detectChanges();

      first.finishLoading();
      await settle();
      fixture.detectChanges();

      expect(fakes.length).toBe(2);
      expect(text()).toContain(LOADING_TEXT);
    });
  });

  describe('frequency colouring', () => {
    it('shows the colouring chip while the analysis runs', async () => {
      let finish: () => void = () => undefined;
      spyOn(service, 'computeFrequencyBySegment').and.returnValue(
        new Promise<void>((resolve) => (finish = () => resolve())),
      );

      await showTrack({ decoded: true });
      expect(text()).toContain(COLOURING_TEXT);

      finish();
      await settle();
      fixture.detectChanges();
      expect(text()).not.toContain(COLOURING_TEXT);
    });

    it('starts the analysis of a deferred view 400 ms after the bars are drawn', fakeAsync(() => {
      const compute = spyOn(service, 'computeFrequencyBySegment').and.returnValue(new Promise<void>(() => undefined));
      fixture.componentRef.setInput('deferColoring', true);
      fixture.componentRef.setInput('src', ORIGINAL_URL);
      renderView();
      latest().decodedData = {} as AudioBuffer;
      latest().finishLoading();
      flushMicrotasks();
      fixture.detectChanges();

      expect(text()).toContain(COLOURING_TEXT);
      tick(399);
      expect(compute).not.toHaveBeenCalled();
      tick(1);
      expect(compute).toHaveBeenCalledTimes(1);
    }));

    it('drops a deferred analysis when the view is destroyed before it starts', fakeAsync(() => {
      const compute = spyOn(service, 'computeFrequencyBySegment').and.returnValue(new Promise<void>(() => undefined));
      fixture.componentRef.setInput('deferColoring', true);
      fixture.componentRef.setInput('src', ORIGINAL_URL);
      renderView();
      latest().decodedData = {} as AudioBuffer;
      latest().finishLoading();
      flushMicrotasks();

      fixture.destroy();
      tick(400);

      expect(compute).not.toHaveBeenCalled();
    }));

    it('draws analysed segments in their spectral colour and the others in the neutral colour', async () => {
      await showTrack();
      const frequencies: (number | undefined)[] = new Array(service.numFreqSegments);
      frequencies.fill(440, 0, service.numFreqSegments / 2);
      spyOn(service, 'getFrequencyBySegment').and.returnValue(frequencies);

      const ctx = drawOnCanvas([new Float32Array(3000).fill(0.5)]);

      expect(opaqueColor(ctx, 30, 60, 75)).toEqual([...spectralRgb(frequencyToSpectralPosition(440))]);
      expect(opaqueColor(ctx, 30, 225, 240)).toEqual([0x3b, 0x3b, 0x4d]);
    });

    it('mirrors the bars around the centre line, the loudest spanning the bar height', async () => {
      await showTrack();
      const samples = new Float32Array(3000);
      samples.fill(0.8, 1500);

      const ctx = drawOnCanvas([samples]);
      const loud = opaqueX(ctx, 30, 225, 240);
      // A silent bar is a dot as tall as it is wide, so its rounded edge is never fully opaque.
      const quiet = firstX(ctx, 30, 60, 75, 1);

      expect(loud).toBeGreaterThanOrEqual(0);
      expect(alphaAt(ctx, loud, 5)).toBeGreaterThan(0);
      expect(Math.abs(alphaAt(ctx, loud, 5) - alphaAt(ctx, loud, 54))).toBeLessThanOrEqual(2);
      expect(alphaAt(ctx, loud, 1)).toBe(0);
      expect(alphaAt(ctx, loud, 58)).toBe(0);

      expect(quiet).toBeGreaterThanOrEqual(0);
      expect(alphaAt(ctx, quiet, 20)).toBe(0);
      expect(alphaAt(ctx, quiet, 40)).toBe(0);
    });
  });

  describe('playback position', () => {
    it('moves the shade and its playhead with the inherited --wf-progress', async () => {
      await showTrack();
      const shade = host().querySelector('.shade') as HTMLElement;

      host().style.setProperty('--wf-progress', '0.25');

      expect(shade.offsetWidth).toBeGreaterThan(0);
      const offset = new DOMMatrixReadOnly(getComputedStyle(shade).transform).m41;
      expect(offset).toBeCloseTo(shade.offsetWidth * 0.25, 0);
    });

    it('keeps the shade in front of the bars, whatever z-index WaveSurfer gives its canvases', async () => {
      await showTrack();
      const wave = host().querySelector('.wave') as HTMLElement;
      // Ends the fade-in: while it runs, the layer's opacity stacks it on its own.
      wave.style.transition = 'none';
      expect(getComputedStyle(wave).opacity).toBe('1');
      const canvasWrapper = document.createElement('div');
      canvasWrapper.style.cssText = 'position: absolute; inset: 0; z-index: 2;';
      wave.appendChild(canvasWrapper);

      const rect = lane().getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);

      expect(hit).toBe(host().querySelector('.shade'));
    });
  });

  describe('pointer', () => {
    it('emits the clicked fraction of the track', async () => {
      await showTrack();
      stubLaneRect();
      const fractions = seeks();

      click(200);

      expect(fractions).toEqual([0.25]);
    });

    it('ignores clicks while the track is loading', () => {
      fixture.componentRef.setInput('src', ORIGINAL_URL);
      renderView();
      stubLaneRect();
      const fractions = seeks();

      click(200);

      expect(fractions).toEqual([]);
    });

    it('takes a press that moved more than a few pixels for a drag, not a click', async () => {
      await showTrack();
      stubLaneRect();
      const fractions = seeks();

      pointer('pointerdown', 150);
      click(260);
      pointer('pointerdown', 150);
      click(152);

      expect(fractions).toEqual([0.13]);
    });

    it('shows the time under the pointer as m:ss and hides it when the pointer leaves', async () => {
      await showTrack();
      stubLaneRect();

      pointer('pointermove', 300);

      expect(hoverTime().textContent).toBe('1:40');
      expect(getComputedStyle(hoverLayer()).visibility).toBe('visible');

      pointer('pointerleave', 300);

      expect(getComputedStyle(hoverLayer()).visibility).toBe('hidden');
    });

    it('keeps the hover time inside the lane at both ends', async () => {
      await showTrack();
      stubLaneRect();

      pointer('pointermove', 500);
      expect(hoverTime().textContent).toBe('3:20');
      expect(translateX(hoverTime()) + hoverTime().offsetWidth).toBeLessThanOrEqual(396.5);

      pointer('pointermove', 100);
      expect(hoverTime().textContent).toBe('0:00');
      expect(translateX(hoverTime())).toBeGreaterThanOrEqual(4);
    });

    it('takes the decoded duration while the timeline duration is unknown', async () => {
      fixture.componentRef.setInput('durationSeconds', 0);
      const fake = await showTrack();
      fake.duration = 90;
      stubLaneRect();

      pointer('pointermove', 300);

      expect(hoverTime().textContent).toBe('0:45');
    });

    it('shows no hover time while loading or for touch input', async () => {
      fixture.componentRef.setInput('src', ORIGINAL_URL);
      renderView();
      stubLaneRect();

      pointer('pointermove', 300);
      expect(getComputedStyle(hoverLayer()).visibility).toBe('hidden');

      latest().finishLoading();
      await settle();
      fixture.detectChanges();
      pointer('pointermove', 300, 'touch');
      expect(getComputedStyle(hoverLayer()).visibility).toBe('hidden');
    });
  });

  describe('destroy', () => {
    it('releases WaveSurfer, the analysis and the observers', async () => {
      let signal: AbortSignal | undefined;
      spyOn(service, 'computeFrequencyBySegment').and.callFake((_buffer, options) => {
        signal = options?.signal;
        return new Promise<void>(() => undefined);
      });
      const disconnect = spyOn(ResizeObserver.prototype, 'disconnect').and.callThrough();
      const fake = await showTrack({ decoded: true });

      expect(() => fixture.destroy()).not.toThrow();

      expect(fake.destroyed).toBeTrue();
      expect(signal?.aborted).toBeTrue();
      expect(disconnect).toHaveBeenCalled();
    });

    it('ignores a load that finishes after the view is destroyed', async () => {
      fixture.componentRef.setInput('src', ORIGINAL_URL);
      renderView();
      const fake = latest();
      fixture.destroy();

      fake.finishLoading();
      await settle();

      expect(fake.destroyed).toBeTrue();
      expect(WaveSurfer.create).toHaveBeenCalledTimes(1);
    });
  });
});
