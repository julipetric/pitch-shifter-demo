## Purpose

Define the waveform analyzer UI in the Angular frontend: two whole-track waveform views (original and processed) coloured by dominant frequency, a live spectrum of the audio being played, and the stage light that follows it.

## Requirements
### Requirement: Two waveform windows are present
The frontend SHALL provide two waveform display areas: one labeled as the original track, and one as the processed track. While tempo is 100% and pitch is 0 semitones the processed area SHALL show an empty state that invites the user to change a parameter; otherwise it SHALL show the processed waveform.

#### Scenario: Original waveform visible on load
- **WHEN** the app loads and the user has not changed tempo or pitch
- **THEN** the original waveform window is visible and shows the whole track

#### Scenario: Processed waveform shown when processing is active
- **WHEN** the user sets tempo to a value other than 100% or pitch to a value other than 0 semitones
- **THEN** the processed waveform window shows a loading state and then the whole processed track

#### Scenario: Processed waveform empty when processing is default
- **WHEN** tempo is 100% and pitch is 0 semitones
- **THEN** the processed window shows an empty state with no waveform

### Requirement: Original waveform uses unprocessed stream
The original waveform view SHALL load the stream with default processing parameters from its start, so that it always represents the whole unprocessed track and does not reload when the user seeks or changes parameters.

#### Scenario: Original view independent of processing
- **WHEN** the user applies tempo or pitch changes or seeks
- **THEN** the original waveform view keeps showing the whole unprocessed track without reloading

### Requirement: Processed waveform reflects current processing
The processed waveform view SHALL load the whole processed track for the current tempo and pitch, from its start, and SHALL reload only when those parameters change.

#### Scenario: Processed view matches playback parameters
- **WHEN** the processed waveform window is visible
- **THEN** it shows the stream processed with the same tempo, pitch and preserve-pitch values as playback

#### Scenario: Seeking does not reload the processed view
- **WHEN** the user seeks while processing is active
- **THEN** only the playback stream is requested again

### Requirement: Waveform visualization
Each waveform view SHALL render the whole track as mirrored amplitude bars on a dark background, using Canvas 2D. Bars SHALL be coloured by the dominant frequency of their time segment on the app's spectral scale, so that a pitch shift visibly moves the colours; segments not yet analysed SHALL use a neutral colour.

#### Scenario: Bars display amplitude
- **WHEN** a waveform window has audio data available
- **THEN** the canvas shows the amplitude of the whole track as bars

#### Scenario: Dark background
- **WHEN** the waveform is displayed
- **THEN** the background of the waveform area is dark for contrast

#### Scenario: Pitch shift moves colours
- **WHEN** the processed track is one octave higher than the original
- **THEN** its bars sit one octave further along the spectral scale than the matching bars of the original

### Requirement: Web Audio and Canvas used for analysis and drawing
The waveform analyzer SHALL decode audio with the Web Audio API, compute the dominant frequency per segment with an FFT (`OfflineAudioContext` and `AnalyserNode`), and draw with Canvas 2D. Analysis SHALL be chunked, cancellable when the source changes, and released with subscriptions, timers and contexts when the view is destroyed.

#### Scenario: Analysis drives colours
- **WHEN** a waveform has been decoded
- **THEN** the dominant frequency per segment is computed in chunks and the canvas re-renders as each chunk completes

#### Scenario: No resource leaks on destroy
- **WHEN** the waveform component or view is destroyed
- **THEN** any audio context, subscriptions, timers or observers used for the waveform are released or cancelled

### Requirement: Waveform components use OnPush change detection
Waveform display components SHALL use Angular ChangeDetectionStrategy.OnPush to limit change detection to inputs and events, in line with frontend performance guidance.

#### Scenario: OnPush configured
- **WHEN** the waveform component class is inspected
- **THEN** its change detection strategy is set to OnPush

### Requirement: Playhead and seeking on the waveforms
Each waveform SHALL show the playback position as a playhead with the unplayed part dimmed, updated every animation frame during playback without triggering Angular change detection. Clicking a waveform SHALL seek to that point, and hovering SHALL show the time under the pointer.

#### Scenario: Click to seek
- **WHEN** the user clicks a quarter of the way along either waveform
- **THEN** playback seeks to a quarter of the processed duration

#### Scenario: Frame-accurate playhead
- **WHEN** audio is playing
- **THEN** both playheads advance every frame at the same musical position

### Requirement: Live spectrum analyzer
The frontend SHALL show a live frequency spectrum of the audio being played, with logarithmically spaced bars coloured on the spectral scale and labelled frequency marks, so it also serves as the legend for the waveform colours. It SHALL rest at a low static level when nothing plays and stop animating once settled.

#### Scenario: Spectrum while playing
- **WHEN** audio is playing
- **THEN** the spectrum bars move with the music

#### Scenario: Spectrum at rest
- **WHEN** playback is paused and the bars have settled
- **THEN** no animation frame callbacks remain scheduled

### Requirement: Stage light follows the music
While audio plays, the stage SHALL be lit from behind by a glow whose colour follows the dominant frequency on the spectral scale and whose intensity follows the level. With reduced motion preferred, the glow SHALL stay static.

#### Scenario: Glow tracks pitch
- **WHEN** the user raises the pitch while playing
- **THEN** the glow shifts toward the bright end of the spectral scale

## Technical Considerations

### Alignment
- Both views span their whole track across the same width, so a horizontal position is the same musical moment in both, whatever the tempo.
- The playhead position reaches each view as the CSS custom property `--wf-progress` (0–1), written per animation frame outside the Angular zone and mapped to a compositor-only transform.

### Bar heights
- Each view scales its bars so its loudest bar fills the lane height. The scale comes from the peaks drawn at the first render, so bar heights stay put while the frequency analysis colours the bars.

### Performance and responsiveness
- Frequency coloring SHOULD be computed in chunks with periodic yields, and the canvas SHOULD re-render per chunk to avoid the “all at once” feeling.
- In-flight frequency computations SHOULD be cancelable when the stream URL changes.
- The processed waveform MAY defer coloring briefly so the base waveform renders quickly, then color in asynchronously.
- Live visualisations (spectrum, stage light) run their animation loops outside the Angular zone and stop once playback stops and their values settle.
