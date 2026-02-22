## Purpose

Define the backend GET endpoint that streams a static audio file from a configured path using async I/O and chunked response.

## ADDED Requirements

### Requirement: Audio stream endpoint exists
The backend MUST expose a GET endpoint (e.g. `GET /api/audio/stream`) that streams audio content for a static sample file.

#### Scenario: Stream endpoint returns audio
- **WHEN** a client requests the audio stream endpoint with a valid sample identifier or default
- **THEN** the response is HTTP 200 with a chunked body containing audio bytes and a `Content-Type` appropriate to the audio format

#### Scenario: Stream endpoint uses async response
- **WHEN** the stream endpoint is invoked
- **THEN** the response is produced using async I/O (e.g. `Stream` or chunked transfer) so that the request does not block the thread pool

### Requirement: Sample path is configurable
The backend MUST read the path to static sample audio files from configuration (e.g. `Audio:SamplesPath` in appsettings). The path SHALL be configurable per environment; the default MAY be a project-relative folder such as `Content/Samples`.

#### Scenario: Sample path resolved from configuration
- **WHEN** the application starts or the streaming service resolves the sample path
- **THEN** the path used for reading sample files is taken from configuration, not hardcoded

#### Scenario: Missing or invalid sample returns error
- **WHEN** a client requests a stream for a sample that does not exist or the configured path is invalid
- **THEN** the response is an appropriate HTTP error (e.g. 404) and no audio stream is returned

### Requirement: Streaming logic behind abstraction
The streaming logic (file resolution, read, and stream emission) MUST be implemented behind an abstraction (e.g. service interface) so the endpoint handler remains thin and the implementation is testable and swappable (SOLID).

#### Scenario: Endpoint delegates to streaming service
- **WHEN** the stream endpoint handles a request
- **THEN** it delegates to the injected streaming service/interface and returns the stream (or result) provided by that abstraction

### Requirement: NAudio used for decoding
The backend MUST use NAudio (or equivalent per stack) for reading/decoding the source audio file when producing the stream, in line with the stack and architecture.

#### Scenario: Audio is decoded for streaming
- **WHEN** the streaming service produces a stream from a supported audio file
- **THEN** the file is read/decoded using the NAudio pipeline (or stack-defined equivalent) and the response is chunked for delivery
