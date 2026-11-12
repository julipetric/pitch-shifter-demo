# Azure Backend Deployment (App Service)

This document explains how to publish `backend/pitch-shifter-demo-backend` to Azure App Service.

## Prerequisites

- Azure subscription with permission to create Resource Groups, App Service Plans, and Web Apps.
- Azure CLI (`az`) or access to the Azure Portal.
- .NET SDK 8 (used to build/publish the backend).

Verify installs:
- `az --version`
- `dotnet --version`

## 1) Build and publish the backend

From the repo root:

```
dotnet publish backend/pitch-shifter-demo-backend -c Release -o publish
```

Before publishing, ensure a demo audio file exists in `backend/pitch-shifter-demo-backend/Content/Samples`.
If you use a different location or filename, set `Audio__SamplesPath` and optional
`Audio__DefaultFileName` in App Settings (see step 4).

## 2) Create Azure resources (CLI)

Use existing resources if you already have them.

```
az login
az group create --name <resource-group> --location <location>
az appservice plan create --name <app-plan> --resource-group <resource-group> --sku B1
az webapp create --name <app-name> --resource-group <resource-group> --plan <app-plan> --runtime "dotnet:8"
```

Notes:
- If you already have a Resource Group, skip the `az group create` step and reuse your existing group name.
- `<app-plan>` is the **App Service Plan** name. It defines the pricing tier, region, OS, and compute resources that host your web app.
- The plan is a **Windows** plan (the default). NAudio.Lame bundles a Windows build of LAME, which the
  published output contains. A Linux plan needs the container image from `backend/Dockerfile`, which
  installs `libmp3lame`; see [DEPLOYMENT.md](DEPLOYMENT.md).
- `<app-name>` must be globally unique (this becomes `<app-name>.azurewebsites.net`).

## 3) Deploy the published output

Create a zip of the published output (PowerShell):

```
Compress-Archive -Path publish\* -DestinationPath publish.zip -Force
```

Deploy the zip:

```
az webapp deploy --resource-group <resource-group> --name <app-name> --src-path publish.zip
```

## 4) Configure application settings

Set required environment variables:

```
az webapp config appsettings set --resource-group <resource-group> --name <app-name> --settings ASPNETCORE_ENVIRONMENT=Production
```

Configuration notes:
- App Service manages the listening port; do not hardcode a port in the app.
- Browser calls from another origin are rejected unless that origin is listed in `Cors__AllowedOrigins__0`
  (`Cors__AllowedOrigins__1`, ... for more). Set it to the origin that serves the frontend, for example
  `az webapp config appsettings set --resource-group <resource-group> --name <app-name> --settings "Cors__AllowedOrigins__0=https://<frontend-host>"`.
- Audio streaming defaults to `Content/Samples`; to target a specific file, set `Audio__SamplesPath=Content/Samples` and `Audio__DefaultFileName=<your-file.ext>`. Set `Audio__EnableFallbackTone=false` to disable the generated demo tone when no file is available.

## 5) Validate the deployment

Open:

```
https://<app-name>.azurewebsites.net/health
```

You should receive HTTP 200 with a JSON status body (for example `{"status":"ok"}`).

**Swagger UI** is enabled by default when deployed, so you can open:

```
https://<app-name>.azurewebsites.net/swagger
```

to see and try the `/api/audio/stream` endpoint. To disable Swagger in production, set app setting `Swagger__Enabled` to `false` (e.g. `az webapp config appsettings set ... --settings Swagger__Enabled=false`).

## Troubleshooting

- **Test tone instead of sample:** Windows App Service lacks the ACM MP3 codec. The backend uses NLayer's managed decoder; redeploy and check `/diagnostics/audio` if issues persist.
- **NAudio assembly errors:** Redeploy after a clean build (`dotnet publish`). An `AssemblyResolve` handler redirects legacy NAudio references to NAudio.Core.
