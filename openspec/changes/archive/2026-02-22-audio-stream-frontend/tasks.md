## 1. Backend range support

- [x] 1.1 Enable HTTP range processing on `/api/audio/stream`
- [x] 1.2 Verify stream is seekable and returns `206 Partial Content` on Range requests

## 2. Frontend audio transport

- [x] 2.1 Add API base URL configuration for the audio stream
- [x] 2.2 Create a transport component using Angular Material controls
- [x] 2.3 Wire play/pause, volume, and seek behavior to an audio element
- [x] 2.4 Update UI state from time update/duration events

## 3. Manual verification

- [x] 3.1 Play audio and confirm playback starts from backend stream
- [x] 3.2 Seek to a new position and confirm audio jumps correctly
- [x] 3.3 Adjust volume and confirm client-side volume changes
