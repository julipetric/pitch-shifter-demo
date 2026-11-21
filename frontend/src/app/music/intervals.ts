/**
 * Musical descriptions of the processing parameters, for readouts and assistive technology.
 * Displayed numbers use the typographic minus sign (U+2212).
 */

const MINUS = '−';

/** Interval names within one octave, indexed by their size in semitones. */
const INTERVAL_NAMES = [
  'Unison',
  'Minor second',
  'Major second',
  'Minor third',
  'Major third',
  'Perfect fourth',
  'Tritone',
  'Perfect fifth',
  'Minor sixth',
  'Major sixth',
  'Minor seventh',
  'Major seventh',
  'Octave',
] as const;

/** Shifts smaller than this count as no shift at all. */
const EPSILON = 1e-6;

/**
 * Plain-language name of a pitch shift: "Perfect fifth up", "Octave down", "Original key".
 * The pitch control moves in half-semitone steps; the extra half is a quarter tone.
 */
export function describePitchShift(semitones: number): string {
  const magnitude = Math.abs(semitones);
  if (!Number.isFinite(semitones) || magnitude < EPSILON) return 'Original key';

  const direction = semitones > 0 ? 'up' : 'down';
  const whole = Math.floor(magnitude + EPSILON);
  const quarterTone = magnitude - whole >= 0.25;

  if (whole === 0) return `Quarter tone ${direction}`;
  const name = INTERVAL_NAMES[Math.min(whole, INTERVAL_NAMES.length - 1)];
  return quarterTone ? `${name} and a quarter tone ${direction}` : `${name} ${direction}`;
}

/** Signed semitone readout: "+7 st", "−2.5 st", "0 st". */
export function formatSemitones(semitones: number, maxFractionDigits = 1): string {
  const value = roundTo(semitones, maxFractionDigits);
  if (value === 0) return '0 st';
  const digits = trimNumber(Math.abs(value), maxFractionDigits);
  return `${value > 0 ? '+' : MINUS}${digits} st`;
}

/** Frequency ratio of a pitch shift: twelve semitones double every frequency. */
export function pitchRatio(semitones: number): number {
  return Math.pow(2, semitones / 12);
}

/**
 * Pitch change, in semitones, of playing audio at another speed without pitch correction,
 * the way a tape machine or turntable does: half speed drops a whole octave.
 */
export function tapePitchSemitones(tempoPercent: number): number {
  if (!Number.isFinite(tempoPercent) || tempoPercent <= 0) return 0;
  return 12 * Math.log2(tempoPercent / 100);
}

/** Tempo readout: "80%". */
export function formatTempo(tempoPercent: number): string {
  return `${Math.round(tempoPercent)}%`;
}

/** Playback speed as a multiplier: "0.80× speed". */
export function formatSpeed(tempoPercent: number): string {
  return `${(tempoPercent / 100).toFixed(2)}× speed`;
}

/** Spoken value of the tempo control: "80 percent, 0.80 times speed". */
export function describeTempo(tempoPercent: number): string {
  return `${Math.round(tempoPercent)} percent, ${(tempoPercent / 100).toFixed(2)} times speed`;
}

/** Spoken value of the pitch control: "plus 7 semitones, perfect fifth up". */
export function describePitchForScreenReader(semitones: number): string {
  const value = roundTo(semitones, 1);
  if (value === 0) return '0 semitones, original key';
  const sign = value > 0 ? 'plus' : 'minus';
  const amount = trimNumber(Math.abs(value), 1);
  const unit = Math.abs(value) === 1 ? 'semitone' : 'semitones';
  return `${sign} ${amount} ${unit}, ${describePitchShift(value).toLowerCase()}`;
}

function roundTo(value: number, fractionDigits: number): number {
  if (!Number.isFinite(value)) return 0;
  const factor = Math.pow(10, fractionDigits);
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function trimNumber(value: number, maxFractionDigits: number): string {
  const fixed = value.toFixed(maxFractionDigits);
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
}
