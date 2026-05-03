# External Integrations

**Analysis Date:** 2026-05-03

## APIs & External Services

**Firebase (Google Cloud):**
- Firebase Firestore — primary database; multi-tenant structure under `empresas/{empresaId}/`
  - SDK: `firebase` `^12.12.0` (client), `firebase-admin` `^13.0.0` (server)
  - Client initialized in `mp-react/src/firebase.js`
  - Admin initialized in `functions/index.js`
- Firebase Auth — email/password authentication for company admins
  - Client: `getAuth`, `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `signOut`, `onAuthStateChanged` — all via `mp-react/src/firebase.js`
  - Server: `admin.auth().verifyIdToken()` used in Cloud Function to validate Bearer tokens from the Chrome extension (`functions/index.js` lines 29–33)
- Firebase Storage — photo uploads (OS evidence photos)
  - Bucket configured via `VITE_FIREBASE_STORAGE_BUCKET`
  - CORS rules: `cors.json` (wildcard origin, all methods)
  - Storage rules file: `storage.rules` (referenced in `firebase.json`)
  - Upload helper: `mp-react/src/firebase.js` `uploadFoto()` — stores under `empresas/{empresaId}/fotos/{osId}/`
- Firebase Cloud Functions (Gen 2 / v2 HTTP) — `us-central1`
  - Deployed function: `criarOSFromExtension` at `https://us-central1-checklist-53795.cloudfunctions.net/criarOSFromExtension`
  - Source: `functions/index.js`
  - Triggered by Chrome extension via POST with Bearer token
  - Runtime: `nodejs20` per `firebase.json`; Node engine declared as `22` in `functions/package.json`

**Third-party Insurance Portals (scraped, not integrated via API):**
- Tempo Assist: `https://portal.tempoassist.com.br/` and `https://novo-portal-prestador.prd.tempoassist.cloud/`
- Maxpar: `https://prestador.maxpar.com/` and `https://sistemas.maxpar.com.br/`
- Allianz: `https://portal.allianz.com.br/`
- Mondial (Vianet): `https://vianet.webmondial.com.br/`
- Scraping done via content scripts (`assisthub-extension/content-scripts/scraper.js`) — DOM parsing only, no API calls

## Data Storage

**Databases:**
- Cloud Firestore (NoSQL)
  - Connection env vars: `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_API_KEY` (client)
  - Client: Firebase JS SDK `getFirestore()`
  - Collections: `empresas/{id}`, `empresas/{id}/checklist`, `empresas/{id}/config`, `empresas/{id}/tecnicos`, `empresas/{id}/orcamentos`, `usuarios/{uid}`, `config/superadmin`
  - Security rules: `firestore.rules` (multi-tenant isolation by `empresaId`)

**File Storage:**
- Firebase Storage
  - Path pattern: `empresas/{empresaId}/fotos/{osId}/{timestamp}.{ext}`
  - Used for OS evidence photos uploaded from FormPage/AdminPage

**Caching:**
- None detected. No Redis, Memcache, or service worker cache strategy.

## Authentication & Identity

**Auth Provider:**
- Firebase Authentication (email/password only)
  - Web app: `mp-react/src/contexts/AuthContext.jsx` — `AuthProvider` wraps the entire app
  - Login: `signInWithEmailAndPassword`
  - Register: `createUserWithEmailAndPassword`
  - Session: `onAuthStateChanged` listener; persists across page reloads via Firebase SDK default persistence
  - Chrome extension: stores Firebase ID token in `chrome.storage.local` (`authToken` key); token passed as `Authorization: Bearer <token>` to Cloud Function
  - Token validation: Cloud Function calls `admin.auth().verifyIdToken()` server-side
  - Superadmin: identified by email match against `VITE_SUPERADMIN_EMAIL` env var (client-side) and Firestore `/config/superadmin` document (Firestore rules)

## Monitoring & Observability

**Error Tracking:**
- None detected. No Sentry, Datadog, or similar SDK imports found.

**Logs:**
- `console.error` used in `AuthContext.jsx` and `background/service-worker.js`
- Firebase Cloud Functions emit logs via `console.log` / `console.error` to Google Cloud Logging automatically

## CI/CD & Deployment

**Hosting:**
- Frontend: Vercel
  - Config: `mp-react/vercel.json` — single rewrite rule `/*` → `/` for SPA routing
  - Production URL: `https://mp-servi-os.vercel.app`
- Backend: Firebase
  - Firestore rules deployed via Firebase CLI: `firebase deploy --only firestore:rules`
  - Cloud Functions deployed via Firebase CLI: `firebase deploy --only functions`
  - Project ID: `checklist-53795` (inferred from Cloud Functions URL)

**CI Pipeline:**
- None detected. No GitHub Actions, CircleCI, or similar config files found.

## Environment Configuration

**Required env vars (frontend — `mp-react/.env`):**
- `VITE_FIREBASE_API_KEY` — Firebase Web API key
- `VITE_FIREBASE_AUTH_DOMAIN` — Firebase Auth domain (e.g. `checklist-53795.firebaseapp.com`)
- `VITE_FIREBASE_PROJECT_ID` — Firebase project ID (e.g. `checklist-53795`)
- `VITE_FIREBASE_STORAGE_BUCKET` — Firebase Storage bucket
- `VITE_FIREBASE_MESSAGING_SENDER_ID` — Firebase Cloud Messaging sender ID
- `VITE_FIREBASE_APP_ID` — Firebase app ID
- `VITE_SUPERADMIN_EMAIL` — (optional) email of the superadmin user; hardcoded fallback exists in `mp-react/src/firebase.js`

**Runtime env vars (Cloud Functions):**
- `APP_URL` — base URL of the web app; defaults to `https://mp-servi-os.vercel.app`

**Secrets location:**
- Frontend secrets: Vercel project environment variables (for production); `mp-react/.env` (local dev, gitignored per `mp-react/.gitignore`)
- Cloud Function secrets: Firebase environment config or Google Cloud Secret Manager (not explicitly configured in checked files)

## Webhooks & Callbacks

**Incoming:**
- `POST https://us-central1-checklist-53795.cloudfunctions.net/criarOSFromExtension` — called by Chrome extension service worker to create an OS in Firestore; requires `Authorization: Bearer <firebase-id-token>` header (`functions/index.js`)

**Outgoing:**
- None detected. No webhook dispatch or outgoing HTTP calls from the web app to external services.

## Chrome Extension Integration

**Extension ↔ Web App communication:**
- `chrome.runtime.onMessageExternal` — Web app sends `setAuth` message with Firebase ID token and `empresaSlug` after user logs in with `?extension=auth` query param (`assisthub-extension/background/service-worker.js` lines 30–40)
- `chrome.storage.local` — stores `authToken` and `empresaSlug` persistently within the extension
- `externally_connectable` in `manifest.json` restricts external messages to `https://mp-servi-os.vercel.app/*`

**Extension ↔ Cloud Function communication:**
- Service worker calls `criarOSFromExtension` via `fetch()` with Bearer token
- Extension host permissions include `https://us-central1-checklist-53795.cloudfunctions.net/*`

---

*Integration audit: 2026-05-03*
