## Why

The repo needs a real backend scaffold to support audio processing work and to unblock integration with Azure hosting. A concrete ASP.NET Core app and deployment guidance makes local development and Azure readiness possible now.

## What Changes

- Add a .NET ASP.NET Core Minimal API backend project under `backend/pitch-shifter-demo-backend`.
- Define baseline configuration and structure suitable for Azure App Service (or equivalent .NET-friendly Azure hosting).
- Add documentation describing how to run/deploy the backend in Azure services, including required configuration.
- Use available tooling to automate backend boilerplate creation instead of manual scaffolding.
- Expand backend project structure expectations beyond a placeholder README.

## Capabilities

### New Capabilities
- `backend-aspnet-boilerplate`: ASP.NET Core Minimal API boilerplate under `backend/` with Azure-ready defaults.
- `backend-azure-deploy-docs`: Deployment walkthrough for running the backend in Azure services.

### Modified Capabilities
- `backend-project-structure`: Update requirements to include the scaffolded ASP.NET Core backend project inside `backend/`.

## Impact

- New `backend/` application files and .NET SDK dependency for local builds.
- New or updated documentation under `backend/` and/or `docs/` for Azure deployment.
- Future CI/CD and hosting considerations for App Service (app settings, build output).
