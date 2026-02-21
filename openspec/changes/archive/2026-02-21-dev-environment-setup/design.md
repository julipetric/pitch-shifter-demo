## Context

The project spans an Angular frontend and an ASP.NET Core backend. Today, setup steps are scattered and partially implied by the stack/architecture docs. A dedicated setup guide and bootstrap script are needed to make onboarding deterministic.

## Goals / Non-Goals

**Goals:**
- Provide a single source of truth for required tools/SDKs/frameworks and what each is used for.
- Offer a script that checks for required dependencies and installs missing ones.
- Keep setup instructions aligned with the documented stack.

**Non-Goals:**
- Automating project scaffolding (Angular/.NET solution creation).
- Installing optional tooling (IDEs, CI agents, deployment CLIs).
- Managing runtime configuration or secrets.

## Decisions

- **Create a dedicated setup doc**: Use a top-level `docs/SETUP.md` (or `docs/DEV_SETUP.md`) to list required tooling with purpose and version guidance, keeping it easy to discover from the README.
- **Provide platform scripts**: Add `scripts/dev-setup.ps1` for Windows and `scripts/dev-setup.sh` for macOS/Linux to avoid cross-shell complexity.
- **Dependency detection first**: Scripts should check for existing installs before attempting installation; the output should be explicit about what was found vs installed.
- **Package manager usage**: Prefer native package managers (Windows `winget` with a fallback message if unavailable; macOS `brew`; Linux `apt`) and fail with guidance if a package manager is missing.
- **Doc-driven script behavior**: The script should derive its checklist from the documented requirements to keep documentation and automation aligned.

## Risks / Trade-offs

- **Risk: differing package managers across OS** → Mitigation: keep scripts per OS with clear messages and manual fallback steps.
- **Risk: automated installs can fail or require elevation** → Mitigation: detect and warn; provide manual install links in the docs.
- **Trade-off: minimal dependency list may omit optional tools** → Mitigation: explicitly document optional tools separately.

## Migration Plan

- Add the setup documentation file and reference it from the main README.
- Add OS-specific setup scripts under `scripts/`.
- Iterate on the dependency list as the project adds concrete tooling.

## Open Questions

- Should the project standardize on a single Node.js version (e.g., via `.nvmrc`) once the frontend is scaffolded?
