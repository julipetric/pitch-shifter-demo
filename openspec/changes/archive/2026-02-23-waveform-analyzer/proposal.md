# Waveform Analyzer — Proposal

## Why

The demo needs a clear visual comparison between the original audio and the processed output so users can see the effect of tempo and pitch changes. A waveform analyzer that shows a snippet of the track in two windows (original vs processed) makes the app feel like a real audio tool rather than a black box.

## What Changes

- **New: Waveform analyzer UI** — Two waveform views in the frontend: one always showing a snippet of the **original** track, and a second view that is **hidden until** tempo or pitch processing is active, then shows a snippet of the **processed** stream.
- **New: Snippet-style visualization** — Each view renders a waveform snippet with a dark background, amplitude-based bars/lines, and optional multi-color or spectral-style coloring. Optional timeline/grid and markers (e.g. playhead, cue points) as the UI evolves.
- **New: Dual-stream support for visualization** — The original waveform stays visible when the user applies tempo/pitch. This requires either two parallel streaming calls (one unprocessed for the original view, one with processing for playback and the processed view) or equivalent data paths so the original view is not replaced by the processed stream.
- **Integration** — The analyzer is driven by the same track/URL and processing parameters as the existing player; it uses Web Audio API (AudioContext, AnalyserNode) and Canvas for rendering, aligned with STACK.md and SHOWCASE.md (OnPush, RxJS, async pipe, signal chain).

## Capabilities

### New Capabilities

- **frontend-waveform-analyzer**: Waveform analyzer component(s) that display a snippet of the waveform for the original track and, when tempo or pitch are applied, a second snippet for the processed stream; dark background, amplitude (and optionally spectral) visualization; support for two parallel stream/data sources so the original waveform remains visible when processing is active.

### Modified Capabilities

- **frontend-app**: Extend the runnable app to include the waveform analyzer UI (two windows) in the main view.
- **frontend-audio-transport**: Document or extend behavior so the frontend can maintain two stream requests where needed—one for original waveform visualization and one for processed playback/processed waveform—without breaking existing play/pause, seek, and control behavior.

## Impact

- **Frontend**: New Angular component(s) for waveform display; use of Web Audio API (AudioContext, source nodes, AnalyserNode) and Canvas 2D; ChangeDetectionStrategy.OnPush and RxJS (async pipe, takeUntil) for waveform components per SHOWCASE.md.
- **Streaming**: Possibly two concurrent requests to `/api/audio/stream` (or one unprocessed + one processed) when both original and processed waveforms are shown; backend remains stateless and unchanged unless we add a dedicated “original only” path later.
- **Dependencies**: No new external dependencies; Web Audio API and Canvas are built-in.
