# Frontend (Angular)

Angular 19 client for the pitch-shifter demo (**pitch-shifter-demo-frontend**): a dark audio console
with tempo and pitch knobs, presets, a live spectrum and the original and processed waveforms side by
side, coloured by frequency.

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
src/
├── styles.scss                      design tokens, Material theme, element defaults
└── app/
    ├── app.component.*              page layout, transport, keyboard shortcuts; owns the <audio> element
    ├── audio-api.token.ts           AUDIO_API_BASE_URL injection token
    ├── music/
    │   ├── intervals.ts             interval names, semitone and tempo readouts, tape pitch
    │   └── presets.ts               presets and matching against the current parameters
    ├── pipes/format-time.pipe.ts    seconds to m:ss
    ├── services/
    │   ├── audio-api.service.ts       builds stream, metadata and docs URLs
    │   ├── audio-facade.service.ts    holds the processing parameters, exposes metadata$
    │   └── audio-analysis.service.ts  Web Audio analyser behind the <audio> element
    ├── ui/
    │   ├── knob/                    rotary control (WAI-ARIA slider), SVG
    │   ├── shortcuts/               keyboard shortcut reference, a popover
    │   ├── spectrum/                live spectrum analyser, canvas
    │   └── stage-light/             glow tinted by the dominant frequency
    ├── visual/spectral-palette.ts   frequency → colour scale shared by every visual
    └── waveform/
        ├── waveform-view.component.*      whole-track WaveSurfer.js view, playhead, click to seek
        └── waveform-frequency.service.*   chunked FFT: dominant frequency per segment (see the .md)
```

## Design system

- **Tokens** live in `src/styles.scss` as CSS custom properties: neutral graphite surfaces
  (`--c-bg`, `--c-surface*`, `--c-line*`), text (`--c-text*`), the spectral stops (`--spectral-0` to
  `--spectral-4`), a major-third type scale (`--fs-*`), spacing, radii and motion timings. The same
  file holds the shared control primitives: `.ghost-button`, `.icon-button`, `.section-label`, the
  `.range` input and `kbd`.
- **Layout:** the stage (track, live spectrum, waveforms, transport) and the deck (knobs, pitch mode,
  presets) sit side by side from 1180 px, so the controls and the waveforms they change are always in
  view together. Narrower screens put the deck under the stage, as a faceplate on tablets and as one
  column on phones.
- **Colour means frequency.** `visual/spectral-palette.ts` maps 50 Hz–10 kHz logarithmically onto
  the spectral stops (OKLab interpolation, lightness rising with frequency) and precomputes a lookup
  table for the canvases. Chrome stays neutral; saturated colour appears only where it encodes sound.
- **Type:** Oxanium for the wordmark, readouts and timecodes (its figures share one width), Barlow for
  interface text. Both are self-hosted from `@fontsource` packages listed under `styles` in
  `angular.json`.
- **Angular Material** provides the pitch-mode slide toggle and the tooltips; `mat.theme` plus a few
  `--mat-sys-*` overrides map them onto the tokens.
- **Motion** answers sound or input. The playhead, spectrum and stage light animate in
  `requestAnimationFrame` loops outside Angular's zone and stop when playback stops;
  `prefers-reduced-motion` turns off non-essential animation.

## Keyboard

| Keys | Action |
|------|--------|
| Space, K | Play or pause |
| ← → | Back or forward 5 seconds |
| `[` `]` | Pitch down or up a semitone |
| `-` `+` | Tempo down or up 5 % |
| 1–6 | Presets |
| 0 | Back to the original |
| M | Mute |
| ? | Shortcut reference |

A focused knob takes the arrow keys, Page Up/Down, Home and End, following the WAI-ARIA slider pattern.

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
the spectral palette (including its lightness order), the interval and preset helpers, the knob's
pointer, wheel and keyboard handling, the analysis service, the spectrum and stage light, the waveform
view, the frequency analysis against synthetic sine tones (it runs in a real browser), and the main
component's controls, presets and shortcuts.
