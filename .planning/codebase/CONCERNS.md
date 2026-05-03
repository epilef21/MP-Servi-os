# Codebase Concerns

**Analysis Date:** 2026-05-03

---

## Security Concerns

### Superadmin email hardcoded as fallback in source code
- **File:** `mp-react/src/firebase.js` line 85
- **Detail:** `export const SUPERADMIN_EMAIL = import.meta.env.VITE_SUPERADMIN_EMAIL || 'tvf23407@gmail.com'` — the real email is in the source as a fallback, which means it is committed to the repository and visible to anyone with repo access.
- **Why it matters:** The fallback is used by `AuthContext.jsx` to grant superadmin privileges. Anyone who reads the repo knows the superadmin account identity and can target it.
- **Severity:** HIGH

### Superadmin email hardcoded in storage.rules
- **File:** `storage.rules` lines 21 and 33
- **Detail:** `request.auth.token.email == 'tvf23407@gmail.com'` appears twice. If the superadmin email changes, `storage.rules` must be updated manually and redeployed; otherwise the old account loses access silently.
- **Why it matters:** Hardcoding PII in rules creates a maintenance landmine and leaks the admin email in the committed file.
- **Severity:** MEDIUM

### Orcamentos allow unrestricted public update
- **File:** `firestore.rules` lines 161–163
- **Detail:** `allow update: if true;` on `/empresas/{empresaId}/orcamentos/{orcamentoId}` — any unauthenticated user who knows (or guesses) `empresaId` + `orcamentoId` can overwrite any field in any budget document.
- **Why it matters:** An attacker can manipulate financial data (item values, approval status, client signature) without authentication. There is no field-level restriction on what can be changed.
- **Severity:** HIGH

### Storage photos allow unrestricted public upload
- **File:** `storage.rules` lines 14–16
- **Detail:** `allow create: if true;` under `/empresas/{empresaId}/fotos/{allPaths=**}` — anyone can upload arbitrary files to any company's photo storage without authentication.
- **Why it matters:** Storage can be abused for free file hosting, malware distribution, or storage cost attacks against the Firebase account.
- **Severity:** HIGH

### Chrome extension stores raw Firebase JWT in `chrome.storage.local`
- **File:** `assisthub-extension/background/service-worker.js` lines 34–38
- **Detail:** The full Firebase ID token (a long-lived JWT) is stored as-is in `chrome.storage.local` under the key `authToken`. Chrome storage is not encrypted.
- **Why it matters:** Any extension with `storage` permission on the same browser can read this token. If the extension is compromised, the token grants full Firebase Auth access until it expires (~1 hour).
- **Severity:** MEDIUM

### `.env.example` contains a real default password
- **File:** `mp-react/.env.example` line 16
- **Detail:** `VITE_ADMIN_PASSWORD=mp@admin2024` — a specific credential is committed as the example default.
- **Why it matters:** Developers who copy `.env.example` to `.env` without reading it will deploy with this known password. The value is also in git history permanently.
- **Severity:** MEDIUM

### Slug collision not prevented at registration
- **File:** `mp-react/src/pages/CadastroPage.jsx` lines 74–93
- **Detail:** `gerarSlug()` derives a slug from the company name, but there is no uniqueness check against Firestore before calling `cadastrarEmpresa()`. Two companies with similar names will collide on the slug — the second registration will overwrite the first company's Firestore document because `empresaId = user.uid` but `slug` is shared.
- **Why it matters:** A new registration can silently overwrite the `/empresas/{empresaId}` document reference, breaking an existing tenant's access.
- **Severity:** HIGH

---

## Technical Debt

### AdminPage.jsx is a 3,264-line monolithic component
- **File:** `mp-react/src/pages/AdminPage.jsx`
- **Detail:** One component manages OS CRUD, budgets (orçamentos), technicians, company settings, user profile, charts, modals, file uploads, and WhatsApp links. It has ~50 `useState` calls and ~30 async handler functions.
- **Why it matters:** The file is at the boundary of readability. Adding any feature requires navigating thousands of lines. React DevTools profiling, code splitting, and unit testing are all blocked by the coupling.
- **Severity:** HIGH

