## Why

The demo needs user-controllable time stretch and pitch shifting to demonstrate the core value of a pitch-shifter. Building backend-driven processing with clear UI controls makes the experience realistic and aligned with the project's audio-processing focus.

## What Changes

- Add backend audio processing service that applies time-stretch and pitch-shift using a well-known library first, with an abstraction for future custom processing.
- Extend the audio stream endpoint to accept processing parameters (tempo percent, preserve-pitch toggle, pitch shift in semitone steps) and apply them on the backend.
- Add frontend controls: tempo slider (50–125%, default 100), preserve-pitch toggle, and pitch slider stepped by half-steps (semitones).
- Update frontend request flow to send processing parameters with stream requests.

## Capabilities

### New Capabilities
- `audio-processing-service`: Backend processing layer that applies time-stretch and pitch-shift and can swap implementations.

### Modified Capabilities
- `audio-stream-endpoint`: Add processing parameters to the stream request and apply them server-side.
- `frontend-audio-transport`: Add pitch/time controls and wire them to backend stream requests.

## Impact

- Backend: new processing service implementation, updates to controller/service contracts, new library dependency.
- Frontend: UI controls and request parameter handling in Angular.
- Docs/tests: update any audio processing or API usage documentation and add basic validation tests.
