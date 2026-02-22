# Backend (ASP.NET Core)

This folder hosts the ASP.NET Core Minimal API that streams audio and applies pitch/tempo processing.
The backend project lives at `backend/pitch-shifter-demo-backend`.

## Scope
- Minimal API endpoints for chunked audio streaming.
- NAudio for decoding audio into sample buffers.
- Processing pipeline behind an `IAudioProcessor` abstraction to allow swapping implementations.

## Audio stream endpoint
- **`GET /api/audio/stream`** — streams the default static audio sample (chunked).
- Sample path is configurable via **`Audio:SamplesPath`** in appsettings (default: `Content/Samples`).
- Optional **`Audio:DefaultFileName`** selects which file to stream; if omitted, the first supported file in the samples folder is used.
- **Where to put the audio file:** place your demo file in `pitch-shifter-demo-backend/Content/Samples/` (or the path you set in `Audio:SamplesPath`). Supported formats: MP3, WAV, OGG, M4A, AAC.

## Notes
- Keep the API stateless per request to support simple scaling.

## Azure Deployment
- See `docs/AZURE-BACKEND-DEPLOY.md` for Azure App Service deployment steps and configuration guidance.
