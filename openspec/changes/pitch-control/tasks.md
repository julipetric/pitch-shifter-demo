## 1. Backend processing foundation

- [ ] 1.1 Define processing parameter model and defaults
- [ ] 1.2 Add `IAudioProcessor` abstraction and library-backed implementation
- [ ] 1.3 Integrate processor into streaming pipeline after decoding
- [ ] 1.4 Validate tempo and pitch parameters before processing

## 2. Stream endpoint updates

- [ ] 2.1 Parse `tempoPercent`, `preservePitch`, and `pitchSemitones` from requests
- [ ] 2.2 Return 400 for invalid parameters and apply defaults when omitted
- [ ] 2.3 Ensure processed streams remain async and chunked

## 3. Frontend controls & wiring

- [ ] 3.1 Add tempo slider (50–125, default 100)
- [ ] 3.2 Add preserve-pitch toggle (default enabled)
- [ ] 3.3 Add pitch slider (-12 to +12, 0.5 step, default 0)
- [ ] 3.4 Throttle control changes and rebuild stream URL with parameters

## 4. Verification & docs

- [ ] 4.1 Smoke test: default stream, tempo change, preserve-pitch toggle, pitch shift
- [ ] 4.2 Update any API usage or demo notes to mention new parameters
