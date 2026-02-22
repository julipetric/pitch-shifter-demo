# Deploying the frontend (Hello World) to Azure

This guide walks you through everything you need to build and deploy the **pitch-shifter-demo-frontend** Angular app to Azure so the hello-world app is reachable in the cloud.

---

## Prerequisites

- **Node.js and npm**  
  - Use a current LTS version (e.g. Node 20.x or 22.x).  
  - Check: `node -v` and `npm -v`.

- **Azure account**  
  - An [Azure subscription](https://azure.microsoft.com/en-us/free/) (free tier is enough for this demo).

- **Azure CLI (optional but recommended)**  
  - Install: [Install the Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli).  
  - Log in: `az login`.  
  - You can do the same steps in the [Azure Portal](https://portal.azure.com) if you prefer.

- **Git**  
  - Repo cloned locally so you can run the build from the project root.

---

## Build the app locally

From the **repository root**:

```bash
cd frontend
npm ci
npm run build
```

- **Build output (important for deployment):**  
  Static files are emitted under:

  ```text
  frontend/dist/pitch-shifter-demo-frontend/browser/
  ```

  This folder contains `index.html`, JS, CSS, and assets. Any Azure static hosting needs to serve the contents of this **browser** folder as the site root.

---

## Option A: Azure Static Web Apps (recommended)

Static Web Apps is well-suited for Angular single-page apps and gives you a URL like `https://<name>.azurestaticapps.net`.

### 1. Create the Static Web App in Azure

- **Portal:** [Create Static Web App](https://portal.azure.com/#create/Microsoft.StaticApp)  
  - Subscription and resource group of your choice.  
  - Name: e.g. `pitch-shifter-demo-frontend`.  
  - Plan: Free.  
  - **Build Details:**  
    - Source: “Other” (we’ll deploy from local build or GitHub later).  
  - You can leave Region as default.

- **Azure CLI (alternative):**

  ```bash
  az staticwebapp create \
    --name pitch-shifter-demo-frontend \
    --resource-group <your-rg> \
    --source "" \
    --location eastus2
  ```

  Then open the resource in the portal to finish configuration (e.g. manual deploy or GitHub).

### 2. Configuration for this repo

When connecting a **build from this repo**, use:

| Setting              | Value                                                                 |
|----------------------|-----------------------------------------------------------------------|
| **App location**     | `frontend`                                                            |
| **Build output**     | `frontend/dist/pitch-shifter-demo-frontend/browser`                   |

- **Api location:** leave empty for this hello-world app.  
- **Build command:** e.g. `npm run build --prefix frontend` or run `npm ci && npm run build` inside `frontend` (depends how your pipeline is set up).

If you deploy **manually** (e.g. with [SWA CLI](https://azurestaticwebapps.dev/docs/cli/)), build locally as above, then deploy the contents of `frontend/dist/pitch-shifter-demo-frontend/browser` as the app:

```bash
cd frontend
npx @azure/static-web-apps-cli deploy dist/pitch-shifter-demo-frontend/browser --env production
```

(You’ll be prompted to log in and select or create a Static Web App the first time.)

### 3. Get the app URL

- In the Azure Portal, open your Static Web App → **Overview**.  
- Use the **URL** (e.g. `https://pitch-shifter-demo-frontend.azurestaticapps.net`).  
- Opening it should show the Angular hello-world page (toolbar + “Hello world” card).

---

## Option B: Azure App Service (static site)

You can also host the same static files on **App Service** (e.g. a Windows or Linux app with static file serving).

### 1. Create a web app

- **Portal:** Create a **Web App**, runtime e.g. “Static Web App” or “Node” (we only serve static files; no Node process required).  
- Or with CLI:

  ```bash
  az webapp create \
    --resource-group <your-rg> \
    --plan <your-app-service-plan> \
    --name pitch-shifter-demo-frontend \
    --runtime "NODE:20-lts"
  ```

### 2. Deploy the built files

- **Build output path to deploy:**  
  Upload or deploy the contents of `frontend/dist/pitch-shifter-demo-frontend/browser` as the site root.

- **Ways to deploy:**  
  - **Azure CLI:** zip the `browser` folder and run `az webapp deploy --resource-group <rg> --name pitch-shifter-demo-frontend --src-path <path-to-zip> --type static`.  
  - **VS Code:** Azure App Service extension → “Deploy to Web App” and choose the `browser` folder (or a zip of it).  
  - **GitHub Actions / Azure DevOps:** build in CI, then deploy the `browser` folder (or its zip) to the web app.

### 3. SPA fallback (optional)

For client-side routing, configure the server to serve `index.html` for non-file routes. In App Service you can use a `web.config` (IIS) or a static `staticwebapp.config.json` if the stack supports it; exact steps depend on the runtime you chose.

---

## Required configuration summary

| Item                | Value                                                                 |
|---------------------|-----------------------------------------------------------------------|
| **Project path**    | `frontend` (from repo root)                                           |
| **Build command**   | `npm run build` (run inside `frontend`)                              |
| **Build output**    | `frontend/dist/pitch-shifter-demo-frontend/browser`                   |
| **Site root**       | Contents of the `browser` folder (index.html at root)                 |
| **Deployment source** | Azure Static Web Apps (GitHub/CLI/manual) or App Service (zip/CLI/extension) |

---

## Verify deployment

1. Open the app URL (Static Web Apps or App Service).  
2. You should see the **pitch-shifter-demo-frontend** toolbar and the “Hello world” card.  
3. If you see a blank page, check that the **site root** is set to the **browser** folder (or that `index.html` is at the root of what’s deployed) and that base href is correct (default `/` is fine for root).

---

## Next steps (optional)

- Add a **custom domain** and **HTTPS** in the Azure resource (usually one-click).  
- Wire up **GitHub Actions** or **Azure DevOps** to build and deploy on push.  
- For production, consider **staging slots** and **environment-specific config** (e.g. API base URL via environment or app settings).
