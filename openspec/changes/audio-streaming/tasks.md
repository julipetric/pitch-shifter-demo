## 1. Configuration and options

- [ ] 1.1 Add `AudioOptions` class with `SamplesPath` and optional `DefaultFileName` bound to `Audio:SamplesPath` and `Audio:DefaultFileName`
- [ ] 1.2 Register options in `Program.cs` with `builder.Services.Configure<AudioOptions>(builder.Configuration.GetSection("Audio"))`
- [ ] 1.3 Add `Audio:SamplesPath` (e.g. `Content/Samples`) and optional default file to `appsettings.json` and `appsettings.Development.json`
- [ ] 1.4 Resolve sample path at runtime (relative to `ContentRootPath` or `BaseDirectory` when path is relative)

## 2. Streaming abstraction and service

- [ ] 2.1 Define `IAudioStreamService` (or `IAudioStreamProvider`) with a method that returns a stream plus content type for the default (or given) sample
- [ ] 2.2 Implement the interface: resolve file path from options, open with NAudio, return stream and Content-Type; return null or throw when file missing for 404 handling
- [ ] 2.3 Register the implementation in DI in `Program.cs`

## 3. Endpoint

- [ ] 3.1 Map `GET /api/audio/stream` in Minimal API that injects `IAudioStreamService` and delegates to it
- [ ] 3.2 On success, return `Results.Stream(stream, contentType)` (or equivalent) with async streaming; on missing file or invalid path return 404
- [ ] 3.3 Add OpenAPI/Swagger metadata for the new endpoint

## 4. NAudio and dependencies

- [ ] 4.1 Add NAudio package to `pitch-shifter-demo-backend.csproj` if not already present
- [ ] 4.2 Use NAudio to open/validate the audio file and obtain a stream (or stream file bytes with correct Content-Type) for chunked delivery; ensure async read where applicable

## 5. Sample folder and documentation

- [ ] 5.1 Create `Content/Samples` (or configured path) under the API project and add README or comment indicating where to place the demo audio file
- [ ] 5.2 Update `backend/README.md` to mention the stream endpoint, configurable sample path, and where to put the static sample file
