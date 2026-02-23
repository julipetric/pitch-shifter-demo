## ADDED Requirements

### Requirement: Original waveform can use a separate stream with default parameters
The frontend SHALL support using a second stream request to `/api/audio/stream` with default processing parameters (100% tempo, 0 semitones, preserve-pitch as configured) for the purpose of feeding the original waveform visualization, without replacing or conflicting with the stream used for playback when processing is active.

#### Scenario: Two stream usages when processing is active
- **WHEN** the user has set tempo or pitch to non-default values and the waveform analyzer is active
- **THEN** the client MAY issue a request for the stream with default parameters to drive the original waveform view while playback uses a request with current processing parameters

#### Scenario: Playback behavior unchanged
- **WHEN** the original waveform view uses a separate stream with default parameters
- **THEN** play, pause, seek, and control behavior for the main playback stream remain as specified in the existing transport requirements

## Technical Considerations

### Start offsets and alignment
- The backend interprets `startSeconds` on the processed timeline; when aligning the original waveform with the processed one, the original stream SHOULD use the corresponding source-time start so both waveforms match.
- When re-processing shifts the processed stream start (e.g., retriggering from a new position), the original waveform SHOULD update its start to the same segment so the two views stay aligned.

### Update behavior for pitch vs seek/tempo
- Pitch-only changes SHOULD avoid reloading the original waveform stream when the start position is unchanged.
- Pitch-only changes MAY apply immediately (no debounce) to reduce perceived processing delay; seek/tempo changes MAY remain debounced to limit backend load.
