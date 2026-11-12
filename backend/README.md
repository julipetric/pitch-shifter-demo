# Backend (ASP.NET Core)

ASP.NET Core 8 Minimal API that streams an audio sample and applies tempo and pitch processing
on the fly.

```
backend/
├── PitchShifterDemo.sln
├── Dockerfile                          build, test and runtime stages
├── pitch-shifter-demo-backend/         the API
│   ├── Program.cs                      endpoints, CORS, Swagger
│   ├── Options/AudioOptions.cs         "Audio" configuration section
│   ├── Services/
│   │   ├── AudioProcessingParameters   query validation and ranges
│   │   ├── AudioStreamService          sample lookup, passthrough, fallback tone, metadata
│   │   ├── IAudioProcessor             processing abstraction
│   │   └── SoundTouchAudioProcessor    SoundTouch time-stretch/pitch-shift + LAME MP3 encode
│   └── Content/Samples/                bundled sample (see its README for the license)
└── pitch-shifter-demo-backend.Tests/   xUnit tests
```

## Run

```bash
dotnet run --project backend/pitch-shifter-demo-backend      # http://localhost:5041, Swagger at /swagger
```

The `http` launch profile listens on port 5041, which is the address the Angular dev build calls.
Browser calls from `http://localhost:4200` are allowed by default (see [Configuration](#configuration)).

Encoding processed audio needs the native LAME library. Windows uses the DLL bundled with
NAudio.Lame. On Linux and macOS, run the API through Docker (`docker compose up --build` from the
repository root), whose image installs `libmp3lame` and exposes it under the name NAudio.Lame loads.

## Endpoints

| Method and path | Purpose |
|-----------------|---------|
| `GET /api/audio/stream` | Streams the default sample, optionally time-stretched and pitch-shifted. |
| `GET /api/audio/metadata` | Source and processed duration for a set of processing parameters. |
| `GET /health` | Liveness check; returns `{"status":"ok"}`. |
| `GET /diagnostics/audio` | Shows how the sample path and file were resolved. |
| `GET /swagger` | Swagger UI (disable with `Swagger:Enabled=false`). |

### Processing parameters

`/api/audio/stream` and `/api/audio/metadata` accept the same query parameters. Values outside the
ranges are rejected with `400` and `{ "error": "..." }`.

| Parameter | Type | Default | Range |
|-----------|------|---------|-------|
| `tempoPercent` | number | `100` | 50 to 125 |
| `preservePitch` | boolean | `true` | `true`: tempo changes leave the pitch alone. `false`: tempo behaves like a playback-rate change, so the pitch follows it. |
| `pitchSemitones` | number | `0` | -12 to 12 in steps of 0.5 |
| `startSeconds` (stream only) | number | `0` | 0 or more; offset on the **processed** timeline |

Responses:

- **Neutral parameters** (`tempoPercent=100`, `pitchSemitones=0`): the sample file itself, with its own
  content type and HTTP range support.
- **Anything else**: a freshly encoded `audio/mpeg` (128 kbps MP3) stream written as it is produced. It
  has no range support; to seek, request a new stream with `startSeconds`.
- **Metadata**: `{ "sourceDurationSeconds": ..., "processedDurationSeconds": ... }`, where the processed
  duration is the source duration divided by `tempoPercent / 100`.
- **No usable sample**: a generated 5-second 440 Hz tone, unless `Audio:EnableFallbackTone` is `false`,
  in which case the endpoints answer `404`.
- **Processing cannot start** (for example the source file cannot be opened by the decoder): the
  original file is streamed.

## Configuration

Standard ASP.NET Core configuration: `appsettings*.json`, or environment variables with `__` as the
section separator (`Audio__DefaultFileName=track.mp3`).

| Key | Default | Meaning |
|-----|---------|---------|
| `Audio:SamplesPath` | `Content/Samples` | Folder with sample audio, relative to the content root or absolute. |
| `Audio:DefaultFileName` | none | File to stream; when unset, the first supported file in the folder. |
| `Audio:EnableFallbackTone` | `true` | Serve a generated tone when no sample can be used. |
| `Cors:AllowedOrigins` | `["http://localhost:4200"]` | Browser origins allowed to call the API. An empty list allows same-origin callers only. |
| `HttpsRedirection:Enabled` | `true` | Redirect HTTP to HTTPS. The Docker image sets it to `false`. |
| `Swagger:Enabled` | `true` | Expose Swagger UI. |

Supported sample formats: MP3 and WAV are decoded for processing; `.ogg`, `.m4a` and `.aac` are served
as-is when no processing is requested. Drop a file into `Content/Samples/` (or point `Audio:SamplesPath`
elsewhere). The bundled sample is documented in
[`Content/Samples/README.md`](pitch-shifter-demo-backend/Content/Samples/README.md).

## Design notes

- The API is stateless: every request opens the sample and builds its own pipeline.
- `AudioProcessingParameters.TryCreate` is the single place that validates tempo and pitch.
- MP3 files are decoded with NLayer, a managed decoder, so no operating-system codec is needed.
- Processed audio is encoded on a background task and handed to the response through a
  `System.IO.Pipelines` pipe, so bytes are sent while encoding continues.
- `IAudioProcessor` isolates the processing library from the HTTP layer.

## Tests

```bash
dotnet test backend/PitchShifterDemo.sln
docker build --target test ./backend        # the same suite inside the SDK image
```

The suite covers parameter validation, sample resolution, the fallback tone, metadata, start-offset
conversion, and the HTTP endpoints (validation errors, range requests, diagnostics, CORS) hosted
in-process with `WebApplicationFactory`.

## Deploy

See [Deployment](../docs/DEPLOYMENT.md) and [Azure App Service](../docs/AZURE-BACKEND-DEPLOY.md).
