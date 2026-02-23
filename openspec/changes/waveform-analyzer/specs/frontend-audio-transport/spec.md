## ADDED Requirements

### Requirement: Original waveform can use a separate stream with default parameters
The frontend SHALL support using a second stream request to `/api/audio/stream` with default processing parameters (100% tempo, 0 semitones, preserve-pitch as configured) for the purpose of feeding the original waveform visualization, without replacing or conflicting with the stream used for playback when processing is active.

#### Scenario: Two stream usages when processing is active
- **WHEN** the user has set tempo or pitch to non-default values and the waveform analyzer is active
- **THEN** the client MAY issue a request for the stream with default parameters to drive the original waveform view while playback uses a request with current processing parameters

#### Scenario: Playback behavior unchanged
- **WHEN** the original waveform view uses a separate stream with default parameters
- **THEN** play, pause, seek, and control behavior for the main playback stream remain as specified in the existing transport requirements
