import { Injectable, OnDestroy, Signal, signal } from '@angular/core';
import { SPECTRAL_MAX_HZ, SPECTRAL_MIN_HZ } from '../visual/spectral-palette';

/** Samples per analysis window: about 43 ms of audio at 48 kHz, in bins about 23 Hz wide. */
const FFT_SIZE = 2048;

/**
 * Share of the previous spectrum kept in each new one. It damps the frame-to-frame flicker of
 * the FFT while drum hits still stand out.
 */
const SMOOTHING_TIME_CONSTANT = 0.75;

/**
 * Decibel range spread over the byte spectrum (0 to 255). A full-scale sine peaks near -14 dB
 * in the analyser's units, so loud masters stay under the ceiling and quiet passages above the
 * floor.
 */
const MIN_DECIBELS = -90;
const MAX_DECIBELS = -10;

/** Bins quieter than this (dB) count as silence when looking for the dominant frequency. */
const DOMINANT_FLOOR_DB = -70;

/** The analyser node with the buffers and tables its readers reuse on every frame. */
interface Analysis {
  readonly node: AnalyserNode;
  readonly waveform: Float32Array;
  readonly spectrumDb: Float32Array;
  /** A-weighting of each bin, in dB. */
  readonly weightDb: Float32Array;
  readonly binHz: number;
  /** First and last bins inside the spectral scale; each has a neighbour on both sides. */
  readonly firstBin: number;
  readonly lastBin: number;
}

/**
 * Routes the app's media element through a Web Audio analyser so the UI can visualise what is
 * playing, and reads that analyser once per animation frame.
 *
 * The readers reuse buffers allocated with the analyser, so calling them every frame allocates
 * nothing. Until a source is attached they report silence.
 */
@Injectable({ providedIn: 'root' })
export class AudioAnalysisService implements OnDestroy {
  private readonly node = signal<AnalyserNode | null>(null);

  /** The analyser fed by the attached element; null until {@link attach} succeeds. */
  readonly analyser: Signal<AnalyserNode | null> = this.node.asReadonly();

  private context: AudioContext | null = null;
  private element: HTMLMediaElement | null = null;
  private source: AudioNode | null = null;
  private analysis: Analysis | null = null;

  /**
   * Routes `element` through the analyser to the speakers: element → analyser → destination.
   * The first call creates the audio context, so make it from a user gesture such as the Play
   * click: browsers let a context start only after one. Calling it again with the same element
   * does nothing. Attaching a different element moves the analysis to it and silences the
   * previous one, which Web Audio cannot release from the graph.
   *
   * Once attached, the element is heard only through the graph:
   * - While the context is suspended the element plays silently; {@link resume} starts it.
   * - A cross-origin stream must be fetched with CORS (`crossorigin="anonymous"` on the element
   *   and an `Access-Control-Allow-Origin` header from the server). The browser feeds the graph
   *   silence for media the page is not allowed to read.
   *
   * Returns false, and the element keeps playing directly, when Web Audio is unavailable or
   * the graph cannot be built, for example because the element already feeds another context.
   */
  attach(element: HTMLMediaElement): boolean {
    if (element === this.element) return true;
    let context = this.context;
    try {
      context ??= new AudioContext();
      this.connectSource(context.createMediaElementSource(element));
    } catch {
      // A context opened by this call has nothing to play and would only hold the audio device.
      if (context && context !== this.context) void context.close().catch(() => undefined);
      return false;
    }
    this.context = context;
    this.element = element;
    return true;
  }

  /**
   * Starts the audio context if it is suspended. Browsers keep a new context suspended until a
   * user gesture allows audio, and the attached element is silent meanwhile, so call this from
   * every gesture that starts playback. The promise never rejects, but without a gesture the
   * browser may hold it pending until the next one: start playback without waiting for it.
   */
  async resume(): Promise<void> {
    const context = this.context;
    if (!context || context.state === 'running' || context.state === 'closed') return;
    try {
      await context.resume();
    } catch {
      // The context stays suspended; the next gesture tries again.
    }
  }

  /**
   * Copies the current byte spectrum into `target`: one value per FFT bin, 0 to 255 across the
   * analyser's decibel range. Without an analyser it fills `target` with zeros and returns false.
   */
  readFrequencies(target: Uint8Array): boolean {
    const analysis = this.analysis;
    if (!analysis) {
      target.fill(0);
      return false;
    }
    analysis.node.getByteFrequencyData(target);
    return true;
  }

