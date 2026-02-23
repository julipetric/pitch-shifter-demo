# Waveform Analyzer — Design

## Context

- The Angular app already has transport controls, one `<audio>` element, and a single `streamUrl` built from `/api/audio/stream` with tempo/pitch/seek params. When the user changes tempo or pitch, the stream URL is updated and playback switches to the processed stream.
- The backend exposes `GET /api/audio/stream` with optional `tempoPercent`, `preservePitch`, `pitchSemitones`, `startSeconds`. Omitting params or using defaults (100% tempo, 0 semitones) yields the original, unprocessed stream. Processed streams are MP3 and do not support range; original/default streams support range.
- ARCHITECTURE and STACK call for Web Audio API (AudioContext, AnalyserNode) and Canvas 2D for waveform rendering; SHOWCASE emphasizes OnPush, RxJS (async pipe, takeUntil), and a clear signal chain (Source → Processor → Analyser → Destination).
- We need two waveform views: one always showing a snippet of the **original** track, and one shown only when tempo or pitch are non-default, showing a snippet of the **processed** stream. The original view must remain visible when the user applies processing, so we need two independent data sources for visualization.

## Goals / Non-Goals

**Goals:**

- Two waveform windows: "Original" (always) and "Processed" (visible only when tempo ≠ 100% or pitch ≠ 0).
- Snippet-style visualization: dark background, amplitude-based waveform (bars/lines), optional multi-color or spectral-style coloring; optional timeline/grid and playhead.
- Original waveform stays on screen when processing is active via two parallel stream paths (one unprocessed, one processed).
- Use Web Audio API + Canvas; OnPush and RxJS best practices for waveform components; no change to backend contract (reuse existing stream endpoint).

**Non-Goals:**

- Full-track waveform (we only need a snippet).
- Backend changes or new endpoints for waveform-only streams (use existing stream with default vs current params).
- Real-time frequency/spectrum display in this change (can be added later); focus on time-domain amplitude snippet.
- Cue points / loop markers in the first version (optional later).

## Decisions

### 1. Two parallel stream URLs for visualization

- **Decision:** When both views are shown, the frontend will use two logical streams: (1) **Original** — same base URL with default parameters (tempo 100%, pitch 0, preservePitch true) for waveform analysis only; (2) **Processed** — URL with current tempo/pitch for playback and for the processed waveform view. The existing playback `<audio>` continues to use the processed URL when processing is active; the original waveform view is fed from a separate request (or shared fetch/stream) that uses default params.
- **Rationale:** Keeps the original waveform visible without replacing it with processed data; backend already supports both modes. No new API.
- **Alternatives considered:** (A) Single stream and swap the original view to processed when user changes controls — rejected because it loses the original comparison. (B) Dedicated backend endpoint for "original only" — rejected to avoid backend change; default params achieve the same.

### 2. How to feed the original waveform (no playback)

- **Decision:** Use a second, non-playback path: fetch the stream URL with default params and decode it into an `AudioBuffer` (or use a separate `AudioContext` + source from a blob URL of the same stream), then run it through an `AnalyserNode` to get time-domain data for Canvas. Do not play this stream; use it only for analysis. Alternatively, use a single fetch of a short segment (if range is supported for default params) to limit bandwidth.
- **Rationale:** Playback must stay on the processed stream when processing is on; the original view is analysis-only. Fetching with default params is already supported; range support on default stream allows optional "snippet only" fetch later.
- **Alternatives considered:** (A) Reuse the same `<audio>` element for analysis — conflicts with needing two different streams when processing is active. (B) Server-side waveform peek endpoint — out of scope; we use client-side analysis from existing stream.

### 3. Component structure

