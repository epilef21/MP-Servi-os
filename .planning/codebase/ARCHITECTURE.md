<!-- refreshed: 2026-05-03 -->
# Architecture

**Analysis Date:** 2026-05-03

## System Overview

```text
┌────────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                   │
├──────────────────────────┬─────────────────────────────────────────────┤
│   Web SPA (Vercel)       │   Chrome Extension (AssistHub)              │
│   `mp-react/`            │   `assisthub-extension/`                    │
│   React 19 + Vite        │   Manifest V3 + Vanilla JS                  │
└────────────┬─────────────┴──────────────┬──────────────────────────────┘
             │  Firebase SDK (direct)      │  REST HTTP (Bearer token)
             ▼                            ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      FIREBASE PLATFORM                                 │
├─────────────────┬──────────────────┬───────────────────────────────────┤
│  Firestore      │  Firebase Auth   │  Cloud Functions (Gen 2)          │
│  Multi-tenant   │  Email/password  │  `functions/index.js`             │
│  Subcollections │  + ID token JWT  │  `criarOSFromExtension`           │
├─────────────────┴──────────────────┴───────────────────────────────────┤
│  Firebase Storage (fotos de OS, logos de empresa)                      │
└────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `main.jsx` | App bootstrap, provider tree | `mp-react/src/main.jsx` |
| `App.jsx` | Route definitions, route guards | `mp-react/src/App.jsx` |
| `AuthContext` | Auth state, login/logout/cadastrar | `mp-react/src/contexts/AuthContext.jsx` |
| `useEmpresa` | Tenant resolution from URL slug | `mp-react/src/hooks/useEmpresa.js` |
| `firebase.js` | Firebase init, Firestore helpers, multi-tenant queries | `mp-react/src/firebase.js` |
| `FormPage` | Public checklist form for technicians | `mp-react/src/pages/FormPage.jsx` |
| `AdminPage` | Protected company dashboard (OS mgmt, analytics, settings) | `mp-react/src/pages/AdminPage.jsx` |
| `LoginPage` | Auth UI + Chrome extension token handoff | `mp-react/src/pages/LoginPage.jsx` |
| `CadastroPage` | New company registration flow | `mp-react/src/pages/CadastroPage.jsx` |
| `SuperAdminPage` | Platform-wide admin panel (all companies) | `mp-react/src/pages/SuperAdminPage.jsx` |
| `OrcamentoTecnicoPage` | Public form: technician fills quote | `mp-react/src/pages/OrcamentoTecnicoPage.jsx` |
| `AprovarOrcamentoPage` | Public page: client approves quote | `mp-react/src/pages/AprovarOrcamentoPage.jsx` |
| `AvaliacaoPage` | Public satisfaction survey after OS | `mp-react/src/pages/AvaliacaoPage.jsx` |
| `criarOSFromExtension` | Cloud Function: creates OS from Chrome extension | `functions/index.js` |
| `service-worker.js` | Extension background: token storage, Cloud Function proxy | `assisthub-extension/background/service-worker.js` |
| `scraper.js` | Content script: DOM extraction from insurer portals | `assisthub-extension/content-scripts/scraper.js` |
| `popup.js` | Extension UI: portal detection, data preview, OS creation | `assisthub-extension/popup/popup.js` |

## Pattern Overview

**Overall:** Multi-tenant SaaS monorepo (3 packages — web app, cloud functions, Chrome extension). Each tenant is isolated by `empresaId` scoped into Firestore subcollections.

**Key Characteristics:**
- Tenant identity is encoded in the URL slug (`/:slug` and `/:slug/admin`)
- All Firestore reads go through the Firebase JS SDK directly from the browser (no BFF layer)
- Cloud Functions are used only for privileged operations initiated from the Chrome extension
- The Chrome extension authenticates to Firebase Auth, passes the JWT to the service worker, which forwards it to the Cloud Function

## Layers

**Presentation Layer:**
- Purpose: Page-level React components, all UI logic, forms, modals
- Location: `mp-react/src/pages/`
- Contains: 9 page components (each file is a self-contained page)
- Depends on: `firebase.js`, `AuthContext`, `useEmpresa`, `utils/`
- Used by: React Router (matched via `App.jsx`)

**State / Context Layer:**
- Purpose: Cross-cutting auth state shared via React Context
- Location: `mp-react/src/contexts/AuthContext.jsx`
- Contains: `AuthProvider`, `useAuth` hook; exposes `usuario`, `empresaId`, `isSuperAdmin`, `estaLogado`
- Depends on: `firebase.js`
- Used by: `App.jsx` (route guards), `LoginPage`, `AdminPage`, `SuperAdminPage`

**Data Access Layer:**
- Purpose: All Firestore operations, Firebase initialization, multi-tenant query helpers
- Location: `mp-react/src/firebase.js`
- Contains: Firebase app init, `db`/`storage`/`auth` singletons, named query functions (`getOSdaEmpresa`, `criarOS`, `atualizarOS`, `cadastrarEmpresa`, etc.)
- Depends on: Firebase JS SDK v12, environment variables
- Used by: All page components and AuthContext

**Custom Hooks:**
- Purpose: Reusable stateful logic extracted from pages
- Location: `mp-react/src/hooks/useEmpresa.js`
- Contains: Slug-based tenant resolution with in-memory cache, plan limit checking
- Depends on: `firebase.js`, React Router `useParams`
- Used by: `FormPage`, `AdminPage`, `OrcamentoTecnicoPage`, `AprovarOrcamentoPage`

**Utility Layer:**
- Purpose: Client-side PDF/PNG document generation
- Location: `mp-react/src/utils/`
- Contains: `pdfGenerator.js` (OS PDF), `orcamentoPdfGenerator.js` (quote PDFs: client + insurer variants), `pngGenerator.js` (OS PNG)
- Depends on: `jsPDF`, `html2canvas`
- Used by: `AdminPage`

**Backend / Cloud Functions:**
- Purpose: Privileged write operations that require server-side token verification
- Location: `functions/index.js`
- Contains: Single function `criarOSFromExtension` (HTTP, Gen 2), Node.js 20
- Depends on: `firebase-admin`, `firebase-functions`
- Used by: Chrome extension service worker only

**Chrome Extension:**
- Purpose: Scrape OS data from insurer portals, authenticate to Firebase, create OS via Cloud Function
- Location: `assisthub-extension/`
- Components: `manifest.json`, `background/service-worker.js`, `content-scripts/scraper.js`, `popup/popup.js`, `utils/selectors.js`

## Data Flow

### Technician Fills OS (Public Form)

1. Technician opens `https://mp-servi-os.vercel.app/:slug` — React Router matches `FormPage` (`mp-react/src/App.jsx:66`)
2. `useEmpresa()` queries `empresas` collection by `slug` field; result cached in module-level `cache` object (`mp-react/src/hooks/useEmpresa.js:35`)
3. FormPage renders with company branding (color, logo, insurers list from `config/geral`)
4. On submit, `criarOS(empresaId, dados)` calls `addDoc` to `empresas/{empresaId}/checklist` (`mp-react/src/firebase.js:137`)
5. Firestore rules allow unauthenticated create if no financial fields are present (`firestore.rules:107`)

