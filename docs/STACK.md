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
- **RxJS**: input streams for pitch/tempo sliders with `debounceTime` or `throttleTime`.
- **Web Audio API**: `AudioContext`, `AnalyserNode` for waveform/frequency analysis.
- **Canvas 2D**: efficient waveform rendering.
- **Performance patterns**: `ChangeDetectionStrategy.OnPush`, `trackBy` in lists, `async` pipe.

### Backend (.NET)
- **ASP.NET Core Web Minimal API**: streaming endpoints and parameterized audio processing.
- **NAudio**: audio file decoding and sample pipeline.
- **Custom processing layer**: `IAudioProcessor` abstraction and an `ISampleProvider`-style implementation for pitch/tempo changes.
- **Async I/O**: `async/await` streaming to avoid thread starvation.

## Supporting tech
- **Logging**: built-in `ILogger` (optional Serilog later).
- **Testing**: xUnit for .NET, Angular test runner for UI components and waveform logic.
- **Build/CI**: GitHub Actions for simple build/test pipelines.
- **Storage**: local sample audio files (demo) with optional user upload in future.

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
- **Pitch/tempo control**: .NET processing layer using NAudio + custom logic.
- **Waveform analyzer**: Web Audio API `AnalyserNode` + Canvas in Angular.
- **Performance**: OnPush, RxJS throttle/debounce, async streaming.
- **SOLID/DIP**: `IAudioProcessor` and `IAudioSource` interfaces.
- **Networking awareness**: chunked HTTP streaming now; UDP/RTP discussion for future improvements.