### Utility functions duplicated across 6+ files
- **Files:** `AdminPage.jsx`, `AprovarOrcamentoPage.jsx`, `OrcamentoTecnicoPage.jsx`, `FormPage.jsx`, `AvaliacaoPage.jsx`, `pdfGenerator.js`, `orcamentoPdfGenerator.js`, `pngGenerator.js`
- **Detail:** `fmtDate`, `fmtBRL`, and `fmtSN` are copy-pasted with minor variations in every page and utility file. The `sanitize` function for PDF output is similarly duplicated.
- **Why it matters:** Bug fixes and locale changes must be applied in every copy. At least one inconsistency already exists: `AprovarOrcamentoPage.jsx` uses `parseFloat(v) || 0` while `pdfGenerator.js` uses `parseFloat(v)` without fallback.
- **Severity:** MEDIUM

### `novoItemOrc` / `novoItem` duplicated between AdminPage and OrcamentoTecnicoPage
- **Files:** `mp-react/src/pages/AdminPage.jsx` line 159, `mp-react/src/pages/OrcamentoTecnicoPage.jsx` line 21
- **Detail:** Both files define a `novoItem()`/`novoItemOrc()` factory producing identical shapes. Any schema change must be done twice.
- **Severity:** LOW

### `gerarNumeroOrcamento` uses fragile sequential logic
- **File:** `mp-react/src/pages/AdminPage.jsx` lines 898–914
- **Detail:** The function queries the last budget by `criado_em`, parses the sequence number from the string format `ORC-AAAA-NNNN`, and increments it. Two concurrent saves will produce duplicate numbers. The fallback on error uses `Date.now().slice(-4)` which is not sequential.
- **Why it matters:** Budget numbers are shown to clients and used as reference. Duplicates or gaps cause customer support issues and potentially legal confusion.
- **Severity:** MEDIUM

### In-memory cache in `useEmpresa.js` is a module-level mutable object
- **File:** `mp-react/src/hooks/useEmpresa.js` lines 11–12
- **Detail:** `const cache = {}` at module scope persists for the entire browser session. Config changes made in the admin panel are not reflected until the user refreshes, because the hook re-uses the stale cached data.
- **Why it matters:** An admin who updates company name or colour will not see the change in public-facing pages until a full reload.
- **Severity:** MEDIUM

### `document.execCommand('copy')` deprecated fallback
- **Files:** `mp-react/src/pages/AdminPage.jsx` lines 640–643, 927–930
- **Detail:** Both copy-to-clipboard handlers use `document.execCommand('copy')` as a fallback. This API is deprecated and removed in some browser contexts (e.g., cross-origin iframes).
- **Severity:** LOW

---

## Performance Risks

### Main JS bundle is 1.8 MB (uncompressed)
- **File:** `mp-react/dist/assets/index-V2kUSp9C.js` (1,810,802 bytes)
- **Detail:** No route-based code splitting is configured. All pages — including the superadmin panel, all form pages, PDF generators, and Recharts — are loaded on every visit, including the public technician form page which only needs a fraction of this code.
- **Why it matters:** The public form at `/:slug` and the approval page `/aprovar/:slug/:id` are used by end customers on mobile. A 1.8 MB bundle significantly increases Time to Interactive on slow connections.
- **Severity:** HIGH

### All company OS loaded into memory at once — no pagination
- **File:** `mp-react/src/firebase.js` lines 129–133, `mp-react/src/pages/AdminPage.jsx` `loadReports()` function
- **Detail:** `getOSdaEmpresa()` calls `getDocs()` on the full `checklist` subcollection ordered by date, with no `limit`. All records are fetched into a React state array and filtered client-side.
- **Why it matters:** Companies with hundreds or thousands of OS will experience slow initial load, high Firestore read costs, and large memory usage. Filtering is already done in `useMemo` on the full client-side array.
- **Severity:** HIGH

