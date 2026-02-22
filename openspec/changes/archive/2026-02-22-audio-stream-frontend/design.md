## Context

The frontend currently has no playback controls, while the backend exposes a single `GET /api/audio/stream` endpoint that streams a static sample file. To enable end-to-end demo playback with seeking, the UI needs a lightweight transport and the backend must support range requests so the browser can jump to a playback position.

## Goals / Non-Goals

**Goals:**
- Provide a simple Angular Material transport UI: play/pause, seek, and volume.
- Stream audio from the hosted backend base URL and keep volume changes client-side.
- Enable HTTP range/seek on `/api/audio/stream` to support playback position changes.

**Non-Goals:**
- Implement pitch/tempo processing or waveform visualization in this change.
- Add new backend endpoints or authentication.
- Build a complex audio graph in the browser (use native audio element behavior).

## Decisions

- **Use a native HTMLAudioElement for playback**: It supports play/pause, currentTime, and volume without extra dependencies. This keeps the UI simple and leverages built-in browser buffering.
  - **Alternatives**: Web Audio API graph for playback. Rejected for this change due to added complexity and out-of-scope waveform/processing work.
- **Enable HTTP range processing on the backend stream**: Set `enableRangeProcessing: true` so the browser can request byte ranges when `currentTime` changes.
  - **Alternatives**: Add a `?start=` query param and manually seek server-side. Rejected in favor of standard HTTP range support with fewer custom semantics.
- **Configure API base URL in the frontend**: Use Angular environment configuration to point the audio source at the provided Azure backend base URL.
  - **Alternatives**: Hardcode the URL in the component. Rejected to keep deployment flexible.

## Risks / Trade-offs

- **[Risk] Range requests not honored by host/proxy** → Mitigation: verify Azure App Service supports range responses and test seek behavior in the deployed environment.
- **[Risk] Seeking on certain codecs may be inaccurate** → Mitigation: stick to the provided MP3 sample and rely on browser decoding; document any limitations.
- **[Trade-off] Simplicity over advanced audio control** → Mitigation: keep the design extensible so Web Audio can be introduced in a later change.

## Migration Plan

- Deploy backend update enabling range processing on `/api/audio/stream`.
- Deploy frontend update with the transport UI and base URL config.
- Rollback by reverting the frontend UI and restoring backend stream behavior if needed.

## Open Questions

- Should the UI expose a visible timecode and duration, or only a simple seek slider?
- Do we want to add a fallback sample selector now or keep it single-track?
