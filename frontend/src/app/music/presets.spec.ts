import { findPreset, PRESETS, soundsTheSame } from './presets';

describe('presets', () => {
  it('has unique ids and starts with the unprocessed original', () => {
    const ids = PRESETS.map((preset) => preset.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(PRESETS[0].params).toEqual({ tempoPercent: 100, preservePitch: true, pitchSemitones: 0 });
  });

  it('keeps every preset inside the ranges the API accepts', () => {
    for (const { params } of PRESETS) {
      expect(params.tempoPercent).toBeGreaterThanOrEqual(50);
      expect(params.tempoPercent).toBeLessThanOrEqual(125);
      expect(Math.abs(params.pitchSemitones)).toBeLessThanOrEqual(12);
      expect((params.pitchSemitones * 2) % 1).toBe(0);
    }
  });

  it('finds the preset matching a parameter set', () => {
    expect(findPreset({ tempoPercent: 100, preservePitch: true, pitchSemitones: 12 })?.id).toBe('chipmunk');
    expect(findPreset({ tempoPercent: 60, preservePitch: false, pitchSemitones: 0 })?.id).toBe('slow-motion');
    expect(findPreset({ tempoPercent: 90, preservePitch: true, pitchSemitones: 0 })).toBeNull();
  });

  it('ignores the semitone offset while pitch preservation is off', () => {
    expect(soundsTheSame(
      { tempoPercent: 60, preservePitch: false, pitchSemitones: 5 },
      { tempoPercent: 60, preservePitch: false, pitchSemitones: 0 },
    )).toBeTrue();
  });

  it('treats 100% tempo the same with or without pitch preservation', () => {
    expect(findPreset({ tempoPercent: 100, preservePitch: false, pitchSemitones: 0 })?.id).toBe('original');
  });

  it('tells apart a time stretch from a tape-style speed change', () => {
    expect(soundsTheSame(
      { tempoPercent: 75, preservePitch: true, pitchSemitones: 0 },
      { tempoPercent: 75, preservePitch: false, pitchSemitones: 0 },
    )).toBeFalse();
  });
});
