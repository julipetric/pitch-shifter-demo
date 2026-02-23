## 1. Backend processing foundation

- [x] 1.1 Define processing parameter model and defaults
- [x] 1.2 Add `IAudioProcessor` abstraction and library-backed implementation
- [x] 1.3 Integrate processor into streaming pipeline after decoding
- [x] 1.4 Validate tempo and pitch parameters before processing

## 2. Stream endpoint updates

- [x] 2.1 Parse `tempoPercent`, `preservePitch`, and `pitchSemitones` from requests
- [x] 2.2 Return 400 for invalid parameters and apply defaults when omitted
- [x] 2.3 Ensure processed streams remain async and chunked

## 3. Frontend controls & wiring

- [x] 3.1 Add tempo slider (50–125, default 100)
- [x] 3.2 Add preserve-pitch toggle (default enabled)
- [x] 3.3 Add pitch slider (-12 to +12, 0.5 step, default 0)
- [x] 3.4 Throttle control changes and rebuild stream URL with parameters

## 4. Verification & docs

- [x] 4.1 Smoke test: default stream, tempo change, preserve-pitch toggle, pitch shift
- [x] 4.2 Update any API usage or demo notes to mention new parameters
- [x] 4.3 Validate architecture/stack/docs align with implementation
