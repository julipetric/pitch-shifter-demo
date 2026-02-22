## Why

The frontend currently lacks a playback surface to demonstrate the backend audio stream in a user-friendly way. A simple transport UI is needed to validate end-to-end streaming and provide a demo-ready experience.

## What Changes

- Add an Angular UI for play/pause, seek, and volume control tied to a single audio stream.
- Wire the client to the backend stream endpoint at `GET /api/audio/stream` using the provided base URL.
- Keep volume changes client-side and update playback position interactively.
- Enable server-side seek support on the audio stream endpoint (HTTP range processing).
- Present the controls using Angular Material components to align with the stack.

## Capabilities

### New Capabilities
- `frontend-audio-transport`: Provide a simple audio transport UI in the Angular app that can play/pause, seek, and adjust client-side volume while streaming from the backend API.

### Modified Capabilities
- `audio-stream-endpoint`: Add HTTP range/seek support so clients can request playback positions.

## Impact

- Frontend Angular app: new UI components/services and API base URL configuration.
- Backend API: update `/api/audio/stream` to support range requests/seek.
