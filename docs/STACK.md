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
- **Angular Material**: component library for UI (buttons, sliders, cards, etc.).
- **RxJS**: pitch/tempo slider changes are debounced (`debounceTime` + `distinctUntilChanged`) before a new stream is requested.
- **Web Audio API**: `decodeAudioData` (via WaveSurfer.js) and `OfflineAudioContext` + `AnalyserNode` for waveform/frequency analysis.
- **WaveSurfer.js**: loads and decodes the streams and renders the waveform on a canvas through a custom bar renderer.
- **Canvas 2D**: waveform rendering.
- **Performance patterns**: `ChangeDetectionStrategy.OnPush` on the waveform component, `@defer` for the waveform views, `async` pipe for metadata.

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
- **Waveform analyzer**: WaveSurfer.js decoding + Web Audio `AnalyserNode` for dominant-frequency colouring, drawn on a Canvas in Angular.
- **Performance**: OnPush, debounced slider input, async streaming.
- **Metadata**: `/api/audio/metadata` provides source/processed durations for tempo-aware UI.
- **SOLID/DIP**: `IAudioProcessor` and `IAudioStreamService` interfaces.
- **Networking**: chunked HTTP streaming of MP3; real-time transports such as UDP/RTP are outside the scope of this demo.
