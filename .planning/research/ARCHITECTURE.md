# Research: Test Architecture

**Project:** AssistHub (mp-react)
**Researched:** 2026-05-03
**Overall confidence:** HIGH

---

## File Placement Strategy

**Recommendation: co-located test files next to the source file they test.**

Pattern: `src/pages/AdminPage.test.jsx`, `src/hooks/useEmpresa.test.js`, `src/firebase.test.js`.

Rationale for this codebase:

1. There are no shared components (the `components/` directory is empty). Every test
   file has a 1-to-1 relationship with a source file — co-location makes that obvious.
2. AdminPage.jsx is ~172 KB. A dedicated `__tests__/` folder would hide the test file
   far from the implementation. Co-location keeps refactoring cost visible.
3. Vite's default module resolution makes relative imports simpler when tests sit beside
   their source.
4. Convention: `*.test.jsx` suffix for JSX files, `*.test.js` for plain JS files
   (hooks, firebase helpers, utils).

One-liner rule: **test file lives in the same directory as the file it tests, with the same
base name and a `.test.[jx]s` extension.**

Exception: a `src/test-utils/` directory (not `__tests__/`) is the right home for shared
test helpers — custom render wrappers, mock factories, and Vitest setup. This directory
contains no tests itself; it only exports utilities consumed by test files elsewhere.

```
mp-react/src/
├── firebase.js
├── firebase.test.js          ← tests for firebase.js helpers
├── contexts/
│   ├── AuthContext.jsx
│   └── AuthContext.test.jsx  ← tests for the context and useAuth hook
├── hooks/
│   ├── useEmpresa.js
│   └── useEmpresa.test.js    ← tests for the hook
├── pages/
│   ├── AdminPage.jsx
│   ├── AdminPage.test.jsx
│   ├── FormPage.jsx
│   ├── FormPage.test.jsx
│   └── ...
└── test-utils/
    ├── renderWithProviders.jsx   ← custom render: BrowserRouter + AuthProvider mock
    ├── mockFirebase.js           ← shared vi.mock factory for ../firebase
    └── setupTests.js             ← global afterEach cleanup, jest-dom matchers
```

---

## Component Boundaries

**What counts as a testable unit in this app:**

| Layer | Unit | Test type | Mock boundary |
|-------|------|-----------|---------------|
| `firebase.js` helpers | Individual named export (`criarOS`, `getEmpresaBySlug`, etc.) | Unit | Mock the Firebase SDK (`firebase/firestore`, `firebase/auth`) |
| `useEmpresa` hook | The hook itself | Unit (renderHook) | Mock `../firebase` entirely |
| `AuthContext` / `useAuth` | The Provider behavior | Unit (renderHook or render) | Mock `../firebase` entirely |
| Route guards (`RotaAdmin`, `RotaSuperAdmin`) | Guard redirect logic | Unit | Mock `useAuth` via a test `AuthProvider` |
| Public page components (`FormPage`, `AvaliacaoPage`, etc.) | Component render + user interaction | Integration | Mock `../firebase`; real React Router with `createRoutesStub` |
| Protected page (`AdminPage`) | Individual sub-behaviors extracted to helpers | Integration | Mock `../firebase`; mock `useAuth` |

**The golden rule:** mock at the module boundary, not at the React level.
- Mock `../firebase` (vi.mock), not the Firestore SDK internals.
- Mock `../contexts/AuthContext` only as a last resort; prefer wrapping with a real
  `AuthProvider` seeded with a controlled Firebase mock.

---

## Data Flow Testing

### Chain: Firebase SDK → firebase.js helpers → hooks → components

The dependency graph is linear and each layer mocks the one below it:

```
Firebase JS SDK  ← mocked with vi.mock('firebase/firestore')
      ↓
firebase.js      ← tested in isolation; also used as the mock boundary for layers above
      ↓
useEmpresa       ← tested with vi.mock('../firebase'); uses renderHook
      ↓
FormPage         ← tested with vi.mock('../firebase'); uses createRoutesStub
```

### Mocking firebase.js in hook and page tests

All page components and hooks import from `../firebase` (not from the Firebase SDK
directly). This means a single `vi.mock('../firebase')` covers all Firebase behavior for
every hook and page test. Create a shared factory in `src/test-utils/mockFirebase.js`:

```js
// src/test-utils/mockFirebase.js
import { vi } from 'vitest'

export const mockGetEmpresaBySlug = vi.fn()
export const mockGetConfigEmpresa  = vi.fn()
export const mockCriarOS           = vi.fn()
export const mockAtualizarOS       = vi.fn()
export const mockGetOSdaEmpresa    = vi.fn()
export const mockContarOSdoMes     = vi.fn()

// Call this at the top of any test file that imports pages or hooks:
// vi.mock('../firebase', () => import('../test-utils/mockFirebase'))
// Then use mockGetEmpresaBySlug.mockResolvedValue({...}) in individual tests.
```

