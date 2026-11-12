# Build context: ./backend

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Restore first so the NuGet layer is cached until a project file changes.
COPY PitchShifterDemo.sln ./
COPY pitch-shifter-demo-backend/pitch-shifter-demo-backend.csproj pitch-shifter-demo-backend/
COPY pitch-shifter-demo-backend.Tests/pitch-shifter-demo-backend.Tests.csproj pitch-shifter-demo-backend.Tests/
RUN dotnet restore

COPY . .

# `docker build --target test ./backend` runs the xUnit suite.
FROM build AS test
RUN dotnet test --no-restore --configuration Release

FROM build AS publish
RUN dotnet publish pitch-shifter-demo-backend/pitch-shifter-demo-backend.csproj \
    --no-restore --configuration Release --output /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# NAudio.Lame bundles only Windows builds of LAME and asks the dynamic loader for
# "libmp3lame.64.dll". On Linux that name is an alias, placed beside the distribution's
# libmp3lame so the loader's default search path finds it on any CPU architecture.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libmp3lame0 \
    && rm -rf /var/lib/apt/lists/* \
    && lib="$(find /usr/lib -name 'libmp3lame.so.0' | head -n 1)" \
    && ln -s "$lib" "$(dirname "$lib")/libmp3lame.64.dll"

COPY --from=publish /app/publish ./

ENV ASPNETCORE_HTTP_PORTS=8080 \
    HttpsRedirection__Enabled=false
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "pitch-shifter-demo-backend.dll"]
