# Architecture for Pitch-Shifter Demo

This architecture follows the stack defined in `docs/STACK.md` and focuses on a backend-centric audio processing flow with an Angular client for controls and visualization.

## System context
```mermaid
flowchart LR
  User[User]
  Browser[AngularApp]
  Api[DotNetApi]
  AudioProc[AudioProcessing]
  AudioFiles[AudioFileStore]

  User --> Browser
  Browser --> Api
  Api --> AudioProc
  AudioProc --> AudioFiles
```

## Core components
### Frontend (Angular)
- **Player UI**: track selection, play/pause, pitch/tempo sliders.
- **Waveform UI**: two canvases for original vs processed waveform.
- **AudioGraphService**: builds the Web Audio API graph for analysis.
- **AudioApiService**: calls `/api/stream` with pitch/tempo params.

### Backend (.NET)
- **AudioStreamController**: HTTP streaming endpoint.
- **AudioStreamService**: orchestrates file read, buffering, and streaming.
- **IAudioProcessor**: abstraction for pitch/tempo processing.
- **NAudio pipeline**: decode source audio into sample buffers.

## Request and streaming flow
```mermaid
flowchart TD
  Controls[PitchTempoControls]
  ApiCall[ApiStreamRequest]
  StreamCtl[AudioStreamController]
  StreamSvc[AudioStreamService]
  Decoder[NAudioDecode]
  Processor[IAudioProcessor]
  Chunker[ChunkedResponse]
  Player[BrowserPlayback]
  Analyzer[WebAudioAnalyser]
  Waveform[CanvasWaveform]

  Controls --> ApiCall
  ApiCall --> StreamCtl
  StreamCtl --> StreamSvc
  StreamSvc --> Decoder
  Decoder --> Processor
  Processor --> Chunker
  Chunker --> Player
  Player --> Analyzer
  Analyzer --> Waveform
```

## Responsibilities and boundaries
- **Frontend**: user interaction, visualization, and lightweight audio analysis.
- **Backend**: heavy audio processing and streaming, stateless per request.
- **Processing layer**: isolated behind `IAudioProcessor` for easy swapping (simple stretch vs phase vocoder later). We will implement a library that does the processing first and the as a separate project the processing on our own.

## Non-functional considerations
- **Latency**: chunked streaming, small buffers, async I/O.
- **Performance**: Angular OnPush and throttled slider events.
- **Scalability**: stateless API, no in-memory session state.
- **Reliability**: fallback to original audio stream if processing fails.

## Deployment layout (free tier)
- **Frontend**: Azure Static Web Apps (or Vercel/Netlify).
- **Backend**: Azure App Service Free (or Render/Fly.io).
- **Notes**: expect cold starts; keep sample files small for demo.
