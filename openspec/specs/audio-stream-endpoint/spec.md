## Purpose

Define the backend GET endpoint that streams a static audio file from a configured path using async I/O and chunked response.

## Requirements

### Requirement: Audio stream endpoint exists
The backend MUST expose a GET endpoint (e.g. `GET /api/audio/stream`) that streams audio content for a static sample file and accepts optional processing parameters (`tempoPercent`, `preservePitch`, `pitchSemitones`, `startSeconds`).

#### Scenario: Stream endpoint returns audio
- **WHEN** a client requests the audio stream endpoint with a valid sample identifier or default and valid processing parameters
- **THEN** the response is HTTP 200 with a chunked body containing audio bytes and a `Content-Type` appropriate to the audio format

#### Scenario: Stream endpoint uses async response
- **WHEN** the stream endpoint is invoked
- **THEN** the response is produced using async I/O (e.g. `Stream` or chunked transfer) so that the request does not block the thread pool

#### Scenario: Processed streams use compressed content type
- **WHEN** processing parameters are non-default
- **THEN** the response `Content-Type` is `audio/mpeg` to reduce transfer size

#### Scenario: Default processing values are used
- **WHEN** the client omits processing parameters
- **THEN** the stream uses defaults of 100% tempo, 0 semitones pitch shift, and preserve-pitch enabled

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

### Requirement: Audio stream supports range requests
The audio stream endpoint SHALL support HTTP byte range requests for seeking when processing parameters are default.

#### Scenario: Range request returns partial content
- **WHEN** a client requests `/api/audio/stream` with a valid `Range` header and default processing parameters
- **THEN** the response is `206 Partial Content` with an appropriate `Content-Range` header and audio bytes for that range

### Requirement: Processing parameters are validated
The stream endpoint MUST validate processing parameters before streaming.

#### Scenario: Invalid parameters return error
- **WHEN** `tempoPercent` is outside 50–125 or `pitchSemitones` is not a multiple of 0.5
- **THEN** the response is HTTP 400 and no audio stream is returned

### Requirement: Processing parameters are applied server-side
The stream endpoint MUST apply processing parameters using the audio processing service when generating the stream.

#### Scenario: Parameters passed to processor
- **WHEN** a request includes processing parameters
- **THEN** the streaming service passes them to the audio processing abstraction and returns the processed stream

### Requirement: Processed streams do not support range requests
When processing parameters are non-default, the stream MUST be returned without range processing enabled.

#### Scenario: Processed stream range requests are disabled
- **WHEN** the client requests a processed stream
- **THEN** range processing is disabled for the response

### Requirement: Start offset is supported for processed streams
The stream endpoint MUST accept a `startSeconds` offset that starts streaming from the provided time on the processed timeline.

#### Scenario: Start offset applies to processed stream
- **WHEN** a processed stream is requested with `startSeconds`
- **THEN** the stream begins at the requested processed-time offset

### Requirement: Metadata endpoint exists
The backend MUST expose a GET endpoint (e.g. `GET /api/audio/metadata`) that returns audio duration metadata for the default sample using the same processing parameters.

#### Scenario: Metadata endpoint returns durations
- **WHEN** a client requests the metadata endpoint with valid processing parameters
- **THEN** the response includes `sourceDurationSeconds` and `processedDurationSeconds`
