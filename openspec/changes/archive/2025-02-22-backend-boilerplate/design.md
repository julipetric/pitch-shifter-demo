## Context

The repository only has a placeholder backend directory, but the project needs a real ASP.NET Core Minimal API to enable backend audio-processing work and to be deployable on Azure services. The change also introduces Azure deployment documentation, so the design must keep the app layout and configuration aligned with standard Azure hosting expectations.

## Goals / Non-Goals

**Goals:**
- Scaffold a minimal ASP.NET Core backend under `backend/pitch-shifter-demo-backend` using automated tooling (no manual scaffolding).
- Keep the project layout and configuration compatible with Azure App Service (or equivalent .NET-friendly Azure hosting).
- Provide a clear Azure deployment walkthrough for the backend.

**Non-Goals:**
- Implement actual audio-processing pipelines or NAudio-based processing logic.
- Add authentication/authorization, persistence, or production hardening beyond baseline defaults.
- Set up CI/CD automation or IaC templates.

## Decisions

1. **Use `dotnet new` tooling to scaffold the backend.**
   - **Why:** Satisfies the requirement to automate boilerplate creation and aligns with common .NET workflows.
   - **Alternatives considered:** Manual file creation (rejected; violates tooling requirement).

2. **Target a Minimal API hosting model.**
   - **Why:** Lightweight and matches the intended backend scope for streaming and processing.
   - **Alternatives considered:** MVC/controllers (heavier footprint and unnecessary for the initial baseline).

3. **Keep Azure readiness focused on App Service compatibility.**
   - **Why:** App Service is a common Azure target for .NET APIs and requires minimal additional infrastructure.
   - **Alternatives considered:** Container Apps or AKS (deferred to future design if containerization becomes a requirement).

4. **Document deployment steps separately from local dev setup.**
   - **Why:** Deployment involves Azure-specific configuration that should not clutter local setup docs.
   - **Alternatives considered:** Embedding in `backend/README.md` (would be harder to find and maintain).

## Risks / Trade-offs

- **Template defaults include extra middleware (Swagger, HTTPS redirection) →** keep defaults for baseline but document what is safe to remove later.
- **Azure hosting choice may change (App Service vs containerized) →** keep docs focused on App Service while noting where adjustments are needed for other Azure services.
- **Minimal API starter does not include audio-processing abstraction →** add a placeholder interface and document expected extension points in later tasks.

## Migration Plan

1. Scaffold the backend project with `dotnet new` into `backend/pitch-shifter-demo-backend`.
2. Adjust configuration files and README to reflect backend scope and Azure readiness.
3. Add Azure deployment walkthrough documentation.
4. Rollback is a simple deletion of the new backend directory and docs if needed.

## Open Questions

- Which Azure service is preferred long-term if App Service is not sufficient?
- Which .NET LTS version should the backend target (e.g., .NET 8 vs .NET 9)?
- Should the baseline include a specific health endpoint name for monitoring?
