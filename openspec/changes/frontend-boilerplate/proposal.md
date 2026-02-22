## Why

We need a minimal, runnable frontend to validate the repo layout and deployment path before building out features. A simple Angular/Material "Hello world" app under `/frontend`, deployable to Azure, establishes the stack and produces a deployment walkthrough for the team.

## What Changes

- Add an Angular application using Angular Material in `frontend/`, named **pitch-shifter-demo-frontend**, showing a simple "Hello world" (or equivalent) UI.
- Build and output configured so the app can be deployed to Azure (e.g. Static Web Apps or App Service).
- Add a deployment walkthrough document that describes everything needed to deploy the hello-world app (prerequisites, Azure setup, build, deploy, and any configuration).

## Capabilities

### New Capabilities
- `frontend-app`: Runnable Angular + Angular Material app in `frontend/`, project name pitch-shifter-demo-frontend, producing a static (or otherwise Azure-deployable) build.
- `azure-deploy-docs`: Single document that walks through steps and configuration required to deploy the frontend hello-world app to Azure services.

### Modified Capabilities
- `frontend-project-structure`: Extend to require the presence of the deployable Angular app and the deployment walkthrough document (in addition to existing README and directory baseline).

## Impact

- **Code**: New `frontend/` Angular app (scaffold, Material, minimal page); no backend changes.
- **Dependencies**: Angular, Angular Material, Node/npm (or equivalent) for build.
- **Systems**: Azure (Static Web Apps or App Service) for hosting; deployment doc will reference specific options.
- **Repo**: `frontend/` will contain the app source and build output configuration; one new doc (e.g. in repo root or `docs/`) for the deployment walkthrough.
