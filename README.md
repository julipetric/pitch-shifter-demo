# Pitch-Shifter Demo

A web app for real-time pitch and tempo adjustment of audio: Angular frontend with waveform comparison and a .NET streaming API for server-side processing.

---

## Overview

This project demonstrates a full-stack audio workflow: stream audio from a .NET backend with on-the-fly pitch and tempo controls, and visualize the original and processed signal in the browser. The backend handles decoding and processing; the frontend provides playback, controls, and dual waveform analysis using the Web Audio API.

## Features

- **Pitch and tempo control** — Adjust pitch and tempo in real time via sliders; processing runs on the backend.
- **Dual waveform view** — Side-by-side visualization of the original and processed waveform over a configurable time window, with periodic redraw for performance.
- **Streaming playback** — Chunked HTTP streaming from the API so playback can start without loading the full file.
- **Stateless API** — No server-side session state; each request is independent for simpler scaling.
- **Extensible processing** — Audio processing is behind an abstraction (`IAudioProcessor`) so implementations (e.g. simple stretch vs phase-vocoder style) can be swapped without changing the API.

## Architecture

High-level flow:

```
User → Angular app → .NET API → Audio processing → Audio file store
```

- **Frontend (Angular):** Player UI (track choice, play/pause, pitch/tempo sliders), two canvases for original vs processed waveform, a service that builds the Web Audio graph for analysis, and a client that calls the streaming endpoint with pitch/tempo parameters.
- **Backend (.NET):** Streaming HTTP endpoint that orchestrates file read, optional processing, and chunked response. Uses NAudio for decoding and a pluggable processing layer.
- **Processing:** Isolated behind `IAudioProcessor`; the pipeline can use a simple time-stretch implementation first and later swap in custom (e.g. phase vocoder) logic.

Request/streaming flow:

1. User changes pitch/tempo in the UI (sliders are debounced/throttled via RxJS).
2. Frontend requests the stream from the API with current parameters.
3. API reads the source file, runs it through the processor, and streams chunks back.
4. Browser plays the stream and feeds it into the Web Audio analyser.
5. Canvas components render the two waveforms from the analyser data.

Non-functional goals: low latency (chunked streaming, small buffers, async I/O), responsive UI (OnPush, throttled events), and stateless scalability. If processing fails, the API can fall back to streaming the original audio.

## Tech stack

| Layer        | Technology |
|-------------|------------|
| **Frontend** | Angular, TypeScript, RxJS, Web Audio API (`AudioContext`, `AnalyserNode`), Canvas 2D |
| **Backend**  | ASP.NET Core (Minimal API), NAudio, custom `IAudioProcessor` / `ISampleProvider`-style pipeline |
| **Patterns** | `ChangeDetectionStrategy.OnPush`, `trackBy`, `async` pipe; `debounceTime`/`throttleTime` on slider inputs; async streaming |
| **Testing**  | xUnit (backend), Angular test runner (frontend) |
| **Deploy**   | Frontend: Azure Static Web Apps or Vercel/Netlify (free tier). Backend: Azure App Service Free or Render/Fly.io. |

CORS is enabled on the API for the hosted frontend. Cold starts and limited throughput are acceptable for this demo; sample files are kept small.

## Project structure

- `docs/` — Architecture (`ARCHITECTURE.md`), stack (`STACK.md`), and other design notes. To deploy the frontend to Azure, see [Deploy frontend to Azure](docs/azure-frontend-deploy.md).
- Frontend and backend source live in their respective directories (e.g. `src/` or `client/` and `api/` or `server/`, depending on your layout).

## Getting started

0. **Setup:** Install required tools using `docs/SETUP.md` (includes bootstrap scripts).
1. **Backend:** From the API project folder, restore and run the ASP.NET Core app (see any `README` or solution in the repo). Ensure the streaming endpoint and CORS are configured as in `docs/ARCHITECTURE.md`.
2. **Frontend:** From the Angular project folder, run `npm install` and `ng serve` (or your configured command). Point the app at the API base URL (env or config).
3. Use the player to select a track, adjust pitch/tempo, and watch the waveform comparison.

For deployment, use the free-tier options above; keep sample audio small and be aware of cold starts on serverless/free backends.

## License

See the repository for license information.
