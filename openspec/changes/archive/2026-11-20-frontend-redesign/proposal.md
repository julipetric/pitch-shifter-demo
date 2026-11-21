## Why

The demo is shown to frontend teams at game studios. The first interface proved the audio pipeline, but it was a stack of default Material sliders in two cards: it did not show what the processing does to the sound, how the controls feel, or the level of polish a game-facing frontend needs. The waveforms also showed a snippet that restarted at every seek, with a playhead that did not match the snippet on screen.

## What Changes

- **Visual identity**: a dark "audio console" theme with design tokens, self-hosted Oxanium and Barlow fonts, and one spectral colour scale (violet to gold, logarithmic in frequency) used for everything derived from audio.
- **Stage**: track header, live spectrum analyser, both waveforms and the transport in one panel, lit from behind by a glow that follows the dominant frequency of what is playing.
- **Waveforms**: each view shows the whole track, so original and processed line up by musical position; bars are coloured on the spectral scale, so a pitch shift visibly moves the colours; clicking a waveform seeks; the playhead moves every frame through a CSS custom property, outside change detection.
- **Controls**: rotary knobs for tempo and pitch (drag, wheel, keyboard, double-click to reset, WAI-ARIA slider semantics); the pitch knob names the interval and, with pitch preservation off, shows the shift caused by the speed change; six presets with indicator lights; mute; keyboard shortcuts with an on-screen reference.
- **States**: connection status, a retry notice when the API is unreachable, buffering feedback on the play button, an explicit empty state for the processed lane.
- **Fixes in the transport logic**: a second tempo change at the same playback position is no longer dropped by the update debounce; presets and pitch commits cancel a pending debounced update.

## Capabilities

### Modified Capabilities

- `frontend-app`: themed Angular Material components inside a custom design system; self-hosted fonts.
- `frontend-audio-transport`: custom accessible controls for tempo, pitch, seek and volume; presets; keyboard shortcuts; connection and buffering states.
- `frontend-waveform-analyzer`: whole-track views, spectral colouring, click to seek, frame-accurate playhead, live spectrum analyser and stage light.

## Impact

- **Frontend only**; the API contract is unchanged. The `<audio>` element is routed through a Web Audio analyser, so it requests streams with `crossorigin="anonymous"` (the API already sends CORS headers to allowed origins and is same-origin behind nginx).
- **Dependencies**: `@fontsource-variable/oxanium` and `@fontsource/barlow` (self-hosted fonts). Global styles move to SCSS for the Material theme.
- **Build**: the per-component style budget rises to 8 kB (warning) / 16 kB (error).