### `SuperAdminPage` queries OS count for every company in parallel
- **File:** `mp-react/src/pages/SuperAdminPage.jsx` lines 69–73
- **Detail:** `Promise.all(lista.map(...))` fires one Firestore query per company simultaneously. With 20 companies this is 20 parallel reads; with 100 companies it could hit Firestore rate limits and produce noticeable latency.
- **Severity:** MEDIUM

### `listarTodasEmpresas()` reads all company documents without limit
- **File:** `mp-react/src/firebase.js` lines 182–185
- **Detail:** `getDocs(collection(db, 'empresas'))` fetches all tenant documents. There is no `limit()` or cursor pagination.
- **Severity:** MEDIUM

### `html2canvas` + `jsPDF` always bundled, never lazy-loaded
- **Files:** `mp-react/src/utils/pngGenerator.js`, `mp-react/src/utils/pdfGenerator.js`, `mp-react/src/utils/orcamentoPdfGenerator.js`
- **Detail:** These heavy libraries are statically imported at the top of the bundle. They are only used when an admin explicitly downloads a PDF or PNG.
- **Severity:** MEDIUM

---

## Architecture Gaps

### No shared utility module — helpers are copy-pasted per file
- **Detail:** There is no `src/utils/formatters.js` or similar shared module. Formatting, date parsing, and phone masking logic are duplicated inline across every page component.
- **Why it matters:** Future Claude instances adding a new page will either copy-paste again or have to discover the pattern and refactor first.
- **Severity:** MEDIUM

### No data access layer — Firestore calls scattered across components
- **Detail:** Components like `AdminPage.jsx` call `getDocs`, `updateDoc`, `deleteDoc`, `addDoc` directly inline (not via the helper functions in `firebase.js`). `firebase.js` exports both the Firestore SDK functions and query helpers, blurring the abstraction boundary.
- **Why it matters:** There is no single place to add global error handling, retries, or offline support. Any change to data schema requires searching across all components.
- **Severity:** MEDIUM

### Budget (orçamento) schema has no Zod/Yup validation
- **Detail:** Budget creation in `saveNovoOrcamento()` (`AdminPage.jsx` lines 934–968) validates a subset of fields inline with `if (!field)` guards. The Firestore document written has no enforced shape — the Cloud Function (`functions/index.js`) and three separate pages all assume different field names (e.g., `maoDeObraSeguradora` in the Cloud Function vs `mo_seguradora` in the web app).
- **Why it matters:** Field name inconsistency (`maoDeObraSeguradora` vs `mo_seguradora`) between the Cloud Function and the React app means OS created by the Chrome extension will display incorrectly in the financial section of `AdminPage`.
- **Severity:** HIGH

### `RotaAdmin` guard does not verify company ownership — only authentication
- **File:** `mp-react/src/App.jsx` lines 22–26
- **Detail:** `RotaAdmin` only checks `estaLogado`. The company ownership check (`empresaId !== empresaIdAuth`) is done inside `AdminPage` itself via `useEffect` with a `navigate('/login')` redirect. There is a brief render window where `AdminPage` loads with the wrong `empresaId`.
- **Why it matters:** A logged-in user who manually navigates to another company's `/:slug/admin` URL will momentarily load that page before being redirected.
- **Severity:** LOW

---

## Operational Gaps

### No error tracking service (Sentry, Datadog, etc.)
- **Detail:** `ErrorBoundary.jsx` only calls `console.error()`. Errors in production are invisible to the team unless a user reports them.
- **Severity:** HIGH

### No CI/CD configuration
- **Detail:** There is no `.github/workflows/`, `vercel.json` pipeline config, or equivalent. Deployments are presumably done manually via `vercel deploy` or Vercel's Git integration without automated checks.
- **Severity:** MEDIUM

### No automated tests anywhere in the project
- **Detail:** There are no test files in `mp-react/src/`, no test runner config (`jest.config.*`, `vitest.config.*`), and no test scripts in `package.json`. Zero test coverage.
- **Why it matters:** Every change to the 3,264-line `AdminPage.jsx` or the Firestore security rules is a manual verification step. Regressions in the public form or budget approval flow will reach production users.
- **Severity:** HIGH

