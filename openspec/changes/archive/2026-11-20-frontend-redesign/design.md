# Frontend redesign — Design

## Context

- Audience: frontend developers and leads at game studios, watching a short live demo or reading the repository. They judge interaction feel, visual craft, frame-time discipline, accessibility and code structure.
- The backend already streams processed audio and reports durations; the redesign needs no API change.
- The app has one `<audio>` element for playback and two WaveSurfer.js views for the waveforms.

## Goals / Non-Goals

**Goals**

- A distinctive visual identity rooted in the subject: an audio console where colour encodes frequency.
- Make the effect of each parameter visible: colours shift with pitch, waveform length is shared, the pitch control names the interval.
- Tactile, accessible controls that work with mouse, touch, wheel and keyboard.
- No per-frame change detection: animation stays outside Angular's zone.

**Non-Goals**

- A light theme. The waveform area is dark by specification, and the console metaphor is dark throughout.
- Uploading tracks or picking other samples.
- Server-side waveform peaks.

## Decisions

### 1. One spectral scale for all audio-derived colour

- **Decision:** `visual/spectral-palette.ts` maps 50 Hz–10 kHz logarithmically onto five OKLab-interpolated stops (violet, purple, rose, orange, gold) with strictly rising lightness, precomputed into a 256-entry lookup table. Waveform bars, spectrum bars, the pitch knob arc, preset lights and the stage glow all use it. UI chrome stays neutral graphite.
- **Rationale:** a logarithmic scale matches how pitch is heard, so an octave shift moves colours by the same amount anywhere in the track; rising lightness keeps "higher pitch = brighter colour" true and readable on a dark background. A unit test guards the lightness order.

### 2. Whole-track waveforms aligned by musical position

- **Decision:** the original view always loads the original from 0 s; the processed view loads the processed track from 0 s for the current parameters. Seeking reloads only the playback stream.
- **Rationale:** both views span the same musical content across the same width, so x means the same moment in both, clicks map to one position, and seeks no longer reload either waveform.

### 3. Playhead through CSS custom properties

- **Decision:** `AppComponent` writes `--p-original` and `--p-processed` on the waveform container, from a `requestAnimationFrame` loop outside the Angular zone while playing and from `ngAfterViewChecked` otherwise. Each view maps its `--wf-progress` to a compositor-only `transform` on a shade layer whose left edge is the playhead.
- **Rationale:** the playhead moves every frame with no change detection and no layout work.

### 4. Live analysis through Web Audio

- **Decision:** `AudioAnalysisService` routes the `<audio>` element through an `AnalyserNode` on the first Play (a user gesture, so the context may start). `SpectrumAnalyzerComponent` draws 48 log-spaced bars with attack/release ballistics and peak caps; `StageLightDirective` turns the dominant frequency and RMS level into `--stage-glow` and `--stage-glow-level`. Both loops run outside the zone, stop when playback stops and settles, and respect reduced motion.
- **Trade-off:** routing through Web Audio requires CORS-readable media; the element uses `crossorigin="anonymous"`, which the API supports for its allowed origins and which is moot behind the same-origin nginx proxy.

### 5. Custom knobs, themed Material where it fits

- **Decision:** tempo and pitch use `KnobComponent`, an SVG rotary control with the WAI-ARIA slider pattern (arrows, Page Up/Down, Home/End), pointer drag with Shift for fine control, wheel, double-click and a reset button. Seek and volume use styled native range inputs. Pitch mode stays a `mat-slide-toggle`, and tooltips use `MatTooltip`; both follow the app palette through M3 system tokens.
- **Rationale:** knobs are the vernacular of audio hardware and plugins and give finer, more tactile control over a bipolar range; native ranges keep seek and volume simple and fully accessible.

### 6. Presets and shortcuts

- **Decision:** six presets (Original, Slow motion, Practice, Chipmunk, Giant, Nightcore) apply all three parameters at once, keep the musical position and update the stream immediately. A preset counts as active when the current parameters produce the same audio. Shortcuts: Space/K, arrows, `[` `]`, `-` `+`, 0–6, M and `?`, ignored inside text entry and, for Space and arrows, on focused controls.

### 7. Debounced updates that never drop a change

- **Decision:** stream updates go through a `switchMap` + `timer` pipeline; immediate updates (pitch release, presets, pitch mode) first cancel the pending one.
- **Rationale:** a `distinctUntilChanged` on the start offset dropped a second tempo change made at the same position, which is common before playback starts.

## Risks / Trade-offs

- **Two processed requests per parameter change** (playback and waveform), as before; each is processed on the server. Acceptable for a single-user demo.
- **Fonts**: self-hosted through npm packages. The build ships every subset; browsers download only the ones whose `unicode-range` the page uses.
- **Older browsers**: the shortcuts reference uses the Popover API (all evergreen browsers). Without it, the shortcuts still work.
