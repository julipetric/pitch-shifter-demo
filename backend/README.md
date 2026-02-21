# Backend (ASP.NET Core)

This folder will host the ASP.NET Core Minimal API that streams audio and applies pitch/tempo processing.

## Scope
- Minimal API endpoints for chunked audio streaming.
- NAudio for decoding audio into sample buffers.
- Processing pipeline behind an `IAudioProcessor` abstraction to allow swapping implementations.

## Notes
- Keep the API stateless per request to support simple scaling.
- Endpoint shapes and configuration will be defined when the API project is scaffolded.
