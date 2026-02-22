# Design: Audio streaming endpoint

## Context

The backend is an ASP.NET Core Minimal API with a health endpoint only. The stack (STACK.md) and architecture (ARCHITECTURE.md) define: ASP.NET Core for streaming, NAudio for decoding, async I/O, and abstractions (e.g. IAudioProcessor, IAudioSource) for SOLID and testability. This change adds a single GET endpoint that streams a static audio file from a configured path to establish the streaming contract and patterns before adding pitch/tempo processing.

## Goals / Non-Goals

**Goals:**
- Expose a GET stream endpoint that returns chunked audio from a static file.
- Use a configurable sample path (e.g. `Audio:SamplesPath`) so file location is not hardcoded and can vary by environment.
- Keep the endpoint thin by delegating to a streaming service behind an interface (DIP, testability).
- Use NAudio for reading/decoding and async streaming to avoid thread starvation.

**Non-Goals:**
- Pitch/tempo processing, IAudioProcessor implementation, or query parameters for processing (future change).
- User upload or dynamic file selection; one static sample (e.g. by filename or default) is sufficient for this change.
- Range requests (206), multiple formats, or content negotiation beyond a single supported format.

## Decisions

### 1. Where to store the static sample file
- **Decision:** Store sample files in a project-relative folder such as `Content/Samples` (under the API project), with the actual path read from configuration (`Audio:SamplesPath`). Do not serve from `wwwroot`; the stream endpoint reads the file via the service and returns bytes.
- **Rationale:** Separates “streaming source” from “static web content”; aligns with ARCHITECTURE’s AudioFileStore; allows different paths per environment (e.g. dev vs deployed).
- **Alternatives considered:** `wwwroot` (rejected: mixes static file serving with our streaming API); absolute path only in config (acceptable; we support both relative and absolute in config).

### 2. Streaming service abstraction
- **Decision:** Introduce an interface (e.g. `IAudioStreamService` or `IAudioStreamProvider`) with a method that returns a stream (or stream + content type) for a given sample key or default. The Minimal API endpoint calls this interface and returns the result (e.g. `Results.Stream()`) with appropriate headers.
- **Rationale:** Keeps the endpoint a thin adapter; allows unit testing with a fake provider and future swapping (e.g. different storage backends) without changing the API.
- **Alternatives considered:** Inline logic in the endpoint (rejected: harder to test and violates SRP).

### 3. Configuration for sample path
- **Decision:** Use the Options pattern: add an `AudioOptions` (or similar) class with a `SamplesPath` property bound to `Audio:SamplesPath`. Resolve path at runtime (e.g. resolve relative to app base or use as absolute). Validate or fail fast if path is missing when the stream is first requested (or at startup if preferred).
- **Rationale:** Standard ASP.NET Core practice; supports environment-specific config and keeps the service decoupled from concrete paths.

### 4. NAudio usage for this endpoint
- **Decision:** Use NAudio to open the file and obtain a stream of audio bytes (e.g. decode to a format the client can play, or stream raw file bytes with correct Content-Type). Prefer streaming (read chunks) rather than loading the entire file into memory. If the first iteration is “stream file bytes as-is,” NAudio can still be used to validate/open the file and then stream the underlying file stream in chunks.
- **Rationale:** Aligns with stack and architecture; sets the pattern for when we add decoding + IAudioProcessor later. Keeps memory use bounded.
- **Alternatives considered:** Raw `File.OpenRead` only (rejected: stack specifies NAudio; we want one consistent pipeline).

### 5. Route and response shape
- **Decision:** Single route, e.g. `GET /api/audio/stream`. Optional query or route parameter for “sample” if we support multiple files later; for this change a default file (e.g. single file in `Content/Samples` or configured default filename) is acceptable. Response: HTTP 200, chunked body, `Content-Type` set from file extension or NAudio (e.g. `audio/mpeg`, `audio/wav`). On missing file or config: 404 (or 500 if config invalid at startup).
- **Rationale:** Simple contract for the frontend; easy to extend later with query params for pitch/tempo and sample id.

## Risks / Trade-offs

- **[Risk]** Large files or many concurrent streams could increase memory or I/O load.  
  **Mitigation:** Stream in chunks; avoid loading full file into memory; keep demo samples small per ARCHITECTURE.

- **[Risk]** Relative path resolution (e.g. `Content/Samples`) can be ambiguous depending on current directory in production.  
  **Mitigation:** Prefer resolving relative to `AppContext.BaseDirectory` or `IHostEnvironment.ContentRootPath`; document expected layout in README.

- **[Trade-off]** Single sample / default file only in this change.  
  **Acceptable:** Explicit non-goal; multi-file or user upload can be a follow-up.

## Migration Plan

- Add NAudio package to the backend project if not present.
- Add `Audio:SamplesPath` (and optional default filename) to `appsettings.json` and `appsettings.Development.json`.
- Create `Content/Samples` (or configured path) and add a placeholder or document “place your demo file here” in README; optionally .gitignore large binaries.
- Deploy backend as usual; no breaking changes to existing health endpoint. Rollback: remove the new route and service registration if needed.

## Open Questions

- Default filename when the path points to a directory (e.g. first file, or require `Audio:DefaultFileName`) — to be decided in implementation; recommend a single configured default file name for simplicity.
