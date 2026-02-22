## ADDED Requirements

### Requirement: Audio stream supports range requests
The audio stream endpoint SHALL support HTTP byte range requests for seeking.

#### Scenario: Range request returns partial content
- **WHEN** a client requests `/api/audio/stream` with a valid `Range` header
- **THEN** the response is `206 Partial Content` with an appropriate `Content-Range` header and audio bytes for that range
