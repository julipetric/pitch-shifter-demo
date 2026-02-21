## ADDED Requirements

### Requirement: Setup scripts are provided
The repository MUST include setup scripts under `scripts/` for Windows and macOS/Linux that check and install required dependencies.

#### Scenario: Setup scripts exist
- **WHEN** a developer lists the `scripts/` directory
- **THEN** they can find setup scripts for Windows and for macOS/Linux

### Requirement: Dependency checks are explicit
Each setup script MUST check for the required tools/SDKs/frameworks and report which are already installed and which are missing.

#### Scenario: Script reports status for each dependency
- **WHEN** a developer runs the setup script
- **THEN** the output shows a status for every required install

### Requirement: Missing dependencies are installable
If a required dependency is missing, the setup script MUST attempt installation using the platform's standard package manager, or provide manual installation guidance when a package manager is unavailable.

#### Scenario: Script installs missing dependencies
- **WHEN** a required dependency is missing and a package manager is available
- **THEN** the script installs it or reports a clear failure with next steps
