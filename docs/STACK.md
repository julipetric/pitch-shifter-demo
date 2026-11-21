# Stack for Pitch-Shifter Demo

## Goals the stack must support
- Real-time-ish audio playback with pitch/tempo controls.
- Visual comparison of original vs processed waveform.
- Backend-centric processing with a simple Angular client.
- Performance, low latency, and async streaming patterns.
- A demo-friendly, low-cost deployment.

## Core stack
### Frontend (Angular)
- **Angular + TypeScript**: component-based UI and strong typing.
- **Angular Material**: the preserve-pitch slide toggle and tooltips, themed with `mat.theme` and mapped onto the app's design tokens.
- **Design system**: CSS custom properties in `src/styles.scss` (SCSS), self-hosted Oxanium and Barlow fonts (`@fontsource`), and one spectral colour scale (`visual/spectral-palette.ts`) for everything derived from audio.
- **Custom controls**: an SVG rotary knob implementing the WAI-ARIA slider pattern; styled native range inputs for seek and volume; the Popover API for the shortcut reference.
- **RxJS**: tempo and seek changes are debounced (`switchMap` + `timer`, so every change that survives the delay is applied) before a new stream is requested.
- **Web Audio API**: `decodeAudioData` (via WaveSurfer.js) and `OfflineAudioContext` + `AnalyserNode` for waveform/frequency analysis; a live `AnalyserNode` behind the `<audio>` element for the spectrum and the stage light.
- **WaveSurfer.js**: loads and decodes the streams and renders the waveform on a canvas through a custom bar renderer.
- **Canvas 2D**: waveform and spectrum rendering.
- **Performance patterns**: `ChangeDetectionStrategy.OnPush` and signal inputs on the presentational components, `@defer` for the waveform views, `async` pipe for metadata, `requestAnimationFrame` loops outside Angular's zone, and CSS custom properties driving compositor-only transforms for the playhead.

### Backend (.NET)
- **ASP.NET Core Web Minimal API**: streaming endpoints and parameterized audio processing.
- **NAudio** with **NLayer** (managed MP3 decoder): audio file decoding and sample pipeline.
- **SoundTouch.Net**: time-stretching and pitch-shifting behind the `IAudioProcessor` abstraction.
- **NAudio.Lame**: MP3 encoding of processed output.
- **Async I/O**: `async/await` streaming to avoid thread starvation.
 - **Processed output**: MP3 streaming for reduced payload size; range disabled for processed streams.

## Supporting tech
- **Logging**: built-in `ILogger`.
- **Testing**: xUnit for .NET (unit tests plus in-process HTTP tests), Jasmine/Karma for the Angular app.
- **Build/CI**: GitHub Actions builds and tests both halves and smoke-tests the Docker Compose stack.
- **Containers**: Docker Compose runs the API and an nginx-served frontend behind one port.
- **Storage**: a bundled sample audio file (see `Content/Samples/README.md`).

## Deployment (free-tier first)
### Default recommendation
- **Frontend**: Azure Static Web Apps (free tier) for Angular.
- **Backend**: Azure App Service Free (F1) for ASP.NET Core API.

### Alternatives
- **Frontend**: Vercel or Netlify (free tier).
- **Backend**: Render or Fly.io free tier (expect cold starts).

### Trade-offs to call out in the demo
- Cold starts and limited throughput are acceptable for a demo.
- Streaming endpoints should keep payloads small and chunked.
- CORS must be enabled for the hosted frontend.

## Mapping to requirements and showcase concepts
- **Pitch/tempo control**: NAudio decoding and SoundTouch.Net time-stretching/pitch-shifting behind `IAudioProcessor`.
- **Waveform analyzer**: WaveSurfer.js decoding + Web Audio `AnalyserNode` for dominant-frequency colouring, drawn on a Canvas in Angular; a live spectrum of the playing audio.
- **Performance**: OnPush, debounced control input, animation outside the Angular zone, async streaming.
- **Metadata**: `/api/audio/metadata` provides source/processed durations for tempo-aware UI.
- **SOLID/DIP**: `IAudioProcessor` and `IAudioStreamService` interfaces.
- **Networking**: chunked HTTP streaming of MP3; real-time transports such as UDP/RTP are outside the scope of this demo.