- **Decision:** Introduce a reusable waveform snippet component (e.g. `WaveformSnippetComponent`) that accepts a stream URL (or an observable of audio data) and renders a single canvas. The parent (e.g. transport or a small "waveform panel" component) instantiates two such components: one bound to the "original" stream URL (default params), one bound to the "processed" stream URL (current params). The processed window is shown only when `tempo !== 100 || pitch !== 0` (or equivalent).
- **Rationale:** Single responsibility per component; same visual style for both windows; easy to test and to apply OnPush + async pipe.
- **Alternatives considered:** One component with two internal canvases — acceptable but less flexible for layout and reuse.

### 4. Web Audio signal chain for each view

- **Decision:** For each waveform view: create a source from the stream (e.g. `createMediaElementSource` for playback path, or decode buffer + `createBufferSource` for the non-playback original path). Connect to an `AnalyserNode` (e.g. `fftSize` for resolution, `getByteTimeDomainData` for amplitude snippet). Use requestAnimationFrame (or a throttled interval) to read analyser data and draw to Canvas. Clean up context and subscriptions on destroy (takeUntil pattern).
- **Rationale:** Matches STACK and SHOWCASE; AnalyserNode is the standard way to get time-domain data for visualization.

### 5. Styling and snippet length

- **Decision:** Dark background, amplitude bars/lines; optional gradient or color mapping (e.g. by amplitude or simple spectral hint) in a follow-up. Snippet length: either a fixed time window (e.g. 5–10 seconds) or a fixed number of analyser bins, drawn at current play position or at the start of the segment. No requirement for scrollable full track in this change.
- **Rationale:** Aligns with the reference visual; keeps first version simple.

### 6. Where the second stream is created

- **Decision:** The "original" waveform stream is created and held by the same component or a small service that owns "original stream URL" (default params). When the track or base URL changes, this URL is updated; when the component is destroyed, the fetch and AudioContext are released. The processed waveform uses the same URL as playback when processing is active (can share the same stream reference as the `<audio>` element for the processed view to avoid a third request, if we drive the processed waveform from the playing audio element when processing is on).
- **Rationale:** Minimizes duplicate processed stream: one request for playback + processed waveform when processing is on; one request for original waveform when we need to show original. So at most two concurrent requests: original (default params) + processed (current params when processing is on).

### 7. Sharing processed stream between playback and processed waveform

- **Decision:** When processing is active, the processed waveform view can be driven from the same `<audio>` element that is playing (via `createMediaElementSource(audio)` and AnalyserNode). That way we do not need a second request for the processed stream; we only need a separate request for the **original** stream (default params) to feed the original waveform view.
- **Rationale:** One stream for playback + processed visualization, one for original visualization; two parallel "calls" in the sense of two data paths, with only one extra HTTP request (the original).

## Risks / Trade-offs

- **Extra bandwidth when processing is on:** One additional stream request (original with default params) while the user has tempo/pitch applied. Mitigation: use range requests to fetch only a short segment for the original waveform snippet if we implement segment-based fetch; otherwise accept the cost for demo.
- **Two AudioContexts or two sources:** If we use a separate fetch + decode for the original, we need an AudioContext (or shared context) and cleanup on destroy. Mitigation: centralize in a service or component that implements takeUntil/destroy to avoid leaks.
- **Canvas performance:** Drawing every frame can be heavy. Mitigation: throttle to ~30 fps or use requestAnimationFrame with a simple downsampling of analyser data; use OnPush so the rest of the app is not re-rendered unnecessarily.
- **CORS / credentials:** If the stream endpoint requires credentials, ensure the second request (original) sends them. Mitigation: use same options as the main stream request.

## Migration Plan

- Add new component(s) and wire them into the existing app template; no backend or URL contract change. Feature-flag or direct merge; no data migration. Rollback: remove the waveform components from the template and related services.

## Open Questions

- Whether to fetch only a short range (e.g. first N seconds) for the original waveform to reduce bandwidth, and how to map that to "snippet at current time" (e.g. seek to current time with range) in a later iteration.
- Exact color scheme (gradient vs single color) and grid/marker specs can be refined in the frontend-waveform-analyzer spec.
