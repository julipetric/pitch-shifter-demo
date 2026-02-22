## 1. Backend range support

- [ ] 1.1 Enable HTTP range processing on `/api/audio/stream`
- [ ] 1.2 Verify stream is seekable and returns `206 Partial Content` on Range requests

## 2. Frontend audio transport

- [ ] 2.1 Add API base URL configuration for the audio stream
- [ ] 2.2 Create a transport component using Angular Material controls
- [ ] 2.3 Wire play/pause, volume, and seek behavior to an audio element
- [ ] 2.4 Update UI state from time update/duration events

## 3. Manual verification

- [ ] 3.1 Play audio and confirm playback starts from backend stream
- [ ] 3.2 Seek to a new position and confirm audio jumps correctly
- [ ] 3.3 Adjust volume and confirm client-side volume changes
