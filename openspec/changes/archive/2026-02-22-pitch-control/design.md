## Context

The backend currently streams decoded audio via an abstraction and uses NAudio for decoding. The frontend has basic transport controls and streams audio from the backend. This change introduces backend-driven time-stretch and pitch-shift processing, with the frontend sending parameters for tempo, pitch, and a toggle that determines whether tempo changes alter pitch.

## Goals / Non-Goals

**Goals:**
- Add a backend processing layer that can apply time-stretch and pitch-shift using a well-known library first.
- Expose streaming parameters for tempo percent, preserve-pitch toggle, and pitch shift in semitones (0.5 step granularity).
- Keep the processing behind an interface so it can be swapped later for a custom implementation.
- Keep the frontend lightweight: UI controls and parameterized stream requests.

**Non-Goals:**
- Building a custom DSP implementation for pitch/time processing in this change.
- Supporting offline rendering or exporting processed audio files.
- Adding user uploads or multi-track processing.

## Decisions

- **Processing abstraction**: Introduce an `IAudioProcessor` interface that accepts decoded sample buffers and processing parameters, returning a sample provider or stream. Rationale: aligns with the architecture's DIP guidance and allows swapping libraries later.
- **Library choice (initial)**: Use a well-known time-stretch/pitch-shift library (e.g., SoundTouch via .NET bindings). Rationale: proven quality and the documented project plan to start with a library before custom DSP.
- **Tempo vs rate behavior**: When `preservePitch` is true, use the library’s tempo control (time changes without pitch) and apply pitch shifting separately. When false, use rate control so time changes also shift pitch. Rationale: matches user intent and library semantics.
- **API parameterization**: Pass `tempoPercent` (50–125), `preservePitch` (bool), and `pitchSemitones` (float; 0.5 step) as query parameters to `/api/audio/stream`. Rationale: simple to adopt and compatible with existing GET streaming endpoint.
- **Frontend throttling**: Throttle slider updates so the backend is not flooded with stream restarts. Rationale: responsiveness without excessive HTTP churn.

## Risks / Trade-offs

- **Library availability/licensing** → Validate the chosen .NET package license and compatibility; document any constraints.
- **Processing latency** → Use small buffers and async streaming; throttle UI updates to avoid frequent re-streams.
- **Audio quality artifacts** → Provide sane defaults (100% tempo, 0 semitones) and allow quick reset; note that extreme values may degrade quality.
- **CPU usage on server** → Consider caching or limiting simultaneous streams for demo environments.

## Migration Plan

- Add the processing library dependency to the backend project.
- Implement the `IAudioProcessor` and a library-backed processor.
- Extend the stream endpoint to accept and validate the new parameters.
- Update the frontend UI controls and request wiring.
- Verify basic playback and parameter changes in a demo run.

Rollback: disable the processing path and fall back to passthrough streaming.

## Open Questions

- Which specific .NET package will be used for the initial library implementation?
- Exact query parameter naming and default behavior in the API contract.
- Do we need to support additional audio formats beyond the current sample set?
