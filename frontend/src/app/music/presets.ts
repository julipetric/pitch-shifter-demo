import { AudioProcessingParams } from '../services/audio-api.service';

/** A named combination of processing parameters, applied in one click. */
export interface ProcessingPreset {
  readonly id: string;
  readonly name: string;
  /** What the preset sets, shown under its name. */
  readonly detail: string;
  /** What it sounds like, shown as a tooltip. */
  readonly description: string;
  readonly params: AudioProcessingParams;
}

/** Presets in display order; the number keys 1 to 6 select them in the same order. */
export const PRESETS: readonly ProcessingPreset[] = [
  {
    id: 'original',
    name: 'Original',
    detail: '100%, original key',
    description: 'The recording as published.',
    params: { tempoPercent: 100, preservePitch: true, pitchSemitones: 0 },
  },
  {
    id: 'slow-motion',
    name: 'Slow motion',
    detail: '60%, pitch follows',
    description: 'Speed and pitch drop together, like slowing a tape: the bullet-time sound.',
    params: { tempoPercent: 60, preservePitch: false, pitchSemitones: 0 },
  },
  {
    id: 'practice',
    name: 'Practice',
    detail: '75%, original key',
    description: 'Slower but in the same key, for learning a part by ear.',
    params: { tempoPercent: 75, preservePitch: true, pitchSemitones: 0 },
  },
  {
    id: 'chipmunk',
    name: 'Chipmunk',
    detail: '+12 st',
    description: 'One octave up at the original speed.',
    params: { tempoPercent: 100, preservePitch: true, pitchSemitones: 12 },
  },
  {
    id: 'giant',
    name: 'Giant',
    detail: '−12 st',
    description: 'One octave down at the original speed.',
    params: { tempoPercent: 100, preservePitch: true, pitchSemitones: -12 },
  },
  {
    id: 'nightcore',
    name: 'Nightcore',
    detail: '125%, pitch follows',
    description: 'Speed and pitch rise together, the sped-up remix sound.',
    params: { tempoPercent: 125, preservePitch: false, pitchSemitones: 0 },
  },
];

/**
 * Whether two parameter sets produce the same audio. The semitone offset only applies with
 * pitch preservation on, and at 100% tempo preservation changes nothing.
 */
export function soundsTheSame(a: AudioProcessingParams, b: AudioProcessingParams): boolean {
  const left = effective(a);
  const right = effective(b);
  return (
    left.tempoPercent === right.tempoPercent &&
    left.preservePitch === right.preservePitch &&
    left.pitchSemitones === right.pitchSemitones
  );
}

/** The preset that produces the same audio as `params`, if any. */
export function findPreset(params: AudioProcessingParams): ProcessingPreset | null {
  return PRESETS.find((preset) => soundsTheSame(preset.params, params)) ?? null;
}

function effective(params: AudioProcessingParams): AudioProcessingParams {
  const pitchSemitones = params.preservePitch ? params.pitchSemitones : 0;
  const preservePitch = params.tempoPercent === 100 ? true : params.preservePitch;
  return { tempoPercent: params.tempoPercent, preservePitch, pitchSemitones };
}