In a hook test file:
```js
vi.mock('../firebase', async () => {
  const { mockGetEmpresaBySlug, mockGetConfigEmpresa, PLANOS } =
    await import('../test-utils/mockFirebase')
  return {
    getEmpresaBySlug: mockGetEmpresaBySlug,
    getConfigEmpresa:  mockGetConfigEmpresa,
    PLANOS: { basico: { limiteOS: 50, preco: 97 }, pro: { limiteOS: -1, preco: 197 } },
  }
})
```

### Mocking AuthContext in page tests

Do NOT mock `useAuth` with `vi.mock('../contexts/AuthContext')` — that replaces the hook
globally and breaks teardown. Instead, use a thin `FakeAuthProvider` wrapper that accepts
overrides:

```jsx
// src/test-utils/renderWithProviders.jsx
import { MemoryRouter }  from 'react-router-dom'
import { AuthContext }   from '../contexts/AuthContext'

const defaultAuth = {
  usuario:      null,
  empresaId:    null,
  isSuperAdmin: false,
  loadingAuth:  false,
  estaLogado:   false,
  emailUsuario: null,
  login:        vi.fn(),
  logout:       vi.fn(),
  cadastrar:    vi.fn(),
}

export function renderWithProviders(ui, { authOverrides = {}, route = '/' } = {}) {
  const authValue = { ...defaultAuth, ...authOverrides }
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[route]}>
        {ui}
      </MemoryRouter>
    </AuthContext.Provider>
  )
}
```

Usage in a test:
```js
renderWithProviders(<AdminPage />, {
  authOverrides: { estaLogado: true, empresaId: 'empresa-abc' },
  route: '/minha-empresa/admin',
})
```

### Testing the module-level cache in useEmpresa

`useEmpresa.js` uses a module-level `cache` object. Between tests, the cache persists
because Vitest re-uses the module. Reset it by either:
1. Re-importing the module with `vi.resetModules()` in a `beforeEach`, or
2. Exposing a `clearCache()` helper in `useEmpresa.js` (preferred — less coupling to
   Vitest internals).

Recommendation: add `export function _clearCacheForTest() { Object.keys(cache).forEach(k => delete cache[k]) }`
at the bottom of `useEmpresa.js` and call it in `beforeEach` in `useEmpresa.test.js`.

---

## Suggested Build Order

Build tests in dependency order — low-dependency modules first.

### Tier 0 — Pure utility layer (no React, no Firebase)
Files: `src/utils/pdfGenerator.js`, `src/utils/orcamentoPdfGenerator.js`, `src/utils/pngGenerator.js`

These functions depend only on `jsPDF` and `html2canvas`. Mock those two libraries.
Benefit: establishes Vitest config and proves the test runner works before any Firebase
complexity.

### Tier 1 — Data access layer
File: `src/firebase.js`

Test each named export (`getEmpresaBySlug`, `criarOS`, `atualizarOS`, `contarOSdoMes`,
`getOSdaEmpresa`, `getConfigEmpresa`, `cadastrarEmpresa`).

Mock: `firebase/firestore` SDK functions only (`getDocs`, `addDoc`, `updateDoc`, `setDoc`,
`getDoc`, `getCountFromServer`).

Each test verifies:
- Correct Firestore path is constructed
- Correct SDK function is called with expected arguments
- Return value is transformed correctly (e.g., `{ id: docSnap.id, ...docSnap.data() }`)

This is the most important tier. Getting it right makes every other test simpler.

### Tier 2 — Custom hook
File: `src/hooks/useEmpresa.js`

Depends on: Tier 1 (`../firebase`)

Use `renderHook` from `@testing-library/react`. Wrap with `createRoutesStub` or
`MemoryRouter` (the hook calls `useParams` and `useNavigate`).

Tests:
- Slug found → `empresa` and `config` state populated, `loading` transitions correctly
- Slug not found → `navigate('/empresa-nao-encontrada')` is called
- Cache hit → `getEmpresaBySlug` is called only once across two renders of the same slug
- `verificarLimite` pure logic (no async needed — test synchronously)

### Tier 3 — Auth context
File: `src/contexts/AuthContext.jsx`

Depends on: Tier 1 (`../firebase`)

Use `renderHook(() => useAuth(), { wrapper: AuthProvider })`.

Tests:
- `loadingAuth` is true on mount, false after `onAuthStateChanged` fires
- Normal user → `empresaId` resolved from `empresas/{uid}`
- Fallback user → `empresaId` resolved from `usuarios/{uid}.empresaId`
- Superadmin email → `isSuperAdmin: true`, `empresaId: null`
- Logged out → all state clears to null/false

### Tier 4 — Route guards (thin integration)
File: `src/App.jsx` (guards `RotaAdmin`, `RotaSuperAdmin`)

