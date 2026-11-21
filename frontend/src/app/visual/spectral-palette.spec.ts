import {
  frequencyToSpectralPosition,
  SPECTRAL_MAX_HZ,
  SPECTRAL_MIN_HZ,
  SPECTRAL_POSITION_PER_SEMITONE,
  SPECTRAL_STOPS,
  spectralColor,
  spectralPositionToFrequency,
  spectralRgb,
} from './spectral-palette';

/** WCAG relative luminance of an sRGB colour. */
function luminance([r, g, b]: readonly [number, number, number]): number {
  const linear = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

describe('spectral palette', () => {
  describe('frequencyToSpectralPosition', () => {
    it('places the ends of the range at 0 and 1', () => {
      expect(frequencyToSpectralPosition(SPECTRAL_MIN_HZ)).toBe(0);
      expect(frequencyToSpectralPosition(SPECTRAL_MAX_HZ)).toBeCloseTo(1, 10);
    });

    it('clamps frequencies outside the range', () => {
      expect(frequencyToSpectralPosition(10)).toBe(0);
      expect(frequencyToSpectralPosition(22_050)).toBe(1);
    });

    it('maps zero, negative and non-finite input to the low end', () => {
      expect(frequencyToSpectralPosition(0)).toBe(0);
      expect(frequencyToSpectralPosition(-440)).toBe(0);
      expect(frequencyToSpectralPosition(Number.NaN)).toBe(0);
      expect(frequencyToSpectralPosition(Number.POSITIVE_INFINITY)).toBe(0);
    });

    it('gives every octave the same distance', () => {
      const low = frequencyToSpectralPosition(200) - frequencyToSpectralPosition(100);
      const high = frequencyToSpectralPosition(4000) - frequencyToSpectralPosition(2000);

      expect(low).toBeCloseTo(high, 10);
      expect(low).toBeCloseTo(SPECTRAL_POSITION_PER_SEMITONE * 12, 10);
    });
  });

  it('converts positions back to frequencies', () => {
    for (const hz of [60, 440, 1000, 7500]) {
      expect(spectralPositionToFrequency(frequencyToSpectralPosition(hz))).toBeCloseTo(hz, 6);
    }
    expect(spectralPositionToFrequency(-1)).toBe(SPECTRAL_MIN_HZ);
    expect(spectralPositionToFrequency(2)).toBeCloseTo(SPECTRAL_MAX_HZ, 6);
  });

  describe('colours', () => {
    it('starts and ends on the first and last stops', () => {
      expect(spectralRgb(0)).toEqual(hexToRgb(SPECTRAL_STOPS[0]));
      expect(spectralRgb(1)).toEqual(hexToRgb(SPECTRAL_STOPS[SPECTRAL_STOPS.length - 1]));
    });

    it('gets brighter from low to high frequencies', () => {
      let previous = -1;
      for (let i = 0; i <= 64; i++) {
        const current = luminance(spectralRgb(i / 64));
        expect(current).toBeGreaterThanOrEqual(previous);
        previous = current;
      }
    });

    it('formats opaque and translucent CSS colours', () => {
      const [r, g, b] = hexToRgb(SPECTRAL_STOPS[0]);

      expect(spectralColor(0)).toBe(`rgb(${r} ${g} ${b})`);
      expect(spectralColor(0, 0.5)).toBe(`rgb(${r} ${g} ${b} / 0.5)`);
    });

    it('clamps positions outside 0 to 1', () => {
      expect(spectralColor(-3)).toBe(spectralColor(0));
      expect(spectralColor(7)).toBe(spectralColor(1));
      expect(spectralColor(Number.NaN)).toBe(spectralColor(0));
    });
  });
});
