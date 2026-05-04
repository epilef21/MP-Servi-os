# Research: Testing Pitfalls

**Project:** AssistHub — Vitest + React Testing Library test suite
**Researched:** 2026-05-03
**Scope:** React 19 + Vite + Firebase JS SDK v12, Vitest, jsdom

---

## 1. firebase.js throws at import time — the env-guard bomb

**Warning signs:**
- Every test file that imports anything from `firebase.js` (directly or transitively) fails with `"Variáveis de ambiente do Firebase não encontradas"` before a single `it()` runs.
- The error appears even in tests that mock all Firebase calls, because the `if (!firebaseConfig.apiKey)` guard at line 52–57 of `firebase.js` runs unconditionally when the module is first evaluated by the Vitest runtime.
- `VITE_FIREBASE_*` variables are `undefined` in the test process because `import.meta.env` is not populated from `.env` files unless Vitest is told to load them via `envDir` or `loadEnv()`.

**Prevention:**
- Add a `.env.test` file (or `vitest.config.js` `env:{}` block) with stub values for every `VITE_FIREBASE_*` key. Values do not need to be real credentials — anything non-empty passes the guard.
- Alternatively, mock the entire `../firebase` module before any test file tries to import it, using `vi.mock('../firebase', () => ({ db: {}, auth: {}, ... }))`. This prevents the module body from executing at all.
- Do not rely on `.env` being present in CI — always declare test env values explicitly in `vitest.config.js` under the `test.env` key.
- Use `vi.stubEnv` in a `beforeEach` only for tests that need to vary env values; for the guard check specifically, the module-level error fires before any `beforeEach` hook runs.

**Affects:** All tests — any test file that imports from `firebase.js`, `AuthContext.jsx`, `useEmpresa.js`, or `AdminPage.jsx` (which all transitively import `firebase.js`).

---

## 2. Partial mocks of firebase.js leave the real initializeApp running

**Warning signs:**
- Test output shows `"Firebase: Firebase App named '[DEFAULT]' already exists."` on the second test file to run in the same worker.
- Happens when `vi.mock('firebase/app')` is not set, so `initializeApp` is called for real from `firebase.js` and the singleton is registered in the Firebase internal registry. The next test file that imports `firebase.js` hits the same singleton already registered.
- Also surfaces as `vi.resetModules()` failing to fully isolate tests because the Firebase SDK has its own internal module-level state that `vi.resetModules()` cannot reach.

**Prevention:**
- Mock the entire `'../firebase'` module in every test file (or in a global `setupFiles` entry) rather than mocking individual sub-packages like `'firebase/firestore'`. This prevents `initializeApp` from executing at all.
- If you must mock individual sub-packages, mock `'firebase/app'` first and return a no-op `initializeApp`: `vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }))`.
- The factory function passed to `vi.mock` is hoisted — it cannot reference variables declared outside it. All mock return values must be defined inline or via `vi.hoisted()`.
- Set `clearMocks: true` and `resetModules: false` in `vitest.config.js`. Do NOT use `resetModules: true` globally — it re-evaluates `firebase.js` on every test file, which re-runs `initializeApp`, which throws the "already exists" error unless `'firebase/app'` is also re-mocked.

**Affects:** All tests.

---

## 3. onAuthStateChanged callback fires outside act() — cascade of act() warnings

**Warning signs:**
- Console flood of `"Warning: An update to AuthProvider inside a test was not wrapped in act(...)"` when rendering any component that uses `AuthContext`.
- The first render shows the loading spinner (because `loadingAuth: true`). The callback from `onAuthStateChanged` fires asynchronously and sets `loadingAuth: false`, but by then the test assertion has already run and the state update is outside the React scheduler's tracked work.
- Tests appear to pass but the console is noisy; later tests fail intermittently because the auth state from a previous test leaks through.

**Prevention:**
- Mock `onAuthStateChanged` to call its callback synchronously in the mock factory, so the state update happens inside the initial `render()` call which React Testing Library already wraps in `act()`:
  ```js
  vi.mock('../firebase', () => ({
    onAuthStateChanged: vi.fn((auth, cb) => { cb(null); return () => {} }),
    // ...
  }))
  ```
- When the mock needs to simulate a delayed sign-in, use `await waitFor(() => expect(screen.getByText('...')).toBeInTheDocument())` rather than bare assertions — `waitFor` is internally wrapped in `act()`.
- Always return a no-op unsubscribe function `() => {}` from the `onAuthStateChanged` mock — `AuthContext.jsx` calls the return value on unmount; if it is undefined, you get a TypeError during cleanup that poisons subsequent tests.

**Affects:** Auth tests, and any component test that renders inside `AuthProvider` (AdminPage, RotaAdmin guard, SuperAdminPage).

---

