## Context

The repository currently lacks a defined top-level split for the Angular frontend and ASP.NET Core backend described in `docs/STACK.md` and `docs/ARCHITECTURE.md`. Establishing a minimal baseline structure now will prevent churn once concrete projects and tooling are added.

## Goals / Non-Goals

**Goals:**
- Create a stable, top-level `frontend/` and `backend/` layout aligned to the documented architecture.
- Provide lightweight, discoverable documentation in each folder to communicate intent and stack alignment.
- Keep the structure minimal so it can be extended without rework.

**Non-Goals:**
- Scaffolding actual Angular or .NET projects.
- Adding build tooling, CI pipelines, or deployment configs.
- Defining detailed API contracts or UI component designs.

## Decisions

- **Top-level split (`frontend/`, `backend/`)**: Mirrors the system boundary in the architecture diagrams and keeps client/server concerns separate. This is the simplest layout and avoids nested or monorepo tooling assumptions.
- **README placeholders per folder**: A small README in each folder communicates purpose and expected stack without committing to project tooling yet.
- **No shared `packages/` or `libs/` folder yet**: Avoids premature structure before we know whether cross-cutting code is needed.

## Risks / Trade-offs

- **Risk: minimal structure may need later refactor** → Mitigation: keep placeholders and update docs as soon as tooling is introduced.
- **Risk: naming conflicts with future tooling (e.g., workspace roots)** → Mitigation: choose standard, well-known folder names and document usage early.
- **Trade-off: minimalism delays conventions (linting, tests)** → Mitigation: capture those decisions in follow-on tasks once the baseline is established.

## Migration Plan

- Add `frontend/` and `backend/` directories with brief README placeholders.
- Update any future tooling to target these roots explicitly.

## Open Questions

- Should a shared `docs/` or `scripts/` folder be introduced once tooling begins?
