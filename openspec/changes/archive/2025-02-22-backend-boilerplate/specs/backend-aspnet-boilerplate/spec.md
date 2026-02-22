## ADDED Requirements

### Requirement: Backend project scaffold exists
The repository MUST include `backend/pitch-shifter-demo-backend/` containing the standard ASP.NET Core project files: `pitch-shifter-demo-backend.csproj`, `Program.cs`, `appsettings.json`, `appsettings.Development.json`, and `Properties/launchSettings.json`.

#### Scenario: Backend scaffold files present
- **WHEN** the backend directory is inspected
- **THEN** the listed project files exist under `backend/pitch-shifter-demo-backend/`

### Requirement: Minimal API health endpoint
The backend MUST expose a health endpoint at `GET /health` that returns HTTP 200 with a JSON response body indicating service status.

#### Scenario: Health endpoint returns success
- **WHEN** a client requests `GET /health`
- **THEN** the response is HTTP 200 with a JSON status body

### Requirement: Backend builds with dotnet
The backend project MUST build successfully using `dotnet build backend/pitch-shifter-demo-backend`.

#### Scenario: Dotnet build succeeds
- **WHEN** `dotnet build backend/pitch-shifter-demo-backend` is executed
- **THEN** the build completes without errors
