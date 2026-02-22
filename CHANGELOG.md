# Changelog

All notable changes to this project are documented here.

The format is inspired by Keep a Changelog and currently tracks milestone-level updates from the existing git history.

## [2026-02-22] Frontend Boilerplate + Spec Finalization

### Added
- Angular frontend boilerplate in `frontend/` (workspace config, TypeScript setup, app shell, routing, and styles).
- Frontend dependency manifest and lockfile (`frontend/package.json`, `frontend/package-lock.json`).
- Deployment guide for Azure frontend hosting in `docs/azure-frontend-deploy.md`.
- Main OpenSpec specs for frontend app and Azure deploy docs in `openspec/specs/`.
- Archived OpenSpec change artifacts under `openspec/changes/archive/2026-02-22-frontend-boilerplate/`.

### Changed
- Updated root `README.md` and `frontend/README.md` with frontend/deployment context.
- Updated developer bootstrap scripts (`scripts/dev-setup.ps1`, `scripts/dev-setup.sh`) to include latest workflow/setup steps.
- Updated frontend project-structure spec in `openspec/specs/frontend-project-structure/spec.md`.

## [2026-02-22] Initial OpenSpec Definition

### Added
- Introduced OpenSpec change artifacts for `frontend-boilerplate`:
  - Proposal and design docs.
  - Tasks and per-area delta specs (frontend app, project structure, Azure deploy docs).

### Changed
- Extended setup scripts (`scripts/dev-setup.ps1`, `scripts/dev-setup.sh`) alongside spec onboarding.

## [2026-02-21] Initial Project Scaffolding

### Added
- Bootstrapped the repository structure and initial project scaffolding.

## [2026-02-21] Initial Setup and Baseline Documents

### Added
- Established baseline documentation and initial setup materials.
