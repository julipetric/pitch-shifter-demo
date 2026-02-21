# Development Setup

This project uses an Angular frontend and an ASP.NET Core backend. Use this guide
to install the required tools and verify they are available on your machine.

## Required installs

### 1) Git
- **Used for:** cloning the repository and managing source control.
- **Verify:** `git --version`

### 2) Node.js (LTS) with npm
- **Used for:** frontend tooling and package installation.
- **Verify:** `node --version` and `npm --version`

### 3) Angular CLI
- **Used for:** running the Angular dev server and scaffolding frontend code.
- **Verify:** `ng version`

### 4) .NET SDK (8.x)
- **Used for:** building and running the ASP.NET Core Minimal API backend
  (including restoring NuGet dependencies like NAudio).
- **Verify:** `dotnet --version` and `dotnet --list-sdks`

## Optional tools

- **Editor/IDE:** VS Code, Visual Studio, or Rider.
- **API testing:** Postman or curl.

## Automated setup (recommended)

Run the OS-specific setup script from the repository root. The scripts check for
each required install and attempt to install missing items using the platform's
package manager.

### Windows (PowerShell)

```
powershell -ExecutionPolicy Bypass -File .\scripts\dev-setup.ps1
```

To only check without installing:
```
powershell -ExecutionPolicy Bypass -File .\scripts\dev-setup.ps1 -CheckOnly
```

### macOS / Linux (bash)

```
bash ./scripts/dev-setup.sh
```

To only check without installing:
```
bash ./scripts/dev-setup.sh --check
```

## Manual install notes

If a package manager is not available or an install fails, the scripts will
print guidance for manual installation. Use the verification commands above
after installing each tool.
