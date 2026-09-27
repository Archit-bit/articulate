# Articulate developer handoff

Articulate is a browser-based speaking coach. The React client captures speech, sends recordings or live audio to Gemini, renders coaching feedback, and stores practice history in the current browser. The architecture is shown in [architecture.svg](architecture.svg).

## Stack and runtime

- **Client:** React 19, TypeScript 5.8, Vite 6.3, browser APIs for microphone capture, audio playback, WebSocket, and `localStorage`.
- **AI SDK:** `@google/genai` 2.24; the client can call Gemini directly or use the server relay.
- **Optional server:** Node 20+, Express 5, `ws`, and `@google/genai`; deployed as a single Cloud Run service with the static Vite build.
- **Build:** `npm ci`, then `npm run build` (`tsc --noEmit && vite build`). Local development uses `npm run dev` on port 5173.
- **Persistence:** settings, sessions, phrasebank, and usage records use namespaced `localStorage` keys. Data is per browser and is not synchronized. Export/import is available in Settings.

## Source map

| Path | Responsibility |
|---|---|
| `src/App.tsx`, `src/main.tsx` | Application shell, navigation, React entry point |
| `src/screens/` | Home, drills, roleplay, history, phrasebank, and settings screens |
| `src/components/` | Recorder and reusable scorecard, attempt, usage, and debrief UI |
| `src/lib/audio.ts` | `getUserMedia`, AudioWorklet capture, downsampling to mono 16 kHz signed PCM, WAV encoding, PCM playback |
| `src/lib/gemini.ts` | Gemini client, drill/debrief prompts and schemas, model retry/fallback, friendly error translation |
| `src/lib/live.ts` | Common live-session interface over direct Gemini Live or the server WebSocket relay |
| `src/lib/engine.ts` | Engine selection, server health/passcode check, WebSocket URL construction |
| `src/lib/store.ts` | Browser persistence, reactive notifications, statistics, import/export |
| `src/lib/pricing.ts` | Local usage and cost estimates based on model usage metadata and configured prices |
| `src/lib/content.ts` | Drill prompts, presets, roleplay personas |
| `server/index.mjs` | Static hosting, health and generation HTTP endpoints, authenticated live AI relay |
| `server/mock.mjs` | Mock AI implementation for local server development |
| `Dockerfile`, `deploy-gcp.sh` | Multi-stage container build and Cloud Run deployment |
| `deploy-amplify.sh` | Upload a static ZIP to an existing Amplify app using AWS CLI credentials |

## Request and data flows

### Recorded drills

`TakeRecorder` collects 16 kHz mono PCM from the microphone, encodes a WAV, and passes base64 audio to `analyzeSpeech`. The Gemini request includes task, target duration, coaching focus, optional speaker context, and retry transcript/instruction. Structured JSON feedback includes transcript, scores, issues, word swaps, delivery notes, and the next fix. The client computes pace/filler metrics, adds phrases to the phrasebank, and persists the resulting attempt with its session.

### Live roleplay

`Mic` streams 16 kHz PCM chunks to `openLive`. Gemini Live returns audio chunks (played as 24 kHz PCM) and transcription/content events. The direct path uses a browser API key; the server path forwards JSON messages over `/api/live` and selects configured Vertex AI models with a fallback candidate when the preferred model is unavailable before response content starts.

### Engine selection

Settings support `auto`, `server`, and `gemini`. Auto mode probes `/api/health` and uses the server when reachable; otherwise it uses the direct API key. Recorded generation goes to `POST /api/generate` in server mode and to the Gemini SDK in direct mode. Both use the same prompt and response parsing code.

## Server interface and configuration

- `GET /api/health` returns service identity, passcode configuration/validity, coach location, and live model candidates. The client supplies the passcode in `x-app-passcode` for the validity check.
- `POST /api/generate` requires `x-app-passcode` and a JSON body `{ model, contents, config }`. It returns `{ text, usageMetadata, model }` or an error object.
- `WS /api/live?passcode=...` authenticates the passcode in the upgrade URL. Client messages are `start`, `audio`, `content`, and `end`; server events are `open`, `message`, `error`, and `close`.
- `APP_PASSCODE` is required to enable protected AI endpoints. `GOOGLE_CLOUD_PROJECT` (or `GCLOUD_PROJECT`) selects the Vertex project. `COACH_LOCATION` defaults to `global`; `LIVE_MODELS` overrides the comma-separated `model@location` fallback list. `PORT` defaults to 8080. `MOCK_AI=1` selects the local mock provider.
- Cloud Run uses its service account for Vertex AI authentication. The browser holds only the shared passcode in this mode; no Google API key is embedded in the build.
- The server currently sends permissive `Access-Control-Allow-Origin: *` on `/api`; requests still require the shared passcode. The passcode is a shared team secret, not per-user identity or rate limiting.

## Configuration and privacy

- `.env.example` documents `VITE_GEMINI_API_KEY`. `.env.local` is ignored by Git and only read when `import.meta.env.DEV` is true. Production builds do not use this fallback.
- In direct mode, the user-provided Gemini key is stored in browser local storage. In server mode, the passcode and preferences are stored there. Use Settings export to back up records; exports deliberately blank the API key.
- Audio is transmitted to Google AI for analysis/live response. App history and phrasebank remain local. Avoid confidential speech when using an AI Studio free-tier key, per the project README.
- Do not commit `.env.local`, generated ZIPs, `node_modules`, or `dist`; the root `.gitignore` excludes them.

## Build and deployment

```sh
npm ci
npm run build
npm run dev
```

- **Cloud Run + Vertex AI:** `npm run package:gcp` creates the source archive; in Google Cloud Shell extract it, select a project, and run `bash deploy-gcp.sh`. The script enables required APIs, grants Cloud Run build/Vertex roles to the default compute service account, and deploys region `asia-south1` by default. Docker builds the Vite app and runs `server/index.mjs`.
- **AWS Amplify static hosting:** `npm run package` builds `dist` and creates `articulate-site.zip`. `deploy-amplify.sh` uploads that archive to an existing Amplify app through the AWS CLI; it searches configured/default regions for the app name `articulate`.
- **External static host with Vertex server:** set Engine to Google Cloud server and set Server address to the Cloud Run origin in Settings. Microphone capture requires localhost or a secure context (HTTPS).

## Extension points

- Add or tune drill content and roleplay personas in `src/lib/content.ts`.
- Adjust the coach rubric, structured response schema, debrief, and model fallbacks in `src/lib/gemini.ts`.
- Extend persistent records/settings via `src/lib/types.ts` and `src/lib/store.ts`; maintain backward-compatible defaults in `getSettings` and defensive reads.
- Add server-only routes and Vertex behavior in `server/index.mjs`; keep the direct and server engine interfaces aligned in `src/lib/engine.ts` and `src/lib/live.ts`.

## Operational notes

- Server health status is cached in memory by URL/passcode pair; Settings can force a connection test.
- Live model candidates are cached by the server as the preferred candidate after one succeeds. Fallback only occurs for the recognized unavailable-model close condition before any response content.
- Cost shown in the app is an estimate based on the client browser's recorded requests, not a billing export; authoritative spend lives in Google Cloud or AI Studio billing.
- The source tree does not currently contain a Git repository. Set the intended GitHub remote before pushing this handoff and application.
