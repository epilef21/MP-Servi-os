# Coding Conventions

**Analysis Date:** 2026-05-03

## Code Style

**Formatting:**
- No Prettier config detected — formatting is manual/editor-driven.
- No `.editorconfig` file present.
- Indentation: 2 spaces (consistent across all source files).
- Semicolons: omitted (no trailing semicolons in JSX/JS files).
- Quotes: single quotes for JS strings (`'react'`, `'../firebase'`); double quotes used inside JSX attribute strings (`className="btn btn-primary"`).
- Max line length: not enforced; lines in `AdminPage.jsx` often exceed 120 characters.
- Trailing commas: used in multi-line arrays and object literals.

**Linting:**
- ESLint v9 (`eslint ^9.39.4`) with flat config format.
- Plugins: `eslint-plugin-react-hooks ^7.0.1`, `eslint-plugin-react-refresh ^0.5.2`.
- No config file found at the repo root — ESLint config is likely missing or embedded in `vite_config.js`. Running `npm run lint` invokes `eslint .`.
- No `@typescript-eslint` plugin — the project is plain JavaScript (`.js`/`.jsx`), not TypeScript.

## Naming Patterns

**Files:**
- Pages: PascalCase with `Page` suffix — `AdminPage.jsx`, `LoginPage.jsx`, `CadastroPage.jsx`, `FormPage.jsx`.
- Context files: PascalCase with `Context` suffix — `AuthContext.jsx`.
- Custom hooks: camelCase with `use` prefix, `.js` extension — `useEmpresa.js`.
- Utilities: camelCase describing output — `pdfGenerator.js`, `pngGenerator.js`, `orcamentoPdfGenerator.js`.
- Entry points: lowercase — `main.jsx`, `firebase.js`, `index.css`.
- All source files under `mp-react/src/`.

**Components (functions):**
- Exported default page components: PascalCase matching filename — `export default function AdminPage()`, `export default function LoginPage()`.
- Internal sub-components in the same file: PascalCase — `function Toast({ toast })`, `function CustomBarTooltip(...)`, `function RotaAdmin(...)`.
- Helper/utility functions: camelCase — `fmtDate()`, `fmtBRL()`, `maskPhone()`, `maskCNPJ()`, `sanitizePayload()`, `gerarSlug()`.

**Variables and State:**
- State variables use camelCase, often in Portuguese — `empresa`, `loading`, `setLoading`, `abaAtiva`, `setSidebarOpen`, `orcamentos`, `savingOrc`.
- Boolean state follows `is`/`esta`/`show`/`loading`/`saving` prefixes — `estaLogado`, `isSuperAdmin`, `showSenha`, `loadingAuth`, `savingOs`.
- Constants (module-level): SCREAMING_SNAKE_CASE — `PLANOS`, `REQUIRED_FIELDS`, `INITIAL`, `OS_INITIAL`, `MESES_ABREV`, `SUPERADMIN_EMAIL`, `CHECKUP_ITEMS`.
- Object maps/lookups: PascalCase or SCREAMING_SNAKE_CASE — `STATUS_META`, `PIE_COLORS`, `STATUS_ORC_META`.

**CSS Classes:**
- Utility-style BEM-lite naming in `index.css` — `.btn`, `.btn-primary`, `.form-group`, `.form-input`, `.form-label`, `.field`, `.card`, `.alert`.
- Component-specific: hyphen-separated descriptive names — `.login-container`, `.login-card`, `.admin-main`, `.page-wrapper`, `.toast-container`.
- State modifiers: short suffixes — `.on` (active), `.rs` (radio selected), `.rn` (radio no), `.error`, `.locked`, `.show`.
- Avatar and status badge classes use suffix codes — `.av0`–`.av3`, `.aguardando-t`, `.pendente-y`, `.processado-g`, `.enviado-b`.
- CSS variables in `:root` use `--kebab-case` — `--primary`, `--accent`, `--success`, `--danger`, `--r-sm`, `--sh-lg`.

## Component and Module Patterns

**Component Style:**
- All page components are functional components with hooks (except `ErrorBoundary.jsx`, which is a class component — the only one in the project, required because React error boundaries cannot be functional).
- No React.memo, useMemo (AdminPage imports `useMemo` but pattern is present), or useCallback used for performance optimization.
- Sub-components are defined in the same file as the page that uses them (e.g., `Toast`, `CustomBarTooltip`, `RotaAdmin`, `RotaSuperAdmin` all live in their respective page files).
- No separate `components/` directory — all UI logic lives in `pages/` or inline.

**Hooks Usage:**
- `useState` — primary state mechanism, heavily used.
- `useEffect` — data fetching, Firebase listeners, draft restoration from localStorage.
- `useRef` — DOM references for scroll (`osEnderecoRef`), file inputs (`logoInputRef`), signature canvas.
- `useMemo` — used in `AdminPage.jsx` for derived/filtered data.
- `useContext` — accessed via custom `useAuth()` hook, never called directly.
- Custom hooks: `useAuth()` (`contexts/AuthContext.jsx`) and `useEmpresa()` (`hooks/useEmpresa.js`).

**File Header Pattern:**
Every source file opens with a banner comment block:
```js
// ============================================================
// FILE DESCRIPTION — purpose and route
// ============================================================
```

