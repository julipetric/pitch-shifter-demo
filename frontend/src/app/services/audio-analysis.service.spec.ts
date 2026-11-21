import { TestBed } from '@angular/core/testing';
import { AudioAnalysisService } from './audio-analysis.service';

const SAMPLE_RATE = 48_000;

interface Tone {
  readonly hz: number;
  readonly gain: number;
}

interface Reading {
  readonly hz: number;
  readonly level: number;
}

/**
 * Feeds the analyser from an offline graph through the protected source seam, so a test
 * decides exactly what the analyser hears and reads it at a fixed point of the render.
 */
class OfflineAnalysisService extends AudioAnalysisService {
  /** Renders `tones` for a quarter of a second, then reads the analysis. */
  async measure(tones: readonly Tone[]): Promise<Reading> {
    const context = new OfflineAudioContext({
      numberOfChannels: 1,
      length: SAMPLE_RATE / 2,
      sampleRate: SAMPLE_RATE,
    });
    const mix = new GainNode(context);
    for (const { hz, gain } of tones) {
      const oscillator = new OscillatorNode(context, { frequency: hz });
      oscillator.connect(new GainNode(context, { gain })).connect(mix);
      oscillator.start();
    }
    this.connectSource(mix);

    let reading: Reading = { hz: Number.NaN, level: Number.NaN };
    const read = context.suspend(0.25).then(() => {
      reading = { hz: this.dominantFrequency(), level: this.level() };
      return context.resume();
    });
    await context.startRendering();
    await read;
    return reading;
  }
}

/** Distance in semitones from one frequency to another. */
function semitones(from: number, to: number): number {
  return 12 * Math.log2(to / from);
}

/** Resolves with 'settled' if `promise` resolves within `ms`, with 'pending' otherwise. */
function settledWithin(promise: Promise<void>, ms: number): Promise<string> {
  const timeout = new Promise<string>((resolve) => setTimeout(() => resolve('pending'), ms));
  return Promise.race([promise.then(() => 'settled'), timeout]);
}

describe('AudioAnalysisService', () => {
  let service: AudioAnalysisService;

  const audioElement = () => document.createElement('audio');

  beforeEach(() => {
    service = TestBed.inject(AudioAnalysisService);
  });

  it('reports silence before a source is attached', () => {
    const bins = new Uint8Array(8).fill(7);

    expect(service.analyser()).toBeNull();
    expect(service.readFrequencies(bins)).toBeFalse();
    expect(Array.from(bins)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(service.level()).toBe(0);
    expect(service.dominantFrequency()).toBe(0);
  });

  it('routes a media element through one analyser', () => {
    expect(service.attach(audioElement())).toBeTrue();

    const analyser = service.analyser();
    expect(analyser).toBeInstanceOf(AnalyserNode);
    expect(analyser?.fftSize).toBe(2048);
  });

  it('attaches the same element only once', () => {
    // A second source node for the same element would throw, so true means none was made.
    const audio = audioElement();
    service.attach(audio);
    const analyser = service.analyser();

    expect(service.attach(audio)).toBeTrue();
    expect(service.analyser()).toBe(analyser);
  });

  it('stays detached where Web Audio is unavailable', () => {
    spyOn(window, 'AudioContext').and.throwError(new ReferenceError('AudioContext is not defined'));

    expect(service.attach(audioElement())).toBeFalse();
    expect(service.analyser()).toBeNull();
  });

  it('stays detached when the element already feeds another context, and closes the context it opened', async () => {
    const audio = audioElement();
    const other = new AudioContext();
    other.createMediaElementSource(audio);
    const close = spyOn(AudioContext.prototype, 'close').and.callThrough();

    expect(service.attach(audio)).toBeFalse();
    expect(service.analyser()).toBeNull();
    expect(close).toHaveBeenCalledTimes(1);

    await other.close();
  });

  it('reads silence from an element that is not playing', () => {
    service.attach(audioElement());
    const bins = new Uint8Array(service.analyser()?.frequencyBinCount ?? 0).fill(7);

    expect(bins.length).toBe(1024);
    expect(service.readFrequencies(bins)).toBeTrue();
    expect(bins.every((value) => value === 0)).toBeTrue();
    expect(service.level()).toBe(0);
    expect(service.dominantFrequency()).toBe(0);
  });

  it('resumes without rejecting, even while the browser keeps the context suspended', async () => {
    await expectAsync(service.resume()).toBeResolved();

    service.attach(audioElement());

    // Without a user gesture the browser holds the resume pending, so the test waits briefly.
    await expectAsync(settledWithin(service.resume(), 100)).toBeResolved();
  });

  it('closes its audio context when destroyed', () => {
    service.attach(audioElement());
    const context = service.analyser()?.context as AudioContext;
    const close = spyOn(context, 'close').and.callThrough();

    service.ngOnDestroy();

    expect(close).toHaveBeenCalled();
    expect(service.analyser()).toBeNull();
    expect(service.level()).toBe(0);
  });

  describe('reading a known signal', () => {
    let offline: OfflineAnalysisService;

    beforeEach(() => {
      offline = new OfflineAnalysisService();
    });

    afterEach(() => offline.ngOnDestroy());

    it('finds the frequency of a pure tone', async () => {
      const { hz } = await offline.measure([{ hz: 440, gain: 0.5 }]);

      expect(Math.abs(semitones(440, hz))).toBeLessThan(0.1);
    });

    it('places a bass note between FFT bins', async () => {
      // Low E. FFT bins are 23.4 Hz apart here, more than a semitone at that pitch.
      const { hz } = await offline.measure([{ hz: 82.41, gain: 0.5 }]);

      expect(Math.abs(semitones(82.41, hz))).toBeLessThan(0.25);
    });

    it('weighs bins by the ear: a 1 kHz tone outweighs a 100 Hz tone of twice its amplitude', async () => {
      const { hz } = await offline.measure([
        { hz: 100, gain: 0.5 },
        { hz: 1000, gain: 0.25 },
      ]);

      expect(Math.abs(semitones(1000, hz))).toBeLessThan(0.1);
    });

    it('measures the RMS level of the signal', async () => {
      const { level } = await offline.measure([{ hz: 440, gain: 0.5 }]);

      expect(level).toBeCloseTo(0.5 / Math.SQRT2, 2);
    });

    it('reports 0 for silence', async () => {
      const { hz, level } = await offline.measure([]);

      expect(hz).toBe(0);
      expect(level).toBe(0);
    });
  });
});
