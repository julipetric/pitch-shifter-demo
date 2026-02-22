## Purpose

Define the baseline backend directory structure and documentation.
TBD: expand once the ASP.NET Core API is scaffolded.

## Requirements

### Requirement: Backend directory baseline
The repository MUST include a top-level `backend/` directory with a `README.md` describing the intended server scope and a `pitch-shifter-demo-backend/` Minimal API project.

#### Scenario: Baseline backend folder present
- **WHEN** the repository root is inspected
- **THEN** a `backend/` directory exists containing `README.md` and `pitch-shifter-demo-backend/`

#### Scenario: Backend project scaffold present
- **WHEN** the `backend/pitch-shifter-demo-backend/` directory is inspected
- **THEN** it contains `pitch-shifter-demo-backend.csproj` and `Program.cs`

### Requirement: Backend README scope statement
The `backend/README.md` MUST describe that the server is an ASP.NET Core Minimal API focused on audio streaming and processing, referencing NAudio and an `IAudioProcessor`-style abstraction.

#### Scenario: Backend README describes scope
- **WHEN** a developer opens `backend/README.md`
- **THEN** the document references ASP.NET Core Minimal API and audio processing/streaming intent