### Error handling is inconsistent — mix of `alert()`, `showToast()`, and silent swallows
- **Files:** `mp-react/src/pages/AdminPage.jsx` (multiple locations)
- **Detail:** Some errors call `alert('Erro: ' + e.message)` (lines 526, 633, 718), others call `showToast()`, and some network failures are silently swallowed (CEP lookup at line 553, chart try-catch at line 459). There is no unified error handling strategy.
- **Why it matters:** `alert()` is blocking and creates a poor UX. Silent swallows hide real failures from users and developers.
- **Severity:** MEDIUM

### Cloud Function URL is hardcoded in the Chrome extension
- **File:** `assisthub-extension/background/service-worker.js` line 1
- **Detail:** `const API_BASE = 'https://us-central1-checklist-53795.cloudfunctions.net'` — the project ID (`checklist-53795`) and region (`us-central1`) are hardcoded. Changing the Firebase project or deploying to another region requires a new extension release.
- **Severity:** LOW

### No environment separation (dev / staging / prod)
- **Detail:** There is only one `.env` file setup. The Cloud Function uses `process.env.APP_URL || 'https://mp-servi-os.vercel.app'` as a fallback, meaning local Cloud Function testing will call production URLs if `APP_URL` is not set.
- **Severity:** MEDIUM

### `mp-react/.gitignore` only ignores `.vercel` — not `.env`
- **File:** `mp-react/.gitignore`
- **Detail:** The `mp-react/.gitignore` contains only `.vercel`. `.env` protection comes from the root `.gitignore`, which works now, but if the `mp-react/` subtree is ever moved or the root ignore is regenerated, the `.env` file could be committed accidentally.
- **Severity:** LOW

---

## Dependency Risks

### `react-signature-canvas@1.1.0-alpha.2` is an alpha pre-release
- **File:** `mp-react/package.json` line 19
- **Detail:** The alpha version is used in production for the client signature flow in `AprovarOrcamentoPage.jsx`. Alpha versions may have breaking API changes or unresolved bugs.
- **Severity:** MEDIUM

### No `package-lock.json` integrity enforced for functions
- **File:** `functions/package-lock.json` exists but `functions/package.json` specifies ranges (`^13.0.0`, `^7.2.5`). Without lockfile pinning in CI, `npm install` on a fresh deploy could pull a newer breaking version.
- **Severity:** LOW

---

## Missing Essentials

### No slug uniqueness enforcement in Firestore rules or application code
- **Files:** `mp-react/src/pages/CadastroPage.jsx`, `firestore.rules`
- **Detail:** Slug uniqueness relies entirely on `getEmpresaBySlug()` returning `null` — but there is no transaction or rule preventing two concurrent registrations from writing the same slug. The Firestore rules allow `create` on `/empresas/{empresaId}` for any authenticated user with `uid == empresaId`, regardless of slug collision.
- **Why it matters:** A slug collision routes two companies to the same public form URL.
- **Severity:** HIGH

### No rate limiting on the public OS creation form
- **Files:** `firestore.rules` lines 107–114, `mp-react/src/pages/FormPage.jsx`
- **Detail:** The Firestore rule allows any unauthenticated user to create OS documents as long as financial fields are absent and status is `pendente`/`aguardando_tecnico`. There is no captcha, IP throttle, or request count guard.
- **Why it matters:** A malicious actor can flood a company's OS list with fake entries, exhausting their plan's monthly OS limit and disrupting operations.
- **Severity:** MEDIUM

### No CNPJ validation
- **File:** `mp-react/src/pages/AdminPage.jsx` `saveConfig()` function
- **Detail:** The CNPJ field is masked (`maskCNPJ`) but never validated for correctness. Invalid CNPJs are stored and printed on PDF documents sent to insurers.
- **Severity:** LOW

---

*Concerns audit: 2026-05-03*
