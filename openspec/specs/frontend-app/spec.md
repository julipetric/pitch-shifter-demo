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
The Angular app MUST use Angular Material and MUST display a simple "Hello world" (or equivalent) experience using at least one Material component.

#### Scenario: Material dependency present
- **WHEN** the frontend application dependencies are inspected
- **THEN** Angular Material (e.g. `@angular/material`) is listed as a dependency

#### Scenario: Hello world view with Material
- **WHEN** the built application is opened in a browser
- **THEN** a "Hello world" (or equivalent) message or view is visible and at least one Angular Material component (e.g. toolbar, card, button) is used on the page

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
