/**
 * The spectral colour scale. Every colour the app derives from audio comes from here: the
 * waveform bars, the live spectrum, the pitch control and the stage lighting.
 *
 * Frequencies map onto the scale logarithmically, the way pitch is heard: every octave covers
 * the same distance, so a shift of twelve semitones moves a track's colours by the same amount
 * whatever its register. Lightness rises along the scale, so a higher pitch always reads as a
 * brighter colour.
 */

/** Lowest frequency on the scale; anything lower takes the first colour. */
export const SPECTRAL_MIN_HZ = 50;
/** Highest frequency on the scale; anything higher takes the last colour. */
export const SPECTRAL_MAX_HZ = 10_000;

/**
 * Colour stops from low to high frequency, evenly spaced along the scale. `styles.scss`
 * mirrors them as `--spectral-0` to `--spectral-4` for CSS gradients.
 */
export const SPECTRAL_STOPS = ['#6952db', '#b446d3', '#ef5395', '#ff9044', '#fce076'] as const;

/** Distance along the scale covered by one semitone. */
export const SPECTRAL_POSITION_PER_SEMITONE = Math.log(2) / 12 / Math.log(SPECTRAL_MAX_HZ / SPECTRAL_MIN_HZ);

export type Rgb = readonly [number, number, number];

type Oklab = readonly [number, number, number];

/** Entries in the precomputed colour tables, which the canvas renderers read on every frame. */
const LUT_SIZE = 256;

const RGB_LUT: readonly Rgb[] = buildLut();
const CSS_LUT: readonly string[] = RGB_LUT.map(([r, g, b]) => `rgb(${r} ${g} ${b})`);

/** Position (0 to 1) of a frequency on the scale. Non-finite input maps to 0. */
export function frequencyToSpectralPosition(hz: number): number {
  if (!Number.isFinite(hz) || hz <= SPECTRAL_MIN_HZ) return 0;
  return Math.min(1, Math.log(hz / SPECTRAL_MIN_HZ) / Math.log(SPECTRAL_MAX_HZ / SPECTRAL_MIN_HZ));
}

/** Frequency (Hz) at a position of the scale: the inverse of {@link frequencyToSpectralPosition}. */
export function spectralPositionToFrequency(position: number): number {
  return SPECTRAL_MIN_HZ * Math.pow(SPECTRAL_MAX_HZ / SPECTRAL_MIN_HZ, clamp01(position));
}

/** sRGB channels (0 to 255) at a position of the scale. */
export function spectralRgb(position: number): Rgb {
  return RGB_LUT[lutIndex(position)];
}

/** CSS colour at a position of the scale, optionally translucent. */
export function spectralColor(position: number, alpha = 1): string {
  const index = lutIndex(position);
  if (!(alpha < 1)) return CSS_LUT[index];
  const [r, g, b] = RGB_LUT[index];
  return `rgb(${r} ${g} ${b} / ${clamp01(alpha)})`;
}

function lutIndex(position: number): number {
  return Math.round(clamp01(position) * (LUT_SIZE - 1));
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** Interpolates between the stops in OKLab, which keeps the blends free of muddy midpoints. */
function buildLut(): Rgb[] {
  const stops = SPECTRAL_STOPS.map((hex) => linearToOklab(hexToLinear(hex)));
  const segments = stops.length - 1;
  const lut: Rgb[] = [];
  for (let i = 0; i < LUT_SIZE; i++) {
    const scaled = (i / (LUT_SIZE - 1)) * segments;
    const segment = Math.min(segments - 1, Math.floor(scaled));
    const t = scaled - segment;
    const from = stops[segment];
    const to = stops[segment + 1];
    const mixed: Oklab = [
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t,
      from[2] + (to[2] - from[2]) * t,
    ];
    lut.push(linearToSrgb8(oklabToLinear(mixed)));
  }
  return lut;
}

function hexToLinear(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => srgbToLinear(((value >> shift) & 0xff) / 255);
  return [channel(16), channel(8), channel(0)];
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb8([r, g, b]: Rgb): Rgb {
  const encode = (c: number) => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(clamp01(v) * 255);
  };
  return [encode(r), encode(g), encode(b)];
}

// OKLab conversion matrices from Björn Ottosson, "A perceptual color space for image processing".
function linearToOklab([r, g, b]: Rgb): Oklab {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinear([L, a, b]: Oklab): Rgb {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
