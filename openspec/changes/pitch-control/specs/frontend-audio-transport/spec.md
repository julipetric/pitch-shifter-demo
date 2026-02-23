## MODIFIED Requirements

### Requirement: Audio plays from configured stream URL
The frontend SHALL play audio from the configured API base URL joined with `/api/audio/stream`, including processing parameters derived from the UI controls.

#### Scenario: Play starts backend stream with parameters
- **WHEN** the user presses Play
- **THEN** the client requests the stream URL with `tempoPercent`, `preservePitch`, and `pitchSemitones` query parameters and playback starts

## ADDED Requirements

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
