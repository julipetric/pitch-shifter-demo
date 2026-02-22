## Purpose

Define the baseline frontend directory structure and documentation, including the deployable Angular app and deployment walkthrough.

## Requirements

### Requirement: Frontend directory baseline
The repository MUST include a top-level `frontend/` directory with a `README.md` describing the intended client scope.

#### Scenario: Baseline frontend folder present
- **WHEN** the repository root is inspected
- **THEN** a `frontend/` directory exists containing `README.md`

### Requirement: Frontend README scope statement
The `frontend/README.md` MUST describe that the client is an Angular application using Web Audio API and Canvas for waveform analysis and pitch/tempo controls.

#### Scenario: Frontend README describes scope
- **WHEN** a developer opens `frontend/README.md`
- **THEN** the document references Angular and the Web Audio waveform visualization scope

### Requirement: Deployable Angular app in frontend
The `frontend/` directory MUST contain the deployable Angular application (pitch-shifter-demo-frontend) as defined by the frontend-app capability, with a working production build.

#### Scenario: Angular app present under frontend
- **WHEN** the repository root is inspected
- **THEN** the `frontend/` directory contains the Angular app source and build configuration (e.g. `angular.json`, `package.json`) for pitch-shifter-demo-frontend

### Requirement: Deployment walkthrough document in repo
The repository MUST include the deployment walkthrough document defined by the azure-deploy-docs capability (e.g. under `docs/` or `frontend/`), so that deploy steps and configuration for the frontend hello-world app are documented.

#### Scenario: Deployment document present
- **WHEN** the repository is inspected
- **THEN** the deployment walkthrough document exists and is reachable from the repo (e.g. `docs/azure-frontend-deploy.md` or `frontend/DEPLOY.md`)
