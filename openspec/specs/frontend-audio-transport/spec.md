## Purpose

Define the audio transport and processing controls of the Angular frontend: play, pause, seek, volume and mute against the backend stream, rotary tempo and pitch controls, pitch mode, presets and keyboard shortcuts.

## Requirements
### Requirement: Transport controls are visible
The frontend SHALL display play/pause, seek, volume and mute controls, each operable by pointer and keyboard and exposed to assistive technology with a name and current value.

#### Scenario: Controls render on load
- **WHEN** the app loads in a browser
- **THEN** play/pause, seek, volume and mute controls are visible

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
The frontend SHALL display rotary tempo and pitch controls that follow the WAI-ARIA slider pattern, and a preserve-pitch toggle.

#### Scenario: Controls render with defaults
- **WHEN** the app loads in a browser
- **THEN** the tempo control shows 100% (range 50–125), the preserve-pitch toggle is on, and the pitch control shows 0 semitones

#### Scenario: Rotary controls respond to every input method
- **WHEN** the user drags a rotary control vertically, scrolls over it, or presses the arrow, Page Up/Down, Home or End keys while it has focus
- **THEN** its value changes by the corresponding amount within its range

#### Scenario: Rotary controls reset to neutral
- **WHEN** the user double-clicks a rotary control or activates its reset button
- **THEN** it returns to its neutral value (100% tempo, 0 semitones)

### Requirement: Pitch control uses half-step increments
The pitch control SHALL allow semitone adjustments in 0.5 step increments across a range of -12 to +12 semitones.

#### Scenario: Half-step pitch adjustment
- **WHEN** the user moves the pitch control by one step
- **THEN** the displayed and transmitted value changes by 0.5 semitones

### Requirement: Control changes update stream parameters
The frontend SHALL request an updated stream when tempo, preserve-pitch, or pitch controls change.

#### Scenario: Tempo change updates stream
- **WHEN** the user changes the tempo slider value
- **THEN** the client requests the stream URL with the updated `tempoPercent` value

### Requirement: Control changes are debounced
The frontend SHALL debounce tempo and seek updates to avoid flooding the backend with rapid requests, and SHALL apply every change that survives the debounce.

#### Scenario: Debounced control updates
- **WHEN** the user rapidly adjusts the tempo control
- **THEN** the client waits briefly before requesting the updated stream

#### Scenario: Repeated changes at the same position
- **WHEN** the user changes the tempo twice while playback stays at the same position
- **THEN** the stream is requested again with the latest tempo

### Requirement: Pitch changes apply on release
Pitch changes SHALL only update the stream when the user releases the pitch control or finishes a keyboard or wheel adjustment, and SHALL cancel any pending debounced update.

#### Scenario: Pitch change committed on release
- **WHEN** the user releases the pitch control after dragging
- **THEN** the client requests a new stream with the updated `pitchSemitones` value

### Requirement: Preserve-pitch off forces neutral pitch
When preserve-pitch is disabled, the client SHALL send a zero pitch offset and the pitch control SHALL become read-only, showing the pitch change caused by the speed change (`12 × log2(tempo / 100)` semitones).

#### Scenario: Preserve-pitch disabled
- **WHEN** the user turns off preserve-pitch with the tempo at 50%
- **THEN** the client sends `pitchSemitones=0` and the pitch control shows −12 semitones, labelled as following the tempo

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

### Requirement: Original waveform can use a separate stream with default parameters
The frontend SHALL request the original stream with default processing parameters, from its start, to feed the original waveform, without replacing or conflicting with the playback stream.

#### Scenario: Two stream usages when processing is active
- **WHEN** the user has set tempo or pitch to non-default values
- **THEN** the original waveform uses the stream with default parameters while playback uses the current processing parameters

#### Scenario: Playback behavior unchanged
- **WHEN** the original waveform view uses a separate stream with default parameters
- **THEN** play, pause, seek, and control behavior for the main playback stream remain as specified in the transport requirements

### Requirement: Presets apply a parameter set in one step
The frontend SHALL offer presets (Original, Slow motion, Practice, Chipmunk, Giant, Nightcore) that set tempo, preserve-pitch and pitch together, keep the musical position, and update the stream immediately. The preset matching the current sound SHALL be shown as pressed.

#### Scenario: Applying a preset
- **WHEN** the user selects "Slow motion" 30 seconds into the unprocessed track
- **THEN** the client requests the stream with `tempoPercent=60`, `preservePitch=false` and `startSeconds=50`, and the preset is shown as pressed

### Requirement: Keyboard shortcuts
The frontend SHALL support Space or K (play/pause), Left/Right (seek 5 s), `[`/`]` (pitch ∓1 semitone), `-`/`+` (tempo ∓5%), 1–6 (presets), 0 (original), M (mute) and `?` (shortcut reference). Shortcuts SHALL be ignored with Ctrl, Alt or Meta, inside text entry, and, for Space and the arrows, while a control that uses those keys has focus.

#### Scenario: Shortcut on the page
- **WHEN** focus is on the page body and the user presses `4`
- **THEN** the fourth preset is applied

#### Scenario: Focused control keeps its keys
- **WHEN** a button has focus and the user presses Space
- **THEN** the button is activated and playback is not toggled

### Requirement: Connection and loading states
The frontend SHALL show whether the audio API is reachable, offer a retry when it is not, and show a busy indicator on the play button while the stream buffers.

#### Scenario: API unreachable
- **WHEN** the metadata request fails
- **THEN** the status reads "Server offline" and a notice explains how to start the API, with a retry button that requests the metadata again

### Requirement: Musical readouts
The tempo control SHALL show the percentage and the speed multiplier; the pitch control SHALL show the signed semitone value and the interval name (for example "+7 st", "Perfect fifth up").

#### Scenario: Interval name
- **WHEN** the pitch is set to +7 semitones
- **THEN** the pitch control reads "+7 st" and "Perfect fifth up"

## Technical Considerations

### Timelines
- The backend interprets `startSeconds` on the processed timeline. Changing the tempo keeps the musical position: the current position is converted to source time with the old tempo and back to the processed timeline with the new one.
- Seeking an unprocessed stream sets `currentTime` on the element (range requests); seeking a processed stream requests a new stream with `startSeconds`.

### Update behavior for pitch vs seek/tempo
- Tempo and seek changes are debounced (300 ms); each new change restarts the delay.
- Pitch releases, presets and pitch-mode changes apply immediately and cancel any pending debounced update.
- The waveforms load whole tracks, so playback offsets never reload them.
