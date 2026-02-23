track backend:
1. dotnet publish backend/pitch-shifter-demo-backend -c Release -o publish
2. Compress-Archive -Path publish\* -DestinationPath publish.zip -Force
3. az webapp deploy --resource-group demo-apps --name pitch-shifter-demo-backend --src-path publish.zip

track frontend:
1. cd frontend
2. npm ci
3. npm run build
4. npx @azure/static-web-apps-cli deploy dist/pitch-shifter-demo-frontend/browser --env production --app-name "pitch-shifter-demo-frontend" --resource-group "demo-apps"