## MODIFIED Requirements

### Requirement: Audio stream endpoint exists
The backend MUST expose a GET endpoint (e.g. `GET /api/audio/stream`) that streams audio content for a static sample file and accepts optional processing parameters (`tempoPercent`, `preservePitch`, `pitchSemitones`, `startSeconds`).

#### Scenario: Stream endpoint returns audio
- **WHEN** a client requests the audio stream endpoint with a valid sample identifier or default and valid processing parameters
- **THEN** the response is HTTP 200 with a chunked body containing processed audio bytes and a `Content-Type` appropriate to the audio format

#### Scenario: Processed streams use compressed content type
- **WHEN** processing parameters are non-default
- **THEN** the response `Content-Type` is `audio/mpeg` to reduce transfer size

#### Scenario: Stream endpoint uses async response
- **WHEN** the stream endpoint is invoked with any processing parameters
- **THEN** the response is produced using async I/O (e.g. `Stream` or chunked transfer) so that the request does not block the thread pool

#### Scenario: Default processing values are used
- **WHEN** the client omits processing parameters
- **THEN** the stream uses defaults of 100% tempo, 0 semitones pitch shift, and preserve-pitch enabled

## ADDED Requirements

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
