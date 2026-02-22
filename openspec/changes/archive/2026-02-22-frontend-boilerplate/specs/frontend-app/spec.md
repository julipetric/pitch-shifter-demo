## ADDED Requirements

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
