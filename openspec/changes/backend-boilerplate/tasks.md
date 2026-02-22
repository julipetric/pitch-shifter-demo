## 1. Backend scaffold

- [x] 1.1 Create `backend/` directory and scaffold `backend/pitch-shifter-demo-backend` using `dotnet new webapi`
- [x] 1.2 Ensure the project targets the agreed .NET LTS version and uses Minimal API in `Program.cs`
- [x] 1.3 Add a `GET /health` endpoint that returns HTTP 200 with a JSON status body

## 2. Documentation

- [x] 2.1 Update `backend/README.md` to describe the Minimal API scope, audio processing intent, and NAudio/`IAudioProcessor` abstraction
- [x] 2.2 Create `docs/AZURE-BACKEND-DEPLOY.md` with prerequisites, App Service setup, deployment steps, configuration, and validation
- [x] 2.3 Link the Azure deployment doc from `backend/README.md` or the repo root README

## 3. Azure readiness verification

- [x] 3.1 Confirm configuration files exist (`appsettings.json`, `appsettings.Development.json`, `launchSettings.json`) and document relevant environment variables
- [x] 3.2 Verify the backend builds with `dotnet build backend/pitch-shifter-demo-backend`
