## Purpose

Define the baseline frontend directory structure and documentation.
TBD: expand once the Angular app is scaffolded.

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