**Section Separator Comments:**
Logical sections within a file are separated with `// ── Section name ──────────` dividers, providing visual scanning without JSDoc overhead.

## State Management Patterns

**Global State:**
- Authentication state (current user, empresaId, isSuperAdmin) is held in `AuthContext` (`src/contexts/AuthContext.jsx`) and accessed via `useAuth()`.
- No Redux, Zustand, or other state library — React Context is the only global store.

**Server-Derived State:**
- Component-local `useState` arrays hold Firestore data fetched on mount via `useEffect`.
- `useEmpresa()` hook provides tenant-scoped company data with an in-memory module-level cache (`const cache = {}` in `hooks/useEmpresa.js`) to avoid redundant Firestore reads per session.
- No SWR, React Query, or suspense-based data fetching.

**Form State:**
- Each form uses a flat state object initialised from a `*_INITIAL` constant — e.g., `OS_INITIAL`, `ORC_INITIAL`, `TECNICO_FORM_INITIAL`.
- Updates use the spread pattern: `setForm(prev => ({ ...prev, [name]: value }))`.
- Field-level validation errors stored in a parallel `*Errors` state object — e.g., `osErrors`, `orcErrors`, `tecnicoFormErrors`.

**Draft Persistence:**
- `FormPage.jsx` persists form state to `localStorage` under a slug-scoped key (`mp_form_draft_${slug}`) to survive accidental refreshes.

## Error Handling Patterns

**Async Operations:**
- All async operations are wrapped in `try/catch/finally`.
- `finally` block always resets loading state (`setLoading(false)`, `setSaving(false)`).
- `catch` blocks call `console.error('[ComponentName] Message:', err)` with a bracketed component prefix for traceability, then set a user-visible error state string.

**User-Facing Errors:**
- Firebase Auth errors are mapped to Portuguese messages via a lookup object in `LoginPage.jsx`:
  ```js
  const mensagens = {
    'auth/user-not-found': 'E-mail não encontrado.',
    'auth/wrong-password': 'Senha incorreta.',
    ...
  }
  setErro(mensagens[err.code] || 'Erro ao entrar. Tente novamente.')
  ```
- Generic fallback: `'Erro ao salvar. Tente novamente.'`

**Structural Error Handling:**
- `ErrorBoundary.jsx` wraps the entire app in `main.jsx` to catch unexpected render crashes and display a recovery screen.
- Route guards (`RotaAdmin`, `RotaSuperAdmin`) redirect unauthenticated users rather than throwing.

**Empty/Silent Catches:**
- Some `catch` blocks in `LoginPage.jsx` are intentionally empty (`catch { }`) when failure is non-critical (e.g., silent extension token send failure).

## Import Organization

**Order (observed pattern, not enforced by a tool):**
1. React core imports (`import { useState, useEffect } from 'react'`)
2. Router imports (`import { useNavigate, Link } from 'react-router-dom'`)
3. Firebase module import (`import { db, ... } from '../firebase.js'`)
4. Context/hook imports (`import { useAuth } from '../contexts/AuthContext'`, `import { useEmpresa } from '../hooks/useEmpresa.js'`)
5. Utility imports (`import { generatePDF } from '../utils/pdfGenerator.js'`)
6. Third-party UI library imports (`import { BarChart, ... } from 'recharts'`)

**Path Style:**
- Relative paths used throughout (`'../firebase'`, `'./contexts/AuthContext'`).
- No path aliases (`@/`) configured in `vite_config.js`.
- `.jsx` extension is explicit in most imports; `.js` used for non-JSX files.

## Comment Style and Documentation

**Inline Comments:**
- Section dividers (`// ── Name ──────────────────────`) are used consistently to break up long files.
- Inline rationale comments explain non-obvious logic:
  ```js
  // Tentativa primária: empresas/{uid} (por convenção empresaId === uid)
  // Fallback: usuarios/{uid} → empresaId (compatibilidade com cadastros antigos)
  ```
- `// -1 significa ilimitado (plano pro ou enterprise)`

**No JSDoc/TSDoc:**
- Function parameters and return types are not documented with JSDoc. The codebase is plain JS with no TypeScript.

**Return values documented via comments:**
- The `useEmpresa()` hook documents each returned key inline at the `return` statement:
  ```js
  return {
    empresa,   // dados principais: id, nome, slug, plano, ativo
    config,    // personalização: nome, telefone, seguradoras, logoUrl, corPrimaria
    ...
  }
  ```

## Function Design

**Size:**
- Utility/helper functions are small (5–15 lines): `fmtDate`, `fmtBRL`, `maskPhone`, `gerarSlug`, `sanitize`.
- Page component functions are very large. `AdminPage.jsx` is 3,264 lines and contains all tab rendering, modal rendering, and business logic in a single component body.
- No extraction into separate sub-components with their own files.

**Parameters:**
- Functions receive plain primitives or objects. No TypeScript interfaces.
- Event handlers follow `handle*` naming for user interactions: `handleSubmit`, `handleChange`.

**Exports:**
- Each file exports one default (the page/context/hook).
- Utilities export named functions: `export function generatePDF(r)`, `export function generatePNG(r)`.
- `firebase.js` re-exports Firebase SDK primitives alongside app-specific helpers, acting as a single Firebase facade module.

---

*Convention analysis: 2026-05-03*
