## Purpose

Define a simple audio transport experience in the Angular frontend that can play, pause, seek, and adjust volume while streaming from the backend audio endpoint.

## Requirements

### Requirement: Transport controls are visible
The frontend SHALL display play/pause, seek, and volume controls using Angular Material components.

#### Scenario: Controls render on load
- **WHEN** the app loads in a browser
- **THEN** play/pause, seek, and volume controls are visible

### Requirement: Audio plays from configured stream URL
The frontend SHALL play audio from the configured API base URL joined with `/api/audio/stream`, including processing parameters derived from the UI controls.

#### Scenario: Play starts backend stream
- **WHEN** the user presses Play
- **THEN** the client requests the stream URL with `tempoPercent`, `preservePitch`, and `pitchSemitones` query parameters and playback starts

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

### Requirement: Pitch and tempo controls are visible
The frontend SHALL display a tempo slider, a preserve-pitch toggle, and a pitch slider using Angular Material components.

#### Scenario: Controls render with defaults
- **WHEN** the app loads in a browser
- **THEN** the tempo slider defaults to 100 (range 50–125), the preserve-pitch toggle is enabled, and the pitch slider defaults to 0 semitones

### Requirement: Pitch slider uses half-step increments
The pitch control SHALL allow semitone adjustments in 0.5 step increments across a range of -12 to +12 semitones.

#### Scenario: Half-step pitch adjustment
- **WHEN** the user moves the pitch slider by one step
- **THEN** the displayed and transmitted value changes by 0.5 semitones

### Requirement: Control changes update stream parameters
The frontend SHALL request an updated stream when tempo, preserve-pitch, or pitch controls change.

#### Scenario: Tempo change updates stream
- **WHEN** the user changes the tempo slider value
- **THEN** the client requests the stream URL with the updated `tempoPercent` value

### Requirement: Control changes are debounced
The frontend SHALL debounce control updates to avoid flooding the backend with rapid requests.

#### Scenario: Debounced control updates
- **WHEN** the user rapidly adjusts tempo or pitch controls
- **THEN** the client waits briefly before requesting the updated stream

### Requirement: Pitch changes apply on release
Pitch changes SHALL only update the stream when the user releases the slider.

#### Scenario: Pitch change committed on release
- **WHEN** the user releases the pitch slider after dragging
- **THEN** the client requests a new stream with the updated `pitchSemitones` value

### Requirement: Preserve-pitch off forces neutral pitch
When preserve-pitch is disabled, the client SHALL behave as if pitch is zero.

#### Scenario: Preserve-pitch disabled
- **WHEN** the user turns off preserve-pitch
- **THEN** the client sends `pitchSemitones=0` and displays pitch at 0

### Requirement: Seek uses processed timeline when needed
When processing is active, seeking SHALL request a new stream using `startSeconds` on the processed timeline.

#### Scenario: Seek with processing enabled
- **WHEN** the user seeks while tempo or pitch processing is active
- **THEN** the client requests `/api/audio/stream` with `startSeconds` set to the seek position

### Requirement: Duration reflects tempo
The frontend SHALL display duration and progress using the source duration adjusted by tempo (`processed = source / (tempoPercent/100)`).

#### Scenario: Tempo changes update duration
- **WHEN** the user changes tempo
- **THEN** the displayed duration and progress scale to match the tempo-adjusted length

### Requirement: Metadata endpoint provides source duration
The frontend SHALL query `/api/audio/metadata` to obtain source duration used for tempo-adjusted display.

#### Scenario: Metadata refresh
- **WHEN** the frontend initializes or processing parameters change
- **THEN** the client requests metadata and updates the displayed duration