### Admin Views / Manages OS

1. Admin navigates to `/:slug/admin` — `RotaAdmin` guard checks `useAuth().estaLogado`, redirects to `/login` if false (`mp-react/src/App.jsx:22`)
2. `AdminPage` calls `getOSdaEmpresa(empresaId)` to load all OS ordered by date
3. Edit, status changes, financial data updates call `atualizarOS(empresaId, osId, dados)` → `updateDoc`
4. PDF/PNG export generated client-side via `generatePDF` / `generatePNG` / `generatePDFCliente` / `generatePDFSeguradora`

### Chrome Extension Creates OS

1. User opens extension popup; `service-worker.js` checks `chrome.storage.local` for `authToken`
2. If not authenticated, popup opens `https://mp-servi-os.vercel.app/login?extension=auth&ext_id=<extId>`
3. After successful login, `LoginPage` calls `chrome.runtime.sendMessage(extId, { action: 'setAuth', token, empresaSlug })` — stored in `chrome.storage.local`
4. User navigates to insurer portal; popup sends `extrairOS` message; content script (`scraper.js`) reads DOM and returns structured data
5. Popup sends `criarOS` action to service worker with extracted data
6. Service worker POSTs to `https://us-central1-checklist-53795.cloudfunctions.net/criarOSFromExtension` with `Authorization: Bearer <token>`
7. Cloud Function verifies ID token via `admin.auth().verifyIdToken()`, resolves `empresaId` from Firestore, writes OS doc (`functions/index.js:29`)

### Technician Fills Quote / Client Approves

1. Admin sends public link `/orcamento/:slug/:orcamentoId` to technician
2. `OrcamentoTecnicoPage` loads company (via `useEmpresa`) and OS doc; technician fills items, diagnosis, and submits → `updateDoc` to `checklist/{osId}` with quote data
3. Admin sends `/aprovar/:slug/:orcamentoId` to client
4. `AprovarOrcamentoPage` shows quote; client signs (SignatureCanvas) and approves → `updateDoc` status to `aprovado`

### Satisfaction Survey

1. After OS completion admin sends `/avaliacao/:slug/:osId`
2. `AvaliacaoPage` reads the OS doc, renders star rating form
3. Submit calls `updateDoc` writing `avaliacao_nota`, `avaliacao_comentario`, `avaliacao_em` — Firestore rules allow unauthenticated update only for these fields and only once (`firestore.rules:131`)

**State Management:**
- Auth state: React Context (`AuthContext`) — single global provider
- Tenant/company data: `useEmpresa` hook with in-memory module-level cache per slug
- Page-local state: `useState` within each page component
- No Redux, Zustand, or other state library

## Key Abstractions

**Multi-tenancy via slug:**
- Purpose: Every company has a unique URL slug; all Firestore paths are scoped to `empresas/{empresaId}/`
- Examples: `mp-react/src/hooks/useEmpresa.js`, `mp-react/src/firebase.js:93`
- Pattern: Slug → Firestore query → `empresaId` → all subsequent queries use that `empresaId`