  /** RMS level of the current analysis window, from 0 (silence) to 1 (a full-scale square wave). */
  level(): number {
    const analysis = this.analysis;
    if (!analysis) return 0;
    const samples = analysis.waveform;
    analysis.node.getFloatTimeDomainData(samples);
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    return Math.min(1, Math.sqrt(sum / samples.length));
  }

  /**
   * Frequency (Hz) that sounds loudest right now between SPECTRAL_MIN_HZ and SPECTRAL_MAX_HZ, or
   * 0 when nothing in that range rises above the noise floor.
   *
   * Bins are compared after A-weighting (IEC 61672), the standard model of the ear's
   * sensitivity: the low bins carry most of a mix's energy but sound quieter than the mids at
   * the same level. The peak is then placed between bins with a parabola through its
   * neighbours, because below about 400 Hz a bin is wider than a semitone.
   */
  dominantFrequency(): number {
    const analysis = this.analysis;
    if (!analysis) return 0;
    const { spectrumDb, weightDb } = analysis;
    analysis.node.getFloatFrequencyData(spectrumDb);
    let loudestBin = -1;
    let loudest = Number.NEGATIVE_INFINITY;
    for (let bin = analysis.firstBin; bin <= analysis.lastBin; bin++) {
      const db = spectrumDb[bin];
      if (db < DOMINANT_FLOOR_DB) continue;
      const heard = db + weightDb[bin];
      if (heard > loudest) {
        loudest = heard;
        loudestBin = bin;
      }
    }
    if (loudestBin < 0) return 0;
    const hz = (loudestBin + peakOffset(spectrumDb, loudestBin)) * analysis.binHz;
    return Math.min(SPECTRAL_MAX_HZ, Math.max(SPECTRAL_MIN_HZ, hz));
  }

  ngOnDestroy(): void {
    const context = this.context;
    this.context = null;
    this.element = null;
    this.source = null;
    this.analysis = null;
    this.node.set(null);
    void context?.close().catch(() => undefined);
  }

  /**
   * Feeds `source` into the analyser, which is created in the source's context on first use,
   * and disconnects the source fed before. {@link attach} routes media elements through here;
   * a subclass can feed any other node of the same context, such as an offline graph in tests.
   */
  protected connectSource(source: AudioNode): void {
    const analysis = (this.analysis ??= createAnalysis(source.context));
    source.connect(analysis.node);
    if (this.source !== source) this.source?.disconnect();
    this.source = source;
    this.node.set(analysis.node);
  }
}

function createAnalysis(context: BaseAudioContext): Analysis {
  const node = new AnalyserNode(context, {
    fftSize: FFT_SIZE,
    smoothingTimeConstant: SMOOTHING_TIME_CONSTANT,
    minDecibels: MIN_DECIBELS,
    maxDecibels: MAX_DECIBELS,
  });
  node.connect(context.destination);
  const bins = node.frequencyBinCount;
  const binHz = context.sampleRate / node.fftSize;
  const weightDb = new Float32Array(bins);
  for (let bin = 1; bin < bins; bin++) weightDb[bin] = aWeightingDb(bin * binHz);
  return {
    node,
    waveform: new Float32Array(node.fftSize),
    spectrumDb: new Float32Array(bins),
    weightDb,
    binHz,
    firstBin: Math.max(1, Math.ceil(SPECTRAL_MIN_HZ / binHz)),
    lastBin: Math.min(bins - 2, Math.floor(SPECTRAL_MAX_HZ / binHz)),
  };
}

/** A-weighting (IEC 61672-1) in dB: the ear's sensitivity at `hz` relative to 1 kHz. */
function aWeightingDb(hz: number): number {
  const f2 = hz * hz;
  const response =
    (12194 ** 2 * f2 * f2) /
    ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
  return 20 * Math.log10(response) + 2;
}

/**
 * Offset in bins (-1 to 1) of the true peak from `bin`, from the vertex of the parabola through
 * the bin and its neighbours in dB. A Blackman-windowed peak is close to a parabola on that
 * scale, so the estimate lands within a few hertz.
 */
function peakOffset(spectrumDb: Float32Array, bin: number): number {
  const below = spectrumDb[bin - 1];
  const above = spectrumDb[bin + 1];
  const curvature = below - 2 * spectrumDb[bin] + above;
  if (!Number.isFinite(curvature) || curvature >= 0) return 0;
  return Math.min(1, Math.max(-1, (0.5 * (below - above)) / curvature));
}
