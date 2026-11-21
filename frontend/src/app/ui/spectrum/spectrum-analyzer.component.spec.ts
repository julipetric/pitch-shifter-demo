import { ComponentFixture, TestBed } from '@angular/core/testing';
import { frequencyToSpectralPosition, spectralRgb } from '../../visual/spectral-palette';
import { SPECTRUM_REST_HEIGHT, SpectrumAnalyzerComponent } from './spectrum-analyzer.component';

/** Bars the spectrum draws across the scale. */
const BARS = 48;
/** Width given to the host, in CSS pixels. */
const WIDTH = 480;

const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);

/** Resolves after the browser has rendered twice, by when resize observers have reported. */
function rendered(): Promise<void> {
  return new Promise((resolve) => nativeRequestAnimationFrame(() => nativeRequestAnimationFrame(() => resolve())));
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

/** An analyser whose bins all read `value` (0 to 255); it counts how often it is read. */
class FakeAnalyser {
  value = 0;
  reads = 0;
  readonly frequencyBinCount = 1024;
  readonly fftSize = 2048;
  readonly context = { sampleRate: 48_000 };

  getByteFrequencyData(target: Uint8Array): void {
    this.reads++;
    target.fill(this.value);
  }

  get node(): AnalyserNode {
    return this as unknown as AnalyserNode;
  }
}

/** A prefers-reduced-motion query with a fixed answer. */
function motionQuery(reduce: boolean): MediaQueryList {
  return {
    matches: reduce,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  } as unknown as MediaQueryList;
}

describe('SpectrumAnalyzerComponent', () => {
  let fixture: ComponentFixture<SpectrumAnalyzerComponent>;
  let frames: Frames;
  let analyser: FakeAnalyser;

  const host = () => fixture.nativeElement as HTMLElement;
  const canvas = () => host().querySelector('canvas') as HTMLCanvasElement;
  const centre = (rect: DOMRect) => rect.left + rect.width / 2;

  async function create(inputs: { analyser?: AnalyserNode | null; active?: boolean } = {}): Promise<void> {
    fixture = TestBed.createComponent(SpectrumAnalyzerComponent);
    host().style.width = `${WIDTH}px`;
    if (inputs.analyser !== undefined) fixture.componentRef.setInput('analyser', inputs.analyser);
    if (inputs.active !== undefined) fixture.componentRef.setInput('active', inputs.active);
    fixture.detectChanges();
    await rendered();
  }

  function setActive(active: boolean): void {
    fixture.componentRef.setInput('active', active);
    fixture.detectChanges();
  }

  /** RGBA of the pixel on the centre line of `bar`, `y` device pixels below the top edge. */
  function pixel(bar: number, y: number): number[] {
    const x = Math.floor(((bar + 0.5) / BARS) * canvas().width);
    return Array.from(canvas().getContext('2d')?.getImageData(x, y, 1, 1).data ?? []);
  }

  /** Height of `bar` in device pixels, measured up its centre line from the bottom edge. */
  function barHeight(bar: number): number {
    const x = Math.floor(((bar + 0.5) / BARS) * canvas().width);
    const { height } = canvas();
    const column = canvas().getContext('2d')?.getImageData(x, 0, 1, height).data ?? new Uint8ClampedArray();
    let filled = 0;
    while (filled < height && column[(height - 1 - filled) * 4 + 3] > 0) filled++;
    return filled;
  }

  /** Expects the legend: every bar low, in the colour of its band, with no frame requested. */
  function expectRest(): void {
    const bottom = canvas().height - 1;
    expect(pixel(0, bottom)).toEqual([...spectralRgb(0.5 / BARS), 255]);
    expect(pixel(BARS - 1, bottom)).toEqual([...spectralRgb((BARS - 0.5) / BARS), 255]);
    for (const bar of [0, BARS / 2, BARS - 1]) {
      const share = barHeight(bar) / canvas().height;
      expect(share).toBeGreaterThan(SPECTRUM_REST_HEIGHT - 0.03);
      expect(share).toBeLessThan(SPECTRUM_REST_HEIGHT + 0.02);
    }
    expect(frames.pending).toBeFalse();
  }

  beforeEach(() => {
    frames = new Frames();
    analyser = new FakeAnalyser();
  });

  it('describes itself to assistive technology as an image of the colour scale', async () => {
    await create();

    expect(canvas().getAttribute('role')).toBe('img');
    expect(canvas().getAttribute('aria-label')).toBe('Live frequency spectrum, low to high: violet to gold');
  });

  it('labels 100 Hz, 1 kHz and 10 kHz at their places on the scale, inside its box', async () => {
    await create();
    const box = host().getBoundingClientRect();
    const labels = Array.from(host().querySelectorAll<HTMLElement>('.axis-label'));

    expect(labels.map((label) => label.textContent?.trim())).toEqual(['100 Hz', '1 kHz', '10 kHz']);

    const [hundred, thousand, tenThousand] = labels.map((label) => label.getBoundingClientRect());
    expect(centre(hundred) - box.left).toBeCloseTo(frequencyToSpectralPosition(100) * WIDTH, 0);
    expect(centre(thousand) - box.left).toBeCloseTo(frequencyToSpectralPosition(1000) * WIDTH, 0);
    expect(tenThousand.right).toBeCloseTo(box.right, 0);
    for (const rect of [hundred, thousand, tenThousand]) {
      expect(rect.left).toBeGreaterThanOrEqual(box.left);
      expect(rect.right).toBeLessThanOrEqual(box.right + 0.5);
    }
  });

  it('sizes its bitmap to its box in device pixels, taking the height from --spectrum-height', async () => {
    await create();

    expect(canvas().clientHeight).toBe(72);
    expect(canvas().width).toBe(Math.round(WIDTH * devicePixelRatio));
    expect(canvas().height).toBe(Math.round(72 * devicePixelRatio));

    host().style.setProperty('--spectrum-height', '40px');
    await rendered();

    expect(canvas().clientHeight).toBe(40);
    expect(canvas().height).toBe(Math.round(40 * devicePixelRatio));
  });

  it('shows the colour legend without an analyser: low bars in their spectral colours', async () => {
    await create({ active: true });

    expectRest();
  });

  it('requests no frames while inactive at rest', async () => {
    await create({ analyser: analyser.node, active: false });

    expect(frames.pending).toBeFalse();
    expect(analyser.reads).toBe(0);
  });

  it('raises the bars with the signal while active', async () => {
    analyser.value = 255;
    await create({ analyser: analyser.node, active: true });

    frames.runFor(300);

    expect(barHeight(BARS / 2)).toBeGreaterThan(canvas().height * 0.9);
  });

  it('times its ballistics in seconds: the bars fall alike at 60 and at 120 frames per second', async () => {
    const heights: number[] = [];
    for (const rate of [60, 120]) {
      analyser.value = 255;
      await create({ analyser: analyser.node, active: true });
      frames.runFor(500, 1000 / rate);
      analyser.value = 0;
      frames.runFor(150, 1000 / rate);
      heights.push(barHeight(BARS / 2));
      fixture.destroy();
    }

    expect(heights[0]).toBeGreaterThan(canvas().height * 0.3);
    expect(heights[0]).toBeLessThan(canvas().height * 0.7);
    expect(Math.abs(heights[0] - heights[1])).toBeLessThanOrEqual(1);
  });

  it('holds a peak cap above a falling bar, then lets it fall', async () => {
    analyser.value = 255;
    await create({ analyser: analyser.node, active: true });
    frames.runFor(500);
    analyser.value = 0;

    frames.runFor(300);

    expect(pixel(BARS / 2, 0)[3]).toBe(255);
    expect(barHeight(BARS / 2)).toBeLessThan(canvas().height / 2);

    frames.runFor(1500);

    expect(pixel(BARS / 2, 0)[3]).toBe(0);
  });

  it('falls back to rest after playback stops, then stops requesting frames', async () => {
    analyser.value = 255;
    await create({ analyser: analyser.node, active: true });
    frames.runFor(500);

    setActive(false);
    frames.runFor(250);

    expect(frames.pending).toBeTrue();
    expect(barHeight(BARS / 2)).toBeGreaterThan(canvas().height * (SPECTRUM_REST_HEIGHT + 0.02));

    frames.runFor(5000);

    expectRest();
  });

  it('cancels its frame loop and disconnects its resize observer when destroyed', async () => {
    const disconnect = spyOn(ResizeObserver.prototype, 'disconnect').and.callThrough();
    await create({ analyser: analyser.node, active: true });
    expect(frames.pending).toBeTrue();

    fixture.destroy();

    expect(frames.pending).toBeFalse();
    expect(disconnect).toHaveBeenCalled();
  });

  describe('with reduced motion', () => {
    beforeEach(() => {
      spyOn(window, 'matchMedia').and.returnValue(motionQuery(true));
    });

    it('keeps the levels live at about 15 frames per second, at 60 and at 120 Hz', async () => {
      analyser.value = 128;
      await create({ analyser: analyser.node, active: true });

      for (const rate of [60, 120]) {
        const before = analyser.reads;
        frames.runFor(1000, 1000 / rate);
        expect(analyser.reads - before).withContext(`${rate} Hz`).toBeGreaterThanOrEqual(14);
        expect(analyser.reads - before).withContext(`${rate} Hz`).toBeLessThanOrEqual(16);
      }
      expect(barHeight(BARS / 2)).toBeGreaterThan(canvas().height * 0.4);
    });

    it('draws no peak caps', async () => {
      analyser.value = 255;
      await create({ analyser: analyser.node, active: true });
      frames.runFor(500);
      analyser.value = 0;

      frames.runFor(300);

      expect(pixel(BARS / 2, 0)[3]).toBe(0);
    });
  });
});