## 4. Firestore Timestamp objects break component rendering in tests

**Warning signs:**
- Tests that render OS list items crash with `"ts.toDate is not a function"` or `"Cannot read properties of undefined (reading 'toDate')"`.
- The `fmtDate` and `fmtDatetime` helpers in `AdminPage.jsx` call `d.toDate()` on `criado_em` fields. In tests, mock Firestore documents typically return plain JS objects like `{ criado_em: { seconds: 1234, nanoseconds: 0 } }` — those objects do not have a `.toDate()` method.
- `serverTimestamp()` mocked as `vi.fn()` returns `undefined` by default; storing that in a mock document then calling `fmtDate(undefined)` returns `'—'` instead of a real date, causing date-dependent assertions to fail.

**Prevention:**
- Return proper Timestamp-shaped objects from mocks: `{ toDate: () => new Date('2024-01-15') }`. This matches the interface `fmtDate` expects without needing a real Firebase SDK.
- Mock `serverTimestamp` to return a consistent fixed value: `serverTimestamp: vi.fn(() => ({ toDate: () => new Date('2024-01-15') }))`.
- For Firestore documents in mock data, always include `criado_em: { toDate: () => new Date('...') }` rather than a raw ISO string or a plain object with `seconds`.

**Affects:** OS tests, budget (orçamento) tests — any test asserting on date display.

---

## 5. Module-level cache in useEmpresa.js poisons slug lookups across tests

**Warning signs:**
- Test B (slug `empresa-b`) returns the data from Test A (slug `empresa-a`) because the module-level `const cache = {}` in `useEmpresa.js` was populated by Test A and is never reset.
- Tests pass in isolation (`vitest --testNamePattern`) but fail when the full suite runs.
- The mock for `getEmpresaBySlug` is never called in Test B — call count is 0 — yet the component renders with data. This is the cache serving stale data, bypassing the mock entirely.

**Prevention:**
- In a `beforeEach` or test `setup` file, reset the cache: `vi.resetModules()` before importing the hook in each test, or mock `useEmpresa` itself rather than its internal Firebase dependencies, returning controlled values.
- Prefer mocking the hook directly at the test level: `vi.mock('../hooks/useEmpresa', () => ({ useEmpresa: vi.fn(() => ({ empresa: mockEmpresa, loading: false, ... })) }))`. This sidesteps the module-level cache entirely.
- If you test `useEmpresa` itself (unit-testing the hook), use `vi.isolateModules()` to get a fresh module instance per test.

**Affects:** All tests that render components using `useEmpresa` (FormPage, AdminPage).

---

## 6. AuthContext renders null during loadingAuth — test sees empty DOM

**Warning signs:**
- `screen.getByRole('button', { name: /entrar/ })` throws `"Unable to find an accessible element"` on LoginPage tests because `AuthProvider` renders `null` (the loading spinner div) during `loadingAuth: true`.
- The mock for `onAuthStateChanged` does not call its callback at all, so `loadingAuth` never transitions to `false`, and children never mount.
- Alternatively, the callback is called but asynchronously (e.g. via `Promise.resolve().then(cb)`), so the initial render snapshot is empty.

**Prevention:**
- Mock `onAuthStateChanged` to call `cb(null)` (logged-out state) synchronously — this sets `loadingAuth = false` during the first render cycle, so children are visible immediately.
- For tests that need the "loading" state specifically, use `waitFor` to wait for the spinner to disappear before asserting on protected content.
- Add a `data-testid="loading-auth"` to the loading div in `AuthContext.jsx` so tests can explicitly wait for `waitForElementToBeRemoved(() => screen.getByTestId('loading-auth'))`.

**Affects:** Auth tests, any test rendering a component inside `AuthProvider`.

---

## 7. Testing AdminPage.jsx directly — the 3000-line component trap

**Warning signs:**
- Rendering `<AdminPage />` in a test hangs or times out because it triggers 10+ `useEffect` hooks that fire parallel Firebase reads (`loadReports`, `loadOrcamentos`, `loadTecnicos`, `loadConfig`, `loadProfile`, etc.).
- Each of those async effects updates state, producing a cascade of re-renders. Without all mocks in place, some calls return `undefined` (default `vi.fn()` return), causing `snap.docs.map(...)` to throw `"Cannot read properties of undefined (reading 'map')"`.
- Test file requires 40+ mock definitions just to reach a rendered DOM without errors.
- `vi.mock` for `../firebase` accidentally misses one export (`getDocs`, `query`, `orderBy`, etc.) and the real function is called, hitting the network.

