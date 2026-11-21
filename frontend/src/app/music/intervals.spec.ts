import {
  describePitchForScreenReader,
  describePitchShift,
  describeTempo,
  formatSemitones,
  formatSpeed,
  formatTempo,
  pitchRatio,
  tapePitchSemitones,
} from './intervals';

describe('intervals', () => {
  describe('describePitchShift', () => {
    it('names the unshifted pitch as the original key', () => {
      expect(describePitchShift(0)).toBe('Original key');
      expect(describePitchShift(-0)).toBe('Original key');
      expect(describePitchShift(Number.NaN)).toBe('Original key');
    });

    it('names whole-semitone intervals with their direction', () => {
      expect(describePitchShift(7)).toBe('Perfect fifth up');
      expect(describePitchShift(-5)).toBe('Perfect fourth down');
      expect(describePitchShift(6)).toBe('Tritone up');
      expect(describePitchShift(12)).toBe('Octave up');
      expect(describePitchShift(-12)).toBe('Octave down');
    });

    it('adds a quarter tone for half-semitone steps', () => {
      expect(describePitchShift(0.5)).toBe('Quarter tone up');
      expect(describePitchShift(2.5)).toBe('Major second and a quarter tone up');
      expect(describePitchShift(-3.5)).toBe('Minor third and a quarter tone down');
    });
  });

  describe('formatSemitones', () => {
    it('signs the value with a plus or a typographic minus', () => {
      expect(formatSemitones(7)).toBe('+7 st');
      expect(formatSemitones(-2.5)).toBe('−2.5 st');
      expect(formatSemitones(0)).toBe('0 st');
    });

    it('rounds derived values to one decimal by default', () => {
      expect(formatSemitones(-3.8631)).toBe('−3.9 st');
      expect(formatSemitones(0.04)).toBe('0 st');
      expect(formatSemitones(10)).toBe('+10 st');
    });

    it('can drop the fraction entirely', () => {
      expect(formatSemitones(10.4, 0)).toBe('+10 st');
      expect(formatSemitones(-1.6, 0)).toBe('−2 st');
    });
  });

  describe('ratios', () => {
    it('doubles frequencies per octave', () => {
      expect(pitchRatio(12)).toBeCloseTo(2, 10);
      expect(pitchRatio(-12)).toBeCloseTo(0.5, 10);
      expect(pitchRatio(7)).toBeCloseTo(1.4983, 4);
    });

    it('lowers the pitch by an octave at half speed without pitch correction', () => {
      expect(tapePitchSemitones(50)).toBeCloseTo(-12, 10);
      expect(tapePitchSemitones(100)).toBe(0);
      expect(tapePitchSemitones(125)).toBeCloseTo(3.863, 3);
      expect(tapePitchSemitones(0)).toBe(0);
    });
  });

  describe('tempo text', () => {
    it('formats the tempo as a percentage and a speed multiplier', () => {
      expect(formatTempo(80)).toBe('80%');
      expect(formatSpeed(80)).toBe('0.80× speed');
      expect(formatSpeed(125)).toBe('1.25× speed');
    });
  });

  describe('screen reader text', () => {
    it('spells out the tempo', () => {
      expect(describeTempo(80)).toBe('80 percent, 0.80 times speed');
    });

    it('spells out the pitch with its interval', () => {
      expect(describePitchForScreenReader(7)).toBe('plus 7 semitones, perfect fifth up');
      expect(describePitchForScreenReader(-1)).toBe('minus 1 semitone, minor second down');
      expect(describePitchForScreenReader(0)).toBe('0 semitones, original key');
    });
  });
});
