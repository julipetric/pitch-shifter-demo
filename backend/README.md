# Backend (ASP.NET Core)

This folder hosts the ASP.NET Core Minimal API that streams audio and applies pitch/tempo processing.
The backend project lives at `backend/pitch-shifter-demo-backend`.

## Scope
- Minimal API endpoints for chunked audio streaming.
- NAudio for decoding audio into sample buffers.
- Processing pipeline behind an `IAudioProcessor` abstraction to allow swapping implementations.

## Audio stream endpoint
- **`GET /api/audio/stream`** — streams the default static audio sample (chunked).
  - Optional query params: `tempoPercent` (50–125), `preservePitch` (true/false), `pitchSemitones` (-12 to 12 in 0.5 steps), `startSeconds` (offset on processed timeline).
  - Defaults: `tempoPercent=100`, `preservePitch=true`, `pitchSemitones=0`.
  - Processed responses are streamed as MP3 (`audio/mpeg`) to reduce size; default (unprocessed) streams keep the original content type.
- Sample path is configurable via **`Audio:SamplesPath`** in appsettings (default: `Content/Samples`).

## Audio metadata endpoint
- **`GET /api/audio/metadata`** — returns source and processed duration in seconds for the default sample.
- Uses the same processing params as the stream endpoint to compute the processed duration.
- Optional **`Audio:DefaultFileName`** selects which file to stream; if omitted, the first supported file in the samples folder is used.
- **Where to put the audio file:** place your demo file in `pitch-shifter-demo-backend/Content/Samples/` (or the path you set in `Audio:SamplesPath`). Supported formats: MP3, WAV, OGG, M4A, AAC.

## Notes
- Keep the API stateless per request to support simple scaling.

## Azure Deployment
- See `docs/AZURE-BACKEND-DEPLOY.md` for Azure App Service deployment steps and configuration guidance.
