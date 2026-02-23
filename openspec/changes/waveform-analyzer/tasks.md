## 1. Waveform snippet component

- [ ] 1.1 Create Angular component (e.g. `WaveformSnippetComponent`) with OnPush change detection and a canvas element for waveform drawing
- [ ] 1.2 Implement Web Audio chain: accept or create audio source, connect to AnalyserNode, use getByteTimeDomainData in a requestAnimationFrame (or throttled) loop to draw amplitude bars/lines on the canvas
- [ ] 1.3 Add cleanup on destroy: cancel animation frame, disconnect nodes, and use takeUntil(destroy$) for any subscriptions
- [ ] 1.4 Apply dark background and amplitude-based visualization styling to the canvas (optionally multi-color or gradient)

## 2. Original waveform data path

- [ ] 2.1 Define "original" stream URL builder that uses default parameters (tempo 100%, pitch 0, preservePitch true) and same base path as transport
- [ ] 2.2 Implement non-playback path to feed original waveform: fetch stream with default params, decode to buffer (or use blob URL + AudioContext), connect to AnalyserNode, and drive the waveform snippet component without playing audio
- [ ] 2.3 Ensure the original waveform component receives this source and displays a snippet; release context and subscriptions on destroy

## 3. Processed waveform and visibility

- [ ] 3.1 When processing is active (tempo !== 100 || pitch !== 0), drive the processed waveform view from the same playback element (createMediaElementSource + AnalyserNode) so no second processed stream request is needed
- [ ] 3.2 Add logic to show the processed waveform window only when tempo or pitch is non-default; hide or disable it when both are default
- [ ] 3.3 Bind the processed waveform component to the current playback stream when visible (e.g. from the existing audio element or stream URL used by transport)

## 4. App integration

- [ ] 4.1 Add a waveform panel or section to the main app template (e.g. in the transport card or below it) containing two waveform areas: "Original" and "Processed"
- [ ] 4.2 Wire the original waveform area to the original stream data path and the processed area to the playback-driven path when processing is active
- [ ] 4.3 Ensure transport play/pause, seek, and control behavior remain unchanged when the original waveform uses its separate stream

## 5. Polish and verification

- [ ] 5.1 Verify no duplicate processed stream request (only one extra request for original when processing is on)
- [ ] 5.2 Verify resource cleanup when navigating away or destroying the waveform components
- [ ] 5.3 Optionally add a short label or title for each window (e.g. "Original" / "Processed") and align layout with the reference visual (snippet length, grid optional later)
