## Purpose

Define the runnable Angular + Angular Material frontend application (pitch-shifter-demo-frontend) under `frontend/`, with a static build suitable for Azure deployment.

## Requirements
### Requirement: Angular app in frontend directory
The repository MUST contain an Angular application under the top-level `frontend/` directory, with the project name **pitch-shifter-demo-frontend**, built with the Angular CLI and producing a static build suitable for deployment.

#### Scenario: App lives under frontend
- **WHEN** the repository is inspected
- **THEN** an Angular application exists under `frontend/` with configuration (e.g. `angular.json` or equivalent) identifying the project as pitch-shifter-demo-frontend

#### Scenario: App builds static output
- **WHEN** the standard production build command is run from the frontend directory
- **THEN** the build completes and outputs static assets (e.g. in `dist/` or similar) that can be served by a static host

### Requirement: Angular Material used in the app
The Angular app MUST use Angular Material, themed to the app's design tokens, for at least the pitch-mode toggle and tooltips.

#### Scenario: Material dependency present
- **WHEN** the frontend application dependencies are inspected
- **THEN** Angular Material (e.g. `@angular/material`) is listed as a dependency

#### Scenario: Material components follow the app theme
- **WHEN** the built application is opened in a browser
- **THEN** Material components (the slide toggle, tooltips) use the app's dark palette and fonts

### Requirement: Azure-deployable build
The frontend build output MUST be deployable to Azure (e.g. Azure Static Web Apps or App Service static hosting) without requiring a Node runtime on the server.

#### Scenario: Build output is static
- **WHEN** the production build is run
- **THEN** the output consists of static files (HTML, JS, CSS, assets) that can be served by a static file server or Azure static hosting

### Requirement: Waveform analyzer is included in the main view
The Angular app SHALL include the waveform analyzer UI in its main view, comprising two waveform windows (original and processed) as defined by the frontend-waveform-analyzer capability.

#### Scenario: Waveform analyzer visible in app
- **WHEN** the built application is opened in a browser and a track is available
- **THEN** the original waveform window is visible in the main view

#### Scenario: Waveform layout with transport
- **WHEN** the user views the app
- **THEN** the waveform analyzer is presented in the same main view as the transport controls (e.g. same page or card layout)

### Requirement: Design tokens drive the visual language
Colours, type scale, spacing, radii and motion timings MUST be defined once as CSS custom properties in the global stylesheet and used by every component.

#### Scenario: Components use tokens
- **WHEN** component stylesheets are inspected
- **THEN** colours and type sizes come from the shared custom properties (for example `--c-surface`, `--fs-sm`), with literal values limited to effects such as shadows and gradients

### Requirement: One spectral colour scale encodes frequency
Every colour derived from audio (waveform bars, live spectrum, pitch control accent, preset indicators, stage light) MUST come from one spectral scale that maps frequency logarithmically and whose lightness rises with frequency. Interface chrome MUST stay neutral.

#### Scenario: Higher pitch reads brighter
- **WHEN** the scale is sampled from its low end to its high end
- **THEN** the relative luminance never decreases

#### Scenario: Octaves are equidistant
- **WHEN** the positions of two frequencies an octave apart are compared in different registers
- **THEN** the distance between them is the same

### Requirement: Fonts are self-hosted
The app MUST serve its fonts from its own build output, without requests to third-party font services.

#### Scenario: No external font requests
- **WHEN** the built application loads
- **THEN** font files are requested from the app's origin only

### Requirement: Usable from phone to desktop
The main view MUST adapt from a 360 px wide phone to a wide desktop without horizontal scrolling, keeping every control reachable.

#### Scenario: Phone layout
- **WHEN** the app is viewed 390 px wide
- **THEN** the stage and the controls stack in one column and no content overflows horizontally

#### Scenario: Desktop layout
- **WHEN** the app is viewed in a 1280 × 720 window
- **THEN** the controls sit beside the stage, and the knobs, the presets and both waveforms are visible together without scrolling

