# Frontend (Angular)

Angular 19 client for the pitch-shifter demo (**pitch-shifter-demo-frontend**): playback with
pitch and tempo controls, and a side-by-side waveform of the original and the processed audio.

## Run

```bash
npm ci
npm start            # http://localhost:4200
```

The development build calls the API at `http://localhost:5041` (see
`src/environments/environment.ts`), so start the backend first
(`dotnet run --project ../backend/pitch-shifter-demo-backend`). The backend allows
`http://localhost:4200` by default.

## Structure

```
src/app/
├── app.component.*              transport (play, seek, volume), tempo/pitch controls, waveform cards
├── audio-api.token.ts           AUDIO_API_BASE_URL injection token
├── pipes/format-time.pipe.ts    seconds to m:ss
├── services/
│   ├── audio-api.service.ts     builds stream URLs, fetches metadata
│   └── audio-facade.service.ts  holds the processing parameters, exposes metadata$
└── waveform/
    ├── waveform-snippet.component.*   WaveSurfer.js canvas waveform, OnPush
    └── waveform-frequency.service.*   chunked FFT: dominant frequency per segment (see the .md)
```

## API base URL

`AudioApiService` resolves the base URL against the page origin, so it can be absolute
(`https://api.example.com`), a path (`/backend`) or empty (same origin).

- `ng serve` uses `src/environments/environment.ts`.
- Production builds read the `AUDIO_API_BASE_URL` build-time constant, which is empty unless
  overridden:

  ```bash
  npx ng build --configuration production --define AUDIO_API_BASE_URL="'https://api.example.com'"
  ```

  An empty value suits the Docker image, where nginx serves the bundle and proxies `/api` to the
  backend. A non-empty value needs the backend's `Cors:AllowedOrigins` to include the page origin.

## Build

```bash
npm run build        # dist/pitch-shifter-demo-frontend/browser
```

The `Dockerfile` builds the bundle and serves it with nginx; `nginx/default.conf.template` holds the
proxy rules. See [Deployment](../docs/DEPLOYMENT.md).

## Tests

```bash
npm test             # Karma + Jasmine, watch mode
npm run test:ci      # single run, headless, no sandbox
```

Karma needs a Chromium-based browser. It uses the one named by the `CHROME_BIN` environment
variable, falling back to the usual Chrome locations; Microsoft Edge works too:

```powershell
$env:CHROME_BIN = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
npm run test:ci
```

The specs cover the time pipe, URL building and metadata handling in `AudioApiService`, the facade,
the frequency analysis against synthetic sine tones (it runs in a real browser), and the main
component's control behaviour.