**Plan limits:**
- Purpose: `PLANOS` object defines `limiteOS` and `preco` per plan tier
- Examples: `mp-react/src/firebase.js:77`, `mp-react/src/hooks/useEmpresa.js:71`
- Pattern: `limiteOS === -1` means unlimited; `contarOSdoMes` count compared to limit gate new OS creation

**Public-access pages (no auth):**
- Purpose: Technician form, quote fill, quote approval, and satisfaction survey are all public (no login required)
- Pattern: Routes without `RotaAdmin` wrapper; Firestore rules enforce field-level restrictions instead of auth

## Entry Points

**Web App:**
- Location: `mp-react/src/main.jsx`
- Triggers: Browser loads `index.html` → Vite module entry
- Responsibilities: Mount React tree with `ErrorBoundary`, `BrowserRouter`, `AuthProvider`, `App`

**Chrome Extension:**
- Location: `assisthub-extension/manifest.json`
- Popup: `assisthub-extension/popup/popup.html` + `popup.js`
- Background: `assisthub-extension/background/service-worker.js`
- Content script: `assisthub-extension/content-scripts/scraper.js` (injected into insurer portal pages)

**Cloud Function:**
- Location: `functions/index.js`
- Export: `criarOSFromExtension` — HTTP endpoint, auto-deployed by Firebase CLI

## Authentication / Authorization Architecture

**Roles:**
- `superadmin`: single hardcoded email (`VITE_SUPERADMIN_EMAIL`); identified in `AuthContext` and `firebase.js`; accesses `/superadmin` route; Firestore rules check `config/superadmin.email`
- `admin de empresa`: any Firebase Auth user whose `uid` matches an `empresas/{uid}` document (or linked via `usuarios/{uid}.empresaId`)
- `unauthenticated`: allowed to read company/config docs and write OS checklist/avaliação within field constraints

**Flow:**
1. `AuthProvider` calls `onAuthStateChanged` on mount
2. On user login, resolves `empresaId` from Firestore (`empresas/{uid}` direct lookup, fallback to `usuarios/{uid}`)
3. Route guards (`RotaAdmin`, `RotaSuperAdmin`) in `App.jsx` check `estaLogado` and `isSuperAdmin`
4. Firestore security rules enforce the same authorization server-side

**Extension auth flow:**
- Extension receives Firebase ID token via `chrome.runtime.sendMessage` from the web app after login
- Token stored in `chrome.storage.local`; expiry checked locally by JWT `exp` claim decode before each API call

## Architectural Constraints

- **No server-side rendering:** Pure SPA deployed on Vercel; all routing is client-side; `vercel.json` rewrites all paths to `/`
- **Direct Firestore access from browser:** No BFF or API gateway — the Firebase JS SDK is used directly; security enforced entirely by Firestore rules
- **Global in-memory cache:** `useEmpresa.js` uses a module-level `cache` object (not React state) — cache persists across component mounts within a session but is cleared on full page refresh
- **Single Cloud Function:** The only server-side compute is `criarOSFromExtension`; all other writes originate from the browser
- **components/ directory is empty:** No shared UI components exist; all reusable UI is co-located inside page files

## Anti-Patterns

### God Component — AdminPage

**What happens:** `mp-react/src/pages/AdminPage.jsx` is ~172KB and contains all admin functionality (OS list, modals, analytics charts, technician management, company profile settings, budget management) in a single file.
**Why it's wrong:** The file is extremely difficult to navigate, test, or modify incrementally; any change risks unintended side effects across unrelated features.
**Do this instead:** Extract each logical section (OS list, OS detail modal, analytics, technician CRUD, company settings, budget flow) into separate components under a new `mp-react/src/components/admin/` directory.

### Duplicate helper functions across pages

**What happens:** `fmtDate`, `fmtBRL`, `parseBRL` are copy-pasted in `AdminPage.jsx`, `OrcamentoTecnicoPage.jsx`, `AprovarOrcamentoPage.jsx`, and `pdfGenerator.js`.
**Why it's wrong:** Formatting logic diverges silently as each copy is updated independently.
**Do this instead:** Centralize formatting helpers in `mp-react/src/utils/format.js` and import from there.

## Error Handling

**Strategy:** Try/catch with `console.error` logging at the data-fetch level; UI shows inline error messages stored in local `useState`. Top-level `ErrorBoundary` (`mp-react/src/ErrorBoundary.jsx`) catches render-phase errors and shows a reload button.

**Patterns:**
- Async Firestore errors caught with try/catch in hooks and page `useEffect` blocks
- `useEmpresa` navigates to `/empresa-nao-encontrada` if slug resolves to nothing
- Cloud Function returns structured `{ error: string }` JSON; service worker surfaces message to popup UI

## Cross-Cutting Concerns

**Logging:** `console.error` only — no structured logging library
**Validation:** Client-side only via `REQUIRED_FIELDS` array checks in `FormPage`; Firestore rules provide server-side field constraints
**Authentication:** Firebase Auth email/password; session persists via Firebase SDK IndexedDB; extension uses JWT stored in `chrome.storage.local`

---

*Architecture analysis: 2026-05-03*
