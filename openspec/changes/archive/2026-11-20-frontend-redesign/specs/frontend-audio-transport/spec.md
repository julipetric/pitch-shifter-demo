## RENAMED Requirements

- FROM: `### Requirement: Pitch slider uses half-step increments`
- TO: `### Requirement: Pitch control uses half-step increments`

## MODIFIED Requirements

### Requirement: Transport controls are visible
The frontend SHALL display play/pause, seek, volume and mute controls, each operable by pointer and keyboard and exposed to assistive technology with a name and current value.

#### Scenario: Controls render on load
- **WHEN** the app loads in a browser
- **THEN** play/pause, seek, volume and mute controls are visible

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

### Requirement: Original waveform can use a separate stream with default parameters
The frontend SHALL request the original stream with default processing parameters, from its start, to feed the original waveform, without replacing or conflicting with the playback stream.

#### Scenario: Two stream usages when processing is active
- **WHEN** the user has set tempo or pitch to non-default values
- **THEN** the original waveform uses the stream with default parameters while playback uses the current processing parameters

#### Scenario: Playback behavior unchanged
- **WHEN** the original waveform view uses a separate stream with default parameters
- **THEN** play, pause, seek, and control behavior for the main playback stream remain as specified in the transport requirements

## ADDED Requirements

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
