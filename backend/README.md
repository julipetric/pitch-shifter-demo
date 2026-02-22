# Backend (ASP.NET Core)

This folder hosts the ASP.NET Core Minimal API that streams audio and applies pitch/tempo processing.
The backend project lives at `backend/pitch-shifter-demo-backend`.

## Scope
- Minimal API endpoints for chunked audio streaming.
- NAudio for decoding audio into sample buffers.
- Processing pipeline behind an `IAudioProcessor` abstraction to allow swapping implementations.

## Notes
- Keep the API stateless per request to support simple scaling.

## Azure Deployment
- See `docs/AZURE-BACKEND-DEPLOY.md` for Azure App Service deployment steps and configuration guidance.
