## Why

Establishing a clear frontend/backend split now prevents churn later and aligns the repo with the Angular/.NET architecture described in the project docs. A minimal baseline structure unblocks follow-on setup work while keeping the repo organized for demo-ready development.

## What Changes

- Create top-level `frontend/` and `backend/` folders to reflect the Angular client and .NET API split.
- Add minimal placeholder documentation in each folder to describe purpose and intended stack.

## Capabilities

### New Capabilities
- `frontend-project-structure`: Baseline frontend directory with a brief README describing the Angular/Web Audio UI scope.
- `backend-project-structure`: Baseline backend directory with a brief README describing the ASP.NET Core streaming API scope.

### Modified Capabilities
- (none)

## Impact

- Repository layout and developer onboarding.
- Future build/test scripts and CI paths will reference the new folder structure.
