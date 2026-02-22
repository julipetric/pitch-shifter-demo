## Purpose

Define the deployment walkthrough documentation for deploying the backend to Azure App Service.

## Requirements

### Requirement: Backend Azure deployment document exists
A deployment walkthrough document for the backend MUST exist at `docs/AZURE-BACKEND-DEPLOY.md` and be referenced from either the repo root README or `backend/README.md`.

#### Scenario: Deployment document is discoverable
- **WHEN** the repository is inspected
- **THEN** `docs/AZURE-BACKEND-DEPLOY.md` exists and is referenced from a top-level README

### Requirement: Document covers prerequisites
The deployment walkthrough MUST list prerequisites such as Azure subscription access, Azure CLI or portal access, and the required .NET SDK version for publishing.

#### Scenario: Prerequisites are documented
- **WHEN** a reader opens the backend deployment walkthrough
- **THEN** prerequisites are listed with brief purpose statements

### Requirement: Document covers App Service setup and deployment
The walkthrough MUST describe how to create or select an Azure Resource Group, App Service Plan, and Web App, and how to deploy the published backend using a supported method (e.g., zip deploy or `az webapp deploy`).

#### Scenario: App Service steps are present
- **WHEN** a reader follows the walkthrough
- **THEN** they can create the App Service resources and deploy the backend successfully

### Requirement: Document covers configuration
The walkthrough MUST describe required configuration such as runtime stack selection, environment variables (for example `ASPNETCORE_ENVIRONMENT`), and any port or URL configuration required by Azure hosting.

#### Scenario: Configuration guidance exists
- **WHEN** a reader configures the Azure service
- **THEN** required settings are documented in the walkthrough

### Requirement: Document covers validation
The walkthrough MUST describe how to verify the deployed backend is running (for example, hitting a health endpoint).

#### Scenario: Validation steps are documented
- **WHEN** a reader completes deployment
- **THEN** they can validate the backend by following the documented steps
