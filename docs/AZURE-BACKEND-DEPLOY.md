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

## 2) Create Azure resources (CLI)

Use existing resources if you already have them.

```
az login
az group create --name <resource-group> --location <location>
az appservice plan create --name <app-plan> --resource-group <resource-group> --sku B1 --is-linux
az webapp create --name <app-name> --resource-group <resource-group> --plan <app-plan> --runtime "DOTNET|8.0"
```

Notes:
- If you already have a Resource Group, skip the `az group create` step and reuse your existing group name.
- `<app-plan>` is the **App Service Plan** name. It defines the pricing tier, region, OS, and compute resources that host your web app.
- For Windows plans, remove `--is-linux` and keep the runtime as `DOTNET|8.0`.
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
- Additional settings can be added here as the backend grows (e.g., storage, auth).

## 5) Validate the deployment

Open:

```
https://<app-name>.azurewebsites.net/health
```

You should receive HTTP 200 with a JSON status body (for example `{"status":"ok"}`).
