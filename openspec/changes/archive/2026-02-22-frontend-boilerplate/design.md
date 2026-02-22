## Context

The repo has a top-level `frontend/` directory with a README describing the intended Angular + Web Audio scope. There is no Angular app yet. We need a minimal runnable app and a clear path to deploy it on Azure so the stack and CI/CD can be validated before feature work.

## Goals / Non-Goals

**Goals:**
- Scaffold an Angular app with Angular Material in `frontend/`, project name `pitch-shifter-demo-frontend`.
- Single "Hello world" (or equivalent) view to confirm the app runs.
- Build output suitable for Azure (static assets; Azure Static Web Apps or App Service).
- One deployment walkthrough document covering prerequisites, Azure setup, build, and deploy steps.

**Non-Goals:**
- No Web Audio, waveform, or pitch/tempo features in this change.
- No backend or API integration.
- No production auth or custom domain; deployment doc can mention them as follow-ups.

## Decisions

- **Angular CLI in `frontend/`**: Use Angular CLI to generate the app inside the existing `frontend/` folder (e.g. `ng new pitch-shifter-demo-frontend --directory .` or equivalent so the app lives at `frontend/`). This keeps the repo layout and avoids a nested `frontend/pitch-shifter-demo-frontend/` unless the tooling requires it.
- **Angular Material**: Add Angular Material for UI consistency and future use; use a simple Material component (e.g. toolbar or card) on the hello-world page to verify the dependency.
- **Azure target**: Design for static export (e.g. `ng build` output) so the app can be deployed to Azure Static Web Apps or to App Service (static site). The deployment doc will specify one primary path (e.g. Static Web Apps) with optional notes for App Service.
- **Deployment doc location**: Place the walkthrough in `docs/` (e.g. `docs/azure-frontend-deploy.md`) or in `frontend/` (e.g. `frontend/DEPLOY.md`). Prefer a single file that is easy to find from the repo root; if no `docs/` exists, create it or use `frontend/DEPLOY.md`.

## Risks / Trade-offs

- **Risk**: Angular CLI may create a subfolder by default, changing the layout.  
  **Mitigation**: Use `--directory .` when creating the app in `frontend/`, or document the chosen structure in the deployment doc.
- **Trade-off**: One deployment doc may not cover every Azure option in depth.  
  **Mitigation**: Document one supported path clearly; add short "Alternative: App Service" (or similar) if useful.

## Migration Plan

- Add the Angular app and deployment doc; no migration of existing data or config.
- Rollback: remove the new app files and doc; no schema or API changes.

## Open Questions

- None; scope is limited to hello-world and one deploy path.
