# Proposal: Audio streaming endpoint

## Why

The demo needs a backend endpoint that can stream a static audio file so the frontend (and future pitch/tempo processing) have a reliable source. Implementing this now establishes the streaming contract, configurable sample storage, and async I/O patterns that the rest of the architecture (AudioStreamService, NAudio pipeline, IAudioProcessor) will build on.

## What Changes

- Add a **GET streaming endpoint** (e.g. `GET /api/stream` or `GET /api/audio/stream`) that returns chunked audio for a static sample file.
- Introduce a **configurable sample path** (e.g. via `Audio:SamplesPath` in appsettings) so the file location is not hardcoded; recommend a project-relative folder such as `Content/Samples` for where to place the static file.
- Use **ASP.NET Core Minimal API** and **async streaming** (e.g. `Stream` or chunked response) with **NAudio** for reading/decoding the file, aligned with STACK.md and ARCHITECTURE.md.
- Keep the streaming logic behind an abstraction (e.g. service interface) so the endpoint stays thin and testable (SOLID).

## Capabilities

### New Capabilities

- **audio-stream-endpoint**: Backend exposes a GET endpoint that streams a static audio file from a configured path. The endpoint uses async I/O and NAudio (or equivalent per stack) for decoding; response is chunked. Sample file location is configuration-driven (e.g. `Content/Samples`); no new requirements on existing backend health or project-structure specs.

### Modified Capabilities

- *(none)*

## Impact

- **Backend**: New endpoint, optional new service/interface for streaming, configuration section for sample path. NAudio may be added as a dependency if not already present.
- **APIs**: New GET stream route; contract (query/path params, response headers, supported formats) to be defined in the spec.
- **Storage**: Local filesystem folder for static sample files; path configurable per environment.
- **Systems**: No change to frontend or deployment specs; backend remains stateless and stream-based.
