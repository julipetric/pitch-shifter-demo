## MODIFIED Requirements

### Requirement: Backend directory baseline
The repository MUST include a top-level `backend/` directory with a `README.md` describing the intended server scope and a `pitch-shifter-demo-backend/` Minimal API project.

#### Scenario: Baseline backend folder present
- **WHEN** the repository root is inspected
- **THEN** a `backend/` directory exists containing `README.md` and `pitch-shifter-demo-backend/`

#### Scenario: Backend project scaffold present
- **WHEN** the `backend/pitch-shifter-demo-backend/` directory is inspected
- **THEN** it contains `pitch-shifter-demo-backend.csproj` and `Program.cs`
