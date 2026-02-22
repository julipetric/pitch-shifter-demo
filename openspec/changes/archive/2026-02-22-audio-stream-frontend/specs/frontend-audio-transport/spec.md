## ADDED Requirements

### Requirement: Transport controls are visible
The frontend SHALL display play/pause, seek, and volume controls using Angular Material components.

#### Scenario: Controls render on load
- **WHEN** the app loads in a browser
- **THEN** play/pause, seek, and volume controls are visible

### Requirement: Audio plays from configured stream URL
The frontend SHALL play audio from the configured API base URL joined with `/api/audio/stream`.

#### Scenario: Play starts backend stream
- **WHEN** the user presses Play
- **THEN** the client requests the stream URL and playback starts

### Requirement: Volume changes are client-side
The frontend SHALL adjust playback volume locally without making additional backend requests.

#### Scenario: Volume slider updates playback
- **WHEN** the user changes the volume control
- **THEN** playback volume changes without reloading the stream

### Requirement: Seeking updates playback position
The frontend SHALL allow the user to seek to a different playback position.

#### Scenario: Seek updates current playback time
- **WHEN** the user moves the seek control
- **THEN** playback jumps to the new position in the audio
