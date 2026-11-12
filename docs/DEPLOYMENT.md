# Deployment

The app is two deployables: the ASP.NET Core API (`backend/`) and the static Angular bundle
(`frontend/`). There are two supported layouts.

| Layout | Origins | Use it for |
|--------|---------|------------|
| Docker Compose | One. nginx serves the bundle and proxies the API. | Local runs, demos, any host that runs containers. |
| Split hosting (Azure) | Two. Static hosting for the bundle, App Service for the API. | The free-tier cloud layout described in [STACK.md](STACK.md). |

## Docker Compose (one origin)

```bash
docker compose up --build
```

The app is served on <http://localhost:8080>. Set `APP_PORT` to use another host port:

```bash
APP_PORT=9000 docker compose up --build
```

How the pieces fit:

- **`backend`** builds from `backend/Dockerfile` (SDK image to compile, ASP.NET runtime image to
  run). It listens on port 8080 inside the compose network and publishes nothing on the host.
  The image installs `libmp3lame`, which NAudio.Lame needs on Linux to encode processed audio.
- **`frontend`** builds from `frontend/Dockerfile` (Node to compile, nginx to serve). nginx
  forwards `/api`, `/health`, `/diagnostics` and `/swagger` to `BACKEND_UPSTREAM`
  (default `backend:8080`) and serves the Angular bundle for every other path, so the browser
  only talks to its own origin and no CORS configuration is involved.
- The bundle is built with an empty `AUDIO_API_BASE_URL`, which makes API calls relative to the
  page origin.

Backend settings can be passed as environment variables on the `backend` service, using `__`
for nested keys (for example `Audio__DefaultFileName=my-track.mp3`). The full list is in the
[backend README](../backend/README.md#configuration).

To run the backend tests inside Docker:

```bash
docker build --target test ./backend
```

### Running the images separately

```bash
docker build -t pitch-shifter-backend ./backend
docker build -t pitch-shifter-frontend ./frontend

docker network create pitch-shifter
docker run -d --network pitch-shifter --name backend pitch-shifter-backend
docker run -d --network pitch-shifter -p 8080:80 -e BACKEND_UPSTREAM=backend:8080 pitch-shifter-frontend
```

To serve the bundle from a different origin than the API, build the frontend image with the API
address and allow that origin on the backend:

```bash
docker build -t pitch-shifter-frontend --build-arg AUDIO_API_BASE_URL=https://api.example.com ./frontend
# backend: Cors__AllowedOrigins__0=https://app.example.com
```

## Azure (split hosting)

```
Browser ──► Azure Static Web Apps (Angular bundle)
   │
   └──────► Azure App Service (ASP.NET Core API)   ◄── CORS allows the Static Web Apps origin
```

Detailed walkthroughs:

- [Backend on App Service](AZURE-BACKEND-DEPLOY.md)
- [Frontend on Static Web Apps or App Service](azure-frontend-deploy.md)

The steps in short. Replace the placeholders in angle brackets.

### 1. Backend

Use a **Windows** App Service plan: NAudio.Lame ships a Windows build of LAME, which is what
the published output contains. (On Linux, deploy the backend container image instead; it
installs `libmp3lame`.)

```bash
dotnet publish backend/pitch-shifter-demo-backend -c Release -o publish
(cd publish && zip -r ../publish.zip .)
az webapp deploy --resource-group <resource-group> --name <backend-app> --src-path publish.zip --type zip
```

PowerShell:

```powershell
dotnet publish backend/pitch-shifter-demo-backend -c Release -o publish
Compress-Archive -Path publish\* -DestinationPath publish.zip -Force
az webapp deploy --resource-group <resource-group> --name <backend-app> --src-path publish.zip
```

Allow the frontend origin (the API rejects cross-origin browser calls from any other origin):

```bash
az webapp config appsettings set --resource-group <resource-group> --name <backend-app> \
  --settings "Cors__AllowedOrigins__0=https://<frontend-host>"
```

Check `https://<backend-app>.azurewebsites.net/health`.

### 2. Frontend

Build the bundle against the deployed API and publish the `browser` output folder:

```bash
cd frontend
npm ci
npx ng build --configuration production --define AUDIO_API_BASE_URL="'https://<backend-app>.azurewebsites.net'"
npx @azure/static-web-apps-cli deploy dist/pitch-shifter-demo-frontend/browser --env production \
  --app-name <frontend-app> --resource-group <resource-group>
```

PowerShell:

```powershell
cd frontend
npm ci
npx ng build --configuration production --define "AUDIO_API_BASE_URL='https://<backend-app>.azurewebsites.net'"
npx @azure/static-web-apps-cli deploy dist/pitch-shifter-demo-frontend/browser --env production --app-name <frontend-app> --resource-group <resource-group>
```

The value passed to `--define` is a JavaScript string literal, hence the inner single quotes.

### Operational notes

- Free-tier plans cold-start; the first request after idle time is slow.
- Every processed request is rendered on the fly, so keep the sample short and expect
  CPU-bound latency under concurrent use.
- Swagger UI is on by default; set `Swagger__Enabled=false` to hide it.
