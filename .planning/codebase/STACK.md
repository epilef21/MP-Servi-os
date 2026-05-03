# Technology Stack

**Analysis Date:** 2026-05-03

## Languages

**Primary:**
- JavaScript (ESM) — All frontend source (`mp-react/src/`) and extension (`assisthub-extension/`)
- JavaScript (CommonJS) — Cloud Functions backend (`functions/index.js`)

**Secondary:**
- JSX — React component files throughout `mp-react/src/pages/` and `mp-react/src/contexts/`

## Runtime

**Environment:**
- Node.js 22 — declared in `functions/package.json` (`"engines": { "node": "22" }`)
- Firebase Functions runtime: `nodejs20` — declared in `firebase.json`
- Browser (Chromium/Chrome) — extension runtime (`assisthub-extension/`)

**Package Manager:**
- npm
- Lockfiles: `mp-react/package-lock.json`, `functions/package-lock.json`, `package-lock.json` (root) — all present

## Frameworks

**Core:**
- React `^19.2.4` — UI framework (`mp-react/`)
- React DOM `^19.2.4` — DOM rendering
- React Router DOM `^7.14.0` — client-side routing; SPA with slug-based multi-tenant routes (`mp-react/src/App.jsx`)

**Build/Dev:**
- Vite `^8.0.4` — dev server and bundler (`mp-react/`)
- `@vitejs/plugin-react` `^6.0.1` — Vite React plugin (JSX transform)

**Cloud Functions:**
- firebase-functions `^7.2.5` — Cloud Functions framework (`functions/`)
- firebase-admin `^13.0.0` — Admin SDK for server-side Firestore + Auth token verification (`functions/index.js`)

## Key Dependencies

**Critical:**
- `firebase` `^12.12.0` — Firebase JS SDK v12; used for Firestore, Storage, and Auth in the web app (`mp-react/src/firebase.js`)
- `react-router-dom` `^7.14.0` — All routing; slug-based multi-tenant URL structure relies on it
- `recharts` `^3.8.1` — Charts in AdminPage (`mp-react/src/pages/AdminPage.jsx`); also declared in root `package.json`

**Document Generation:**
- `jspdf` `^4.2.1` — PDF generation for OS reports and quotes (`mp-react/src/utils/pdfGenerator.js`, `mp-react/src/utils/orcamentoPdfGenerator.js`)
- `html2canvas` `^1.4.1` — PNG snapshot of OS reports (`mp-react/src/utils/pngGenerator.js`)

**Signature Capture:**
- `react-signature-canvas` `^1.1.0-alpha.2` — Signature pad for technician and customer signatures in forms

## Configuration

**Environment (frontend):**
- Managed via `.env` file at `mp-react/.env` (not committed)
- Template at `mp-react/.env.example`
- All variables prefixed `VITE_` for Vite exposure:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
  - `VITE_SUPERADMIN_EMAIL` (optional; falls back to hardcoded value in `mp-react/src/firebase.js`)
  - `VITE_ADMIN_PASSWORD` (legacy, appears in `.env.example` — may be unused in v3)

**Environment (Cloud Functions):**
- `APP_URL` — production app URL, defaults to `https://mp-servi-os.vercel.app` (`functions/index.js` line 8)
- No `.env` file detected under `functions/`; runtime env var set in Firebase console or via Firebase CLI

**Build:**
- Vite config: `mp-react/vite_config.js` (note: non-standard filename — not `vite.config.js`; must be referenced explicitly)
- Vite output: `mp-react/dist/`

## Dev Tooling

**Linting:**
- ESLint `^9.39.4` (flat config) — `mp-react/`
- `@eslint/js` `^9.39.4`
- `eslint-plugin-react-hooks` `^7.0.1`
- `eslint-plugin-react-refresh` `^0.5.2`
- `globals` `^17.4.0`
- No ESLint config file found in `mp-react/` root (likely inlined or auto-discovered)

**Formatting:**
- No Prettier config detected. No `.prettierrc` or `biome.json` found.

**Testing:**
- No testing framework detected. No `jest.config.*`, `vitest.config.*`, or `*.test.*` / `*.spec.*` files found.

## Platform Requirements

**Development:**
- Node.js 22+
- npm
- Firebase CLI (for deploying Firestore rules, Storage rules, Cloud Functions)
- Vite dev server via `npm run dev` in `mp-react/`

**Production:**
- Frontend: Vercel (see `mp-react/vercel.json`)
- Backend: Firebase (Firestore, Storage, Auth, Cloud Functions on `us-central1`)
- Extension: Chrome Web Store or manual unpacked install (Manifest V3)

---

*Stack analysis: 2026-05-03*
