# Build context: ./frontend

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Base URL the browser uses for API calls. Empty means same origin, which is what the nginx
# stage below serves. Set it (e.g. https://api.example.com) when the API lives elsewhere.
ARG AUDIO_API_BASE_URL=""
RUN npx ng build --configuration production \
    --define AUDIO_API_BASE_URL="'${AUDIO_API_BASE_URL}'"

FROM nginx:1.27-alpine AS runtime

# The nginx image renders every file in /etc/nginx/templates with the container's environment.
ENV BACKEND_UPSTREAM=backend:8080
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/pitch-shifter-demo-frontend/browser /usr/share/nginx/html

EXPOSE 80