**Prevention:**
- Do NOT test business logic through `AdminPage` directly. Extract the logic under test into smaller units first (utility functions, custom hooks) and test those in isolation.
- If you must render `AdminPage` for integration-style tests, mock every function imported from `firebase.js` that is called in `useEffect` hooks. A comprehensive mock factory:
  - `getDocs` → returns `{ docs: [] }` (empty snapshot)
  - `getDoc` → returns `{ exists: () => false, data: () => ({}) }`
  - `addDoc` → returns `Promise.resolve({ id: 'mock-id' })`
  - `updateDoc`, `deleteDoc` → return `Promise.resolve()`
- Use `await waitFor(() => expect(screen.queryByText('Carregando...')).not.toBeInTheDocument())` before any assertion, to let all initial effects settle.
- Prefer testing OS and budget flows through smaller composed components or through extracted handler functions once the refactor begins.

**Affects:** OS tests, budget tests — any test that renders AdminPage.

---

## 8. vi.mock factory references outside variables — silent undefined mocks

**Warning signs:**
- A mock is set up as `const mockUser = { uid: 'abc' }; vi.mock('../firebase', () => ({ auth: mockUser }))` — this looks valid but `mockUser` is `undefined` inside the factory because `vi.mock` is hoisted before the variable declaration.
- The component receives `auth: undefined` and crashes with a different error than expected, making debugging confusing.
- No warning is shown by Vitest — the factory executes successfully, it just closes over `undefined`.

**Prevention:**
- Use `vi.hoisted()` to declare variables that must be accessible inside `vi.mock` factories:
  ```js
  const { mockUser } = vi.hoisted(() => ({ mockUser: { uid: 'abc' } }))
  vi.mock('../firebase', () => ({ auth: mockUser }))
  ```
- Alternatively, define all mock values inline inside the factory function — no external references needed.
- Use TypeScript or JSDoc types on mock return values to catch shape mismatches before the test runs (optional given the project is JS-only).

**Affects:** All tests.

---

## 9. Uncleaned Firebase listeners cause memory leaks and act() warnings in watch mode

**Warning signs:**
- Running `vitest --watch` causes memory to grow steadily over multiple file saves. After ~20 re-runs the process crashes with OOM or becomes very slow.
- Console shows `"MaxListenersExceededWarning: Possible EventEmitter memory leak"` after several test file reloads.
- `onAuthStateChanged` or `onSnapshot` listeners set up in a `useEffect` are not cleaned up if the component unmounts before the async mock callback fires — the callback fires after cleanup and tries to call `setState` on an unmounted component.

**Prevention:**
- Ensure every mock of `onAuthStateChanged` and `onSnapshot` returns a cleanup function. Even a no-op `() => {}` prevents the "unsubscribe is not a function" error during unmount.
- Call `cleanup()` from `@testing-library/react` in `afterEach` (or configure `globals: true` in Vitest so RTL auto-registers the cleanup). This unmounts all components rendered during a test, triggering `useEffect` cleanup functions.
- In `vitest.config.js`, set `pool: 'forks'` or use `isolate: true` (default) so each test file gets a fresh Node process/worker — this prevents listener accumulation across files.
- If `onSnapshot` is used in future refactors, the mock must capture the unsubscribe function and call it in `afterEach`.

**Affects:** All tests in watch mode. Auth tests and any future real-time listener tests especially.

---

## 10. Multi-tenant route params not provided — useParams returns undefined slug

**Warning signs:**
- Components using `useParams()` to extract `slug` receive `undefined` because the test renders the component without wrapping it in `MemoryRouter` with the correct route path.
- `useEmpresa` calls `getEmpresaBySlug(undefined)` which either throws or returns an unexpected result from the mock.
- RTL's default `render()` wraps in nothing — React Router hooks throw `"useParams() may be used only in the context of a <Router> component"` or silently return `{}`.

**Prevention:**
- Always render slug-dependent components inside a `MemoryRouter` with the initial entry and a matching route:
  ```jsx
  render(
    <MemoryRouter initialEntries={['/empresa-teste/admin']}>
      <Routes>
        <Route path="/:slug/admin" element={<AdminPage />} />
      </Routes>
    </MemoryRouter>
  )
  ```
- Create a shared test helper `renderWithRouter(ui, { slug })` that wires up MemoryRouter, AuthProvider, and the route so every test has the same baseline setup.
- For tests of `useEmpresa` via `renderHook`, wrap with a custom wrapper that provides Router context with the desired slug.

**Affects:** OS tests, auth tests — any component that reads `useParams().slug`.

---

## 11. clearMocks vs resetMocks confusion — mock implementations silently disappear

**Warning signs:**
- Test A sets `getDocs.mockResolvedValueOnce(snap)`. Test B runs and `getDocs` returns `undefined` because `resetMocks: true` in config replaced the implementation with `undefined` between tests.
- Conversely, `clearMocks: false` leaves call counts from Test A visible in Test B, causing `expect(getDocs).toHaveBeenCalledTimes(1)` to report 2 in the second test.
- Error messages say `"snap.docs is not iterable"` which points to a different bug than the real cause (missing mock reset).

