## 1. Design system

- [x] 1.1 Design tokens (surfaces, text, spectral stops, type scale, spacing, radii, motion) in `styles.scss`
- [x] 1.2 Self-hosted Oxanium and Barlow through `@fontsource` packages
- [x] 1.3 Dark Angular Material theme mapped onto the tokens through M3 system variables
- [x] 1.4 `visual/spectral-palette.ts`: logarithmic frequency scale, OKLab lookup table, lightness-order test
- [x] 1.5 Brand mark, SVG and ICO favicons, page metadata

## 2. Controls

- [x] 2.1 `KnobComponent`: SVG rotary control, WAI-ARIA slider keyboard support, drag, wheel, reset
- [x] 2.2 Tempo and pitch knobs with musical readouts (`music/intervals.ts`)
- [x] 2.3 Pitch knob shows the tape-style shift while pitch preservation is off
- [x] 2.4 Presets (`music/presets.ts`) with active state and indicator lights
- [x] 2.5 Native range inputs for seek and volume, mute toggle
- [x] 2.6 Keyboard shortcuts and the shortcuts popover

## 3. Stage

- [x] 3.1 `AudioAnalysisService`: Web Audio analyser attached on the first Play
- [x] 3.2 `SpectrumAnalyzerComponent`: live log-spaced spectrum that doubles as the colour legend
- [x] 3.3 `StageLightDirective`: glow tinted by the dominant frequency and scaled by level
- [x] 3.4 `WaveformViewComponent`: whole-track views, spectral bar colours, shade and playhead from `--wf-progress`, hover time, click to seek, loading/analysing/error states
- [x] 3.5 Playhead positions written per frame outside the Angular zone

## 4. States and resilience

- [x] 4.1 Server status from the metadata endpoint; retry notice when unreachable
- [x] 4.2 Buffering indicator on the play button; stream error state
- [x] 4.3 Debounced stream updates that never drop a change; immediate updates cancel pending ones

## 5. Verification

- [x] 5.1 Unit tests for the palette, music helpers, knob, analysis service, spectrum, stage light, waveform view and app component
- [x] 5.2 Production build within budgets
- [x] 5.3 Visual check at desktop, laptop and phone sizes against the running API
- [x] 5.4 README, component docs, architecture and stack notes, changelog and screenshots
