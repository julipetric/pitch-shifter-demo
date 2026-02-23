## ADDED Requirements

### Requirement: Processing abstraction exists
The backend MUST expose an audio processing abstraction that accepts decoded audio samples and processing parameters, and returns processed audio suitable for streaming.

#### Scenario: Processor invoked for a stream
- **WHEN** the streaming service requests processed audio
- **THEN** it delegates to the audio processing abstraction with the requested parameters

### Requirement: Time stretch parameters are supported
The processing service MUST support a tempo percentage parameter with a supported range of 50 to 125, defaulting to 100 when not provided.

#### Scenario: Default tempo
- **WHEN** no tempo parameter is provided
- **THEN** the processor uses 100% tempo and leaves duration unchanged

### Requirement: Preserve-pitch toggle is honored
The processing service MUST honor a boolean preserve-pitch toggle when applying tempo changes.

#### Scenario: Preserve pitch enabled
- **WHEN** tempo is changed and preserve-pitch is true
- **THEN** the output pitch remains unchanged except for any explicit pitch shift parameter

#### Scenario: Preserve pitch disabled
- **WHEN** tempo is changed and preserve-pitch is false
- **THEN** the output pitch shifts proportionally with the tempo change

### Requirement: Pitch shift in semitones
The processing service MUST apply pitch shifting in semitone units, accepting half-step increments (0.5).

#### Scenario: Half-step pitch change
- **WHEN** a pitch shift of 0.5 is requested
- **THEN** the output pitch changes by one half-step

### Requirement: Library-backed implementation
The initial processing implementation MUST use a well-known time-stretch and pitch-shift library.

#### Scenario: Library processor used
- **WHEN** processing is applied during a stream
- **THEN** the library-backed processor performs the time and pitch transformation

### Requirement: Processed audio is streamed incrementally
The processing service MUST stream processed audio without buffering the full file before emitting output.

#### Scenario: Streaming output is incremental
- **WHEN** processing is applied to a stream
- **THEN** processed audio bytes are emitted before the full source file is consumed

### Requirement: Processed output is compressed
The processing service MUST emit processed audio in a compressed format to reduce transfer size.

#### Scenario: Processed output is MP3
- **WHEN** processing is enabled
- **THEN** the processed stream uses the `audio/mpeg` content type