**Prevention:**
- Set only `clearMocks: true` in `vitest.config.js`. This zeroes call counts between tests without removing implementations.
- Do NOT set `resetMocks: true` globally — it removes mock implementations, requiring every test to re-declare what each function returns.
- Do NOT set `restoreMocks: true` globally if you use `vi.mock()` — restoring replaces `vi.mock()` mocks with real implementations, re-enabling real Firebase calls.
- Use `mockResolvedValue` (persistent) in `beforeEach` for the default happy-path and `mockResolvedValueOnce` (one-shot override) in individual tests for edge cases.

**Affects:** All tests.

---

## 12. Tests pass locally (Windows) but fail in CI (Linux) — path and locale differences

**Warning signs:**
- Date formatting assertions fail in CI: local machine uses `pt-BR` locale via the OS; `jsdom` in a Linux CI container defaults to `en-US` unless configured.
- `fmtDate` and `fmtDatetime` use `toLocaleString('pt-BR')` — in CI, `jsdom` may not have the `pt-BR` ICU data, producing different output.
- File path separators in snapshot strings use `\` on Windows and `/` on Linux — any snapshot test of URLs or paths will fail on one platform.

**Prevention:**
- For date formatting assertions, compare against the explicit string output rather than a locale-formatted result, or mock `Date.prototype.toLocaleString` to return a fixed string.
- Configure `jsdom` with `locale: 'pt-BR'` in Vitest config if date/number formatting is asserted: `environmentOptions: { jsdom: { locale: 'pt-BR' } }`.
- Avoid `window.location.origin` assertions in unit tests — mock it via `vi.stubGlobal('location', { origin: 'https://app.assisthub.com' })` so the value is deterministic across platforms.
- Pin jsdom and Vitest versions with exact versions in `package.json` (not `^`) to prevent subtle version upgrades in CI pulling a different ICU dataset.

**Affects:** OS tests (date fields), budget tests (BRL formatting), all tests run in CI.

---

## 13. gerarNumeroOrcamento race condition invisible in tests — false green

**Warning signs:**
- The unit test for `gerarNumeroOrcamento` passes because it mocks `getDocs` to return a single document. But the function has a real concurrency bug: two simultaneous calls in production will read the same "last" document and both generate `ORC-2024-0002`.
- Because unit tests run sequentially, the race is never exercised and the test gives false confidence.
- `Date.now().slice(-4)` in the fallback path returns a 4-digit string but is not zero-padded, producing `ORC-2024-123` instead of `ORC-2024-0123` — this formatting inconsistency is also invisible in happy-path tests.

**Prevention:**
- Write a specific test for the error/fallback path: mock `getDocs` to reject, assert the fallback format matches the expected pattern `/^ORC-\d{4}-\d{4}$/`.
- Write a test that calls `gerarNumeroOrcamento` twice with the same mock snapshot and asserts both calls return the same number — this documents the known concurrency limitation rather than hiding it.
- Flag in a test comment that sequential-read-based numbering is not safe under concurrent writes; the test suite cannot prove safety, only document known behavior.

**Affects:** Budget tests.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Vitest setup & config | firebase.js env-guard bomb (#1) | Add `.env.test` with stub values before first test run |
| Auth flow tests | onAuthStateChanged outside act() (#3) | Sync mock callback; return no-op unsubscribe |
| Auth flow tests | AuthContext renders null (#6) | Sync `cb(null)` in mock; use waitForElementToBeRemoved |
| OS CRUD tests | Timestamp.toDate() crash (#4) | Mock documents with `{ toDate: () => new Date() }` |
| OS CRUD tests | AdminPage 3000-line trap (#7) | Test handlers/hooks in isolation, not full page render |
| Budget tests | gerarNumeroOrcamento false green (#13) | Test fallback path explicitly |
| Multi-tenant routing | useParams undefined slug (#10) | Always wrap in MemoryRouter with route pattern |
| All tests (setup) | vi.mock factory hoisting (#8) | Use vi.hoisted() for shared mock values |
| All tests (setup) | clearMocks vs resetMocks (#11) | Set only clearMocks: true in vitest.config.js |
| All tests (watch mode) | Listener memory leaks (#9) | Return cleanup fn from every listener mock; enable RTL auto-cleanup |
| All tests (CI) | Windows/Linux locale differences (#12) | Mock toLocaleString or configure jsdom locale |
| All tests (cross-file) | Module singleton / initializeApp (#2) | Mock entire firebase module, not sub-packages |
| All tests (cross-file) | useEmpresa module-level cache (#5) | Mock useEmpresa hook directly or use vi.isolateModules() |
