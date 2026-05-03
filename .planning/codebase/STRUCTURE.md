<!-- refreshed: 2026-05-03 -->
# Codebase Structure

**Analysis Date:** 2026-05-03

## Directory Layout

```
mp-react-v3-completo/              # Monorepo root
├── mp-react/                      # Web SPA — React 19 + Vite (deployed to Vercel)
│   ├── src/
│   │   ├── main.jsx               # App entry point
│   │   ├── App.jsx                # Route definitions and route guards
│   │   ├── ErrorBoundary.jsx      # Top-level React error boundary
│   │   ├── firebase.js            # Firebase init + all Firestore helper functions
│   │   ├── index.css              # Global CSS (65 KB — all styles)
│   │   ├── pages/                 # Page-level components (one file per route)
│   │   │   ├── AdminPage.jsx      # Protected: company dashboard (~172 KB)
│   │   │   ├── FormPage.jsx       # Public: technician checklist form
│   │   │   ├── LoginPage.jsx      # Auth + Chrome extension token handoff
│   │   │   ├── CadastroPage.jsx   # New company registration
│   │   │   ├── SuperAdminPage.jsx # Protected: platform superadmin panel
│   │   │   ├── OrcamentoTecnicoPage.jsx  # Public: technician fills quote
│   │   │   ├── AprovarOrcamentoPage.jsx  # Public: client approves quote
│   │   │   ├── AvaliacaoPage.jsx  # Public: satisfaction survey
│   │   │   └── EmpresaNaoEncontrada.jsx  # 404-style company not found
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx    # React Context for Firebase Auth state
│   │   ├── hooks/
│   │   │   └── useEmpresa.js      # Resolves tenant from URL slug; plan limit checks
│   │   ├── utils/
│   │   │   ├── pdfGenerator.js    # Generates OS PDF report (jsPDF)
│   │   │   ├── orcamentoPdfGenerator.js  # Generates quote PDFs (client + insurer)
│   │   │   └── pngGenerator.js    # Generates OS PNG via html2canvas
│   │   └── components/            # Empty — no shared components extracted yet
│   ├── public/                    # Static assets (logo.png, etc.)
│   ├── dist/                      # Vite build output (gitignored)
│   ├── index.html                 # HTML shell
│   ├── vite_config.js             # Vite configuration
│   ├── package.json               # Dependencies: React 19, Firebase 12, recharts, jsPDF
│   ├── vercel.json                # Vercel SPA rewrite rule
│   └── .env                       # Firebase env vars (not committed — see .env.example)
│
├── functions/                     # Firebase Cloud Functions (Node.js 20, Gen 2)
│   ├── index.js                   # Single export: criarOSFromExtension (HTTP)
│   └── package.json               # firebase-admin + firebase-functions
│
├── assisthub-extension/           # Chrome Extension (Manifest V3, Vanilla JS)
│   ├── manifest.json              # Extension manifest, permissions, host_permissions
│   ├── background/
│   │   └── service-worker.js      # Token storage, proxies OS creation to Cloud Function
│   ├── content-scripts/
│   │   └── scraper.js             # DOM extraction from insurer portals
│   ├── popup/
│   │   ├── popup.html             # Extension popup UI shell
│   │   ├── popup.js               # Popup logic: auth check, extraction, OS creation
│   │   └── popup.css              # Popup styles
│   ├── utils/
│   │   └── selectors.js           # CSS selector maps per insurer portal (utility, not used at runtime by scraper — selectors are duplicated inline in scraper.js)
│   └── icons/                     # Extension icons (16px, 48px, 128px)
│
├── .planning/                     # GSD planning documents
│   └── codebase/                  # Codebase map documents
│
├── firebase.json                  # Firebase project config (Firestore rules, Functions, Storage)
├── firestore.rules                # Firestore security rules (multi-tenant RBAC)
├── storage.rules                  # Firebase Storage security rules
├── cors.json                      # CORS config for Firebase Storage
├── .firebaserc                    # Firebase project alias
└── package.json                   # Root package (minimal — only root-level tooling)
```

## Directory Purposes

**`mp-react/src/pages/`:**
- Purpose: One file per application route; each file is a self-contained page component
- Contains: All UI markup, local state, data fetching (`useEffect` + Firebase calls), event handlers
- Key files: `AdminPage.jsx` (largest, most complex), `FormPage.jsx` (primary public flow)

**`mp-react/src/contexts/`:**
- Purpose: React Context providers shared across the entire component tree
- Contains: `AuthContext.jsx` only — auth state, login/logout/cadastrar functions
- Key files: `AuthContext.jsx`

**`mp-react/src/hooks/`:**
- Purpose: Reusable stateful logic decoupled from UI
- Contains: `useEmpresa.js` — the tenant resolution hook used by all slug-based pages

**`mp-react/src/utils/`:**
- Purpose: Pure utility functions (no React, no Firebase)
- Contains: PDF and PNG document generators using `jsPDF` and `html2canvas`
- Note: Formatting helpers (`fmtDate`, `fmtBRL`) are NOT here — they are duplicated inline per page

**`mp-react/src/components/`:**
- Purpose: Intended for shared UI components
- Contains: Nothing — directory is empty

**`functions/`:**
- Purpose: Firebase Cloud Functions deployed under the project Firebase project (`checklist-53795`)
- Contains: Single `index.js` with the `criarOSFromExtension` Gen 2 HTTP function
- Generated/deployed: `node_modules/` present locally; deployed via Firebase CLI

