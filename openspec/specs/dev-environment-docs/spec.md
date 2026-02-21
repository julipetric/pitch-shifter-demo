## Purpose

Document required tooling and verification steps for local development.
TBD: refine once the final toolchain is established.

## Requirements

### Requirement: Developer setup documentation exists
The repository MUST include a setup document at `docs/SETUP.md` that describes how to prepare a local development environment.

#### Scenario: Setup document is discoverable
- **WHEN** a developer opens `docs/SETUP.md`
- **THEN** they can find the project setup instructions

### Requirement: Required tooling is fully documented
The setup document MUST list every required tool, SDK, and framework that must be installed to run the project, and MUST explain what each is used for in this codebase.

#### Scenario: Tooling list includes purpose per item
- **WHEN** a developer reads the setup document
- **THEN** each required install has a short purpose statement tied to frontend or backend usage

### Requirement: Installation verification guidance
The setup document MUST provide a basic verification command or check for each required install (for example, `dotnet --version`).

#### Scenario: Developer can verify installs
- **WHEN** a developer follows the setup document
- **THEN** they can run a command to confirm each required tool is installed
