## Purpose

Define the waveform analyzer UI in the Angular frontend: two waveform views (original and processed) that display a snippet of the track using Web Audio API and Canvas, with the original view always visible and the processed view shown when tempo or pitch processing is active.

## Requirements

### Requirement: Two waveform windows are present
The frontend SHALL provide two waveform display areas: one labeled or identifiable as the original track, and one as the processed track. The processed window SHALL be hidden or disabled when tempo is 100% and pitch is 0 semitones; it SHALL be shown when either tempo or pitch differs from these defaults.

#### Scenario: Original waveform visible on load
- **WHEN** the app loads and the user has not changed tempo or pitch
- **THEN** the original waveform window is visible and shows a snippet of the track

#### Scenario: Processed waveform shown when processing is active
- **WHEN** the user sets tempo to a value other than 100% or pitch to a value other than 0 semitones
- **THEN** the processed waveform window is visible and shows a snippet of the processed stream

#### Scenario: Processed waveform hidden when processing is default
- **WHEN** tempo is 100% and pitch is 0 semitones
- **THEN** the processed waveform window is not shown or is clearly disabled

### Requirement: Original waveform uses unprocessed stream
The original waveform view SHALL be driven by the same stream endpoint with default processing parameters (e.g. 100% tempo, 0 semitones) so that it always represents the unprocessed track, regardless of current playback or processed waveform.

#### Scenario: Original view independent of processing
- **WHEN** the user applies tempo or pitch changes
- **THEN** the original waveform view continues to display the unprocessed track (e.g. from a separate request or data path with default parameters)

### Requirement: Processed waveform reflects current processing
The processed waveform view SHALL display a snippet of the stream that matches the current tempo and pitch settings used for playback when processing is active.

#### Scenario: Processed view matches playback stream
- **WHEN** the processed waveform window is visible
- **THEN** the data shown is derived from the same processed stream (or playback source) as the current tempo and pitch

### Requirement: Waveform snippet visualization
Each waveform view SHALL render a snippet of the audio as an amplitude-based visualization on a dark background, using Canvas 2D and time-domain data from the Web Audio API (e.g. AnalyserNode). The visualization MAY use multi-color or gradient styling to improve readability.

#### Scenario: Snippet displays amplitude
- **WHEN** a waveform window has audio data available
- **THEN** the canvas shows a time-domain amplitude representation (e.g. bars or lines) of a portion of the track

#### Scenario: Dark background
- **WHEN** the waveform is displayed
- **THEN** the background of the waveform area is dark (e.g. near-black) for contrast

### Requirement: Web Audio and Canvas used for analysis and drawing
The waveform analyzer SHALL use the Web Audio API (AudioContext, source, AnalyserNode) to obtain time-domain data and Canvas 2D to draw the waveform. Subscriptions and contexts SHALL be cleaned up on component destroy (e.g. takeUntil or equivalent).

#### Scenario: Analyser data drives canvas
- **WHEN** the waveform component has an active audio source
- **THEN** time-domain data from an AnalyserNode (or equivalent) is used to render the waveform on a canvas

#### Scenario: No resource leaks on destroy
- **WHEN** the waveform component or view is destroyed
- **THEN** any AudioContext, subscriptions, or timers used for the waveform are released or cancelled

### Requirement: Waveform components use OnPush change detection
Waveform display components SHALL use Angular ChangeDetectionStrategy.OnPush to limit change detection to inputs and events, in line with frontend performance guidance.

#### Scenario: OnPush configured
- **WHEN** the waveform component class is inspected
- **THEN** its change detection strategy is set to OnPush

## Technical Considerations

### Waveform alignment and start offsets
- The processed stream `startSeconds` is on the processed timeline; the original waveform SHOULD translate that start to source time so both waveforms show the same segment after re-processing or seeking.
- When re-triggering processing shifts the processed stream start, the original waveform SHOULD be reloaded from the matching source start so the two waveforms remain aligned.
- Pitch-only updates SHOULD NOT reload the original waveform when the start position has not changed.

### Normalization and visibility
- Normalize waveform heights using the global peak across the decoded buffer so the highest peak occupies 100% of the waveform height.
- The normalization scan SHOULD be chunked/yielded to avoid blocking the main thread on large buffers.

### Performance and responsiveness
- Frequency coloring SHOULD be computed in chunks with periodic yields, and the canvas SHOULD re-render per chunk to avoid the “all at once” feeling.
- In-flight frequency computations SHOULD be cancelable when the stream URL changes.
- The processed waveform MAY defer coloring briefly so the base waveform renders quickly, then color in asynchronously.