**`assisthub-extension/`:**
- Purpose: Unpacked Chrome extension; loaded manually via chrome://extensions in developer mode
- Contains: Complete Manifest V3 extension — background service worker, content script, popup

## Key File Locations

**Entry Points:**
- `mp-react/src/main.jsx`: React app mount, provider tree
- `mp-react/index.html`: HTML shell with `<div id="root">`
- `assisthub-extension/manifest.json`: Extension entry point definition
- `functions/index.js`: Cloud Functions entry and only export

**Configuration:**
- `mp-react/.env`: Firebase project env vars (VITE_FIREBASE_*), VITE_SUPERADMIN_EMAIL
- `mp-react/.env.example`: Template showing required env var names
- `mp-react/vite_config.js`: Vite build config
- `mp-react/vercel.json`: SPA routing rewrite (`"source": "/(.*)", "destination": "/"`)
- `firebase.json`: Maps Firestore rules, Storage rules, Functions source
- `firestore.rules`: Security rules for all Firestore collections

**Core Logic:**
- `mp-react/src/firebase.js`: All Firebase initialization and multi-tenant Firestore helpers
- `mp-react/src/contexts/AuthContext.jsx`: Auth state machine
- `mp-react/src/hooks/useEmpresa.js`: Tenant resolution and plan gating

**Business Logic by Domain:**
- OS creation/updates: `mp-react/src/firebase.js` (functions `criarOS`, `atualizarOS`)
- OS listing and admin ops: `mp-react/src/pages/AdminPage.jsx`
- Company registration: `mp-react/src/pages/CadastroPage.jsx`
- Quote flow: `mp-react/src/pages/OrcamentoTecnicoPage.jsx` + `AprovarOrcamentoPage.jsx`
- Plan limits: `mp-react/src/hooks/useEmpresa.js` (`verificarLimite`)
- Extension OS creation: `functions/index.js`

**Testing:**
- Not applicable — no test files exist in the codebase

## Naming Conventions

**Files:**
- Pages: `PascalCasePage.jsx` (e.g., `FormPage.jsx`, `AdminPage.jsx`)
- Hooks: `useCamelCase.js` (e.g., `useEmpresa.js`)
- Contexts: `PascalCaseContext.jsx` (e.g., `AuthContext.jsx`)
- Utilities: `camelCaseGenerator.js` or `camelCaseTopic.js` (e.g., `pdfGenerator.js`, `orcamentoPdfGenerator.js`)
- Extension scripts: `kebab-case.js` (e.g., `service-worker.js`, `scraper.js`, `selectors.js`)

**Directories:**
- Lowercase plural nouns: `pages/`, `contexts/`, `hooks/`, `utils/`, `components/`
- Extension: feature-based lowercase: `background/`, `content-scripts/`, `popup/`, `utils/`, `icons/`

**Variables and functions (inside files):**
- React components: `PascalCase`
- Functions, hooks, variables: `camelCase`
- Constants / config objects: `UPPER_SNAKE_CASE` (e.g., `PLANOS`, `REQUIRED_FIELDS`, `INITIAL`, `SUPERADMIN_EMAIL`)

## Where to Add New Code

**New page/route:**
- Implementation: `mp-react/src/pages/NewFeaturePage.jsx`
- Register route: add `<Route>` in `mp-react/src/App.jsx`
- If protected: wrap with `<RotaAdmin>` or `<RotaSuperAdmin>`

**New shared UI component:**
- Implementation: `mp-react/src/components/ComponentName.jsx`
- (Directory exists but is empty — all components are currently page-local)

**New Firestore query or helper:**
- Add to `mp-react/src/firebase.js` following the existing pattern: export a named function that accepts `empresaId` as first parameter

**New custom hook:**
- Implementation: `mp-react/src/hooks/useFeatureName.js`

**New utility (pure function, no React):**
- Implementation: `mp-react/src/utils/featureName.js`

**New shared formatter helper:**
- Add to `mp-react/src/utils/format.js` (file does not exist yet — create it to consolidate duplicated `fmtDate`, `fmtBRL`, etc.)

**New Cloud Function:**
- Add export to `functions/index.js` or create a new file in `functions/` and re-export from `index.js`
- Deploy with `firebase deploy --only functions`

**New insurer portal support (extension):**
- CSS selector portals: add entry to `PORTAL_SELECTORS` in `assisthub-extension/content-scripts/scraper.js` AND `assisthub-extension/utils/selectors.js`
- Label-based portals: add entry to `PORTAL_LABEL_MAP` in `scraper.js`
- Update `host_permissions` in `assisthub-extension/manifest.json`
- Update the `portais` display name map in `assisthub-extension/popup/popup.js`

## Special Directories

**`mp-react/dist/`:**
- Purpose: Vite production build output
- Generated: Yes (via `npm run build`)
- Committed: No (in `.gitignore`)

**`mp-react/node_modules/` and `functions/node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes
- Committed: No

**`mp-react/public/`:**
- Purpose: Static files served at root URL (e.g., `logo.png` referenced in `index.html`)
- Generated: No
- Committed: Yes

**`.planning/codebase/`:**
- Purpose: GSD codebase map documents consumed by planning and execution agents
- Generated: By GSD mapper agent
- Committed: Yes (planning artifacts)

---

*Structure analysis: 2026-05-03*
