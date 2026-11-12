// AUDIO_API_BASE_URL is substituted at build time by the `define` entry of the production
// configuration in angular.json; override it with
//   ng build --define AUDIO_API_BASE_URL="'https://api.example.com'"
// An empty value targets the origin that serves the app (the nginx image proxies the API there).
declare const AUDIO_API_BASE_URL: string;

export const environment = {
  production: true,
  audioApiBaseUrl: AUDIO_API_BASE_URL,
};
