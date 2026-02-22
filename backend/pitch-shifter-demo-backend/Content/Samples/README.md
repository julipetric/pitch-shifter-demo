# Sample audio files

Place your demo audio file here for the streaming endpoint.

- The backend streams the default sample at `GET /api/audio/stream`.
- Configure the path and default file in appsettings under `Audio:SamplesPath` and optional `Audio:DefaultFileName`.
- Supported extensions (and streaming): `.mp3`, `.wav`, `.ogg`, `.m4a`, `.aac`.
- If `DefaultFileName` is not set, the first supported file in this directory is used.
- If no file is available, the API can generate a short fallback tone (toggle with `Audio:EnableFallbackTone`).

Keep files small for the demo (see project architecture notes on cold starts and throughput).