Mock `useAuth` (via `FakeAuthProvider`). Render `<App>` inside `MemoryRouter` with
`initialEntries` targeting a protected route. Assert redirect vs. render.

Tests:
- Unauthenticated user on `/:slug/admin` → redirects to `/login`
- Authenticated non-superadmin on `/superadmin` → redirects to `/`
- Authenticated superadmin on `/superadmin` → renders `SuperAdminPage`

### Tier 5 — Page components (critical paths only)
Priority order based on user-impact:

1. `FormPage.test.jsx` — most-used public flow
   - Test: form renders with company branding (mocked `useEmpresa`)
   - Test: submit calls `criarOS` with correct payload
   - Test: required field validation blocks submit

2. `LoginPage.test.jsx`
   - Test: login button calls `login()` from AuthContext
   - Test: error message appears on failed login

3. `AdminPage.test.jsx` — largest file, test behaviors not the full component
   - Skip trying to render the whole thing in one test
   - Test individual behaviors: filter OS list, change status, delete confirm dialog
   - Each test sets up only the minimal state needed via mocks

4. `AvaliacaoPage.test.jsx` — unauthenticated Firestore write
   - Test: star rating submits only once (rules: can't re-submit)

---

## Router Testing

### Key facts about this app's routing

- React Router v7 (`react-router-dom@^7.14.0`) is used in library mode (not framework mode)
- All slug-based pages read `useParams()` for `slug`, `osId`, `orcamentoId`
- `useEmpresa` additionally calls `useNavigate()` for the not-found redirect
- `RotaAdmin` and `RotaSuperAdmin` call `useAuth()` and render `<Navigate>`

### Pattern: `createRoutesStub` for param-aware tests

React Router v7 exposes `createRoutesStub` for unit testing components that depend on
router hooks. This is the recommended approach when a component calls `useParams`:

```jsx
import { createRoutesStub } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock firebase before anything else
vi.mock('../firebase', () => ({ getEmpresaBySlug: vi.fn(), getConfigEmpresa: vi.fn() }))

import { getEmpresaBySlug, getConfigEmpresa } from '../firebase'
import FormPage from './FormPage'

describe('FormPage', () => {
  beforeEach(() => {
    getEmpresaBySlug.mockResolvedValue({
      id: 'emp-123', nome: 'Oficina Teste', slug: 'oficina-teste', plano: 'basico', ativo: true,
    })
    getConfigEmpresa.mockResolvedValue({
      nome: 'Oficina Teste', corPrimaria: '#1a3a5c', seguradoras: ['Mapfre'],
    })
  })

  it('renders company name after slug resolves', async () => {
    const Stub = createRoutesStub([{ path: '/:slug', Component: FormPage }])
    render(<Stub initialEntries={['/oficina-teste']} />)
    expect(await screen.findByText('Oficina Teste')).toBeInTheDocument()
  })
})
```

### Pattern: `MemoryRouter` with `Routes/Route` for guard tests

For testing `RotaAdmin` and `RotaSuperAdmin`, render the full `<App>` or a minimal route
tree with a `MemoryRouter`:

```jsx
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthContext } from '../contexts/AuthContext'
import App from './App'

function renderApp(initialEntry, authValue) {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <App />
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

it('redirects unauthenticated user from /slug/admin to /login', async () => {
  renderApp('/minha-empresa/admin', { estaLogado: false, loadingAuth: false })
  expect(await screen.findByRole('heading', { name: /entrar/i })).toBeInTheDocument()
})
```

### Note on `loadingAuth`

`AuthProvider` renders a "Carregando..." spinner while `loadingAuth` is true and does not
render children at all. All test `FakeAuthProvider` or context overrides MUST set
`loadingAuth: false`, otherwise the component under test will never mount.

### Vitest configuration additions required

The current `vite_config.js` has no test block. Add:

```js
// vite_config.js (add test block)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals:      true,
    environment:  'jsdom',
    setupFiles:   './src/test-utils/setupTests.js',
  },
})
```

`setupTests.js` minimal content:
```js
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
afterEach(() => cleanup())
```

New dev dependencies required:
```
vitest
@testing-library/react
@testing-library/user-event
@testing-library/jest-dom
jsdom
```

---

## Sources

- [Vitest config: environment](https://vitest.dev/config/environment.html) — HIGH confidence
- [React Router v7 Testing guide](https://reactrouter.com/start/framework/testing) — HIGH confidence, official docs
- [Vitest Mocking guide](https://vitest.dev/guide/mocking) — HIGH confidence, official docs
- [Testing Library: React Context example](https://testing-library.com/docs/example-react-context/) — HIGH confidence
- [Mocking context with RTL (polvara.me)](https://polvara.me/posts/mocking-context-with-react-testing-library/) — MEDIUM confidence
- [Securing routes with Vitest (Medium)](https://medium.com/@vitalismutwiri/securing-react-router-dom-routes-with-vitest-and-testing-tools-a3c364f14e67) — MEDIUM confidence
