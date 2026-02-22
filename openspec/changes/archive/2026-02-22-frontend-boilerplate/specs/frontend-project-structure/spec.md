## ADDED Requirements

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
