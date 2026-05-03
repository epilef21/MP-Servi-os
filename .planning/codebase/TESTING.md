# Testing Patterns

**Analysis Date:** 2026-05-03

## Test Framework

**Runner:**
- None installed. No Jest, Vitest, Cypress, Playwright, or any other test runner is present in `mp-react/package.json` (neither in `dependencies` nor `devDependencies`).

**Assertion Library:**
- None.

**Run Commands:**
```bash
# No test script defined in mp-react/package.json
# Defined scripts: dev, build, lint, preview
npm run lint   # ESLint static analysis — the only automated code quality check
```

## Test File Organization

**Location:**
- No test files exist anywhere under `mp-react/src/`.

**Naming:**
- No `*.test.js`, `*.test.jsx`, `*.spec.js`, or `*.spec.jsx` files found in the project source tree.

**Structure:**
- No `__tests__/` directories exist in the project.

## Test Structure

**Suite Organization:**
- Not applicable — no tests exist.

**Patterns:**
- Not applicable.

## Mocking

**Framework:**
- None.

**What to Mock (if tests were added):**
- Firebase SDK (`firebase/firestore`, `firebase/auth`, `firebase/storage`) — all data access goes through `mp-react/src/firebase.js`, which serves as the integration boundary.
- `react-router-dom` hooks (`useParams`, `useNavigate`, `useSearchParams`) — used directly in page components and `useEmpresa`.
- `window.chrome.runtime.sendMessage` — used in `LoginPage.jsx` for Chrome extension messaging.
- `localStorage` — used in `FormPage.jsx` for draft persistence under key `mp_form_draft_${slug}`.
- `navigator.onLine` — used in `OrcamentoTecnicoPage.jsx` for offline detection.

## Fixtures and Factories

**Test Data:**
- No fixtures or factory helpers exist.

**Location:**
- No `fixtures/`, `factories/`, or `__mocks__/` directories found.

## Coverage

**Requirements:**
- None enforced. No coverage thresholds configured anywhere.

**Estimated Coverage:**
- **0%** — there are zero test files covering application source code.

**View Coverage:**
```bash
# Not available — no test runner configured
```

## Test Types

**Unit Tests:**
- None present.

**Integration Tests:**
- None present.

**E2E Tests:**
- Not used. No Cypress, Playwright, or Puppeteer dependency detected.

## Common Patterns

**Async Testing:**
- Not applicable.

**Error Testing:**
- Not applicable.

## Missing / Weak Coverage Areas

Since there are no tests at all, the following areas carry the highest risk and should be prioritised when adding tests:

**Critical Business Logic (High Priority):**
- `mp-react/src/hooks/useEmpresa.js` — tenant resolution, Firestore slug lookup, in-memory cache, plan limit calculation (`verificarLimite`). Any bug here affects every page load.
- `mp-react/src/contexts/AuthContext.jsx` — login, logout, superadmin detection, empresaId resolution with two-path fallback. Auth regressions affect the whole app.
- `mp-react/src/pages/AdminPage.jsx` — 3,264-line monolith containing OS creation/editing, budget (orçamento) workflows, technician management, financial data, and chart logic. Highest complexity, highest risk.

**Data Transformation Utilities (Medium Priority):**
- `mp-react/src/utils/pdfGenerator.js` — PDF layout logic for `generatePDF`. Breakage silently produces corrupt documents.
- `mp-react/src/utils/orcamentoPdfGenerator.js` — two exported functions (`generatePDFCliente`, `generatePDFSeguradora`). Input edge cases (null values, missing fields) are handled by local `sanitize()` but untested.
- `mp-react/src/utils/pngGenerator.js` — canvas-based PNG export.
- Formatter helpers in `AdminPage.jsx` (`fmtDate`, `fmtBRL`, `maskPhone`, `maskCNPJ`, `getLucro`) — all pure functions, easy to unit test, handle many edge cases (Firestore Timestamps, null, empty strings).

**Form Validation (Medium Priority):**
- `mp-react/src/pages/FormPage.jsx` — `REQUIRED_FIELDS` validation, `sanitizePayload`, draft persistence/restore from localStorage, photo upload failure path.
- `mp-react/src/pages/CadastroPage.jsx` — `gerarSlug()` (pure, trivial to test), password confirmation matching, duplicate slug handling.

**Public Pages with External Data (Medium Priority):**
- `mp-react/src/pages/AvaliacaoPage.jsx` — satisfaction survey submission.
- `mp-react/src/pages/AprovarOrcamentoPage.jsx` — customer budget approval flow.
- `mp-react/src/pages/OrcamentoTecnicoPage.jsx` — technician budget fill-out with offline detection.

**Route Guards (Lower Priority but Foundational):**
- `RotaAdmin` and `RotaSuperAdmin` in `mp-react/src/App.jsx` — two inline components that gate protected routes. Regression risk if `useAuth` shape changes.

## Recommended Setup (if adding tests)

Given the Vite + React setup already in place, the lowest-friction path is:

```bash
npm install --save-dev vitest @vitest/ui jsdom @testing-library/react @testing-library/user-event
```

Add to `vite_config.js`:
```js
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: './src/test/setup.js',
}
```

Start with pure utility functions (`fmtDate`, `fmtBRL`, `maskPhone`, `maskCNPJ`, `gerarSlug`, `getLucro`, `parseBRL`) — they have no dependencies and are the easiest wins. Then move to hook-level tests for `useEmpresa` with mocked Firebase calls.

---

*Testing analysis: 2026-05-03*
