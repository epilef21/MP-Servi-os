---
phase: 04-fluxos-criticos
reviewed: 2026-05-20T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - mp-react/src/__tests__/osFluxo.test.jsx
  - mp-react/src/__tests__/orcamentoFluxo.test.jsx
findings:
  critical: 2
  warning: 6
  info: 2
  total: 10
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-05-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed the two test files covering OS and orçamento critical flows. The overall architecture is sound — the stub-component pattern for `osFluxo.test.jsx` and the real-page rendering in `orcamentoFluxo.test.jsx` are appropriate choices. `vi.mock` placement (Padrão C), `_clearCacheForTest()` usage, and global `clearMocks: true` are all correctly applied.

Two critical issues were found: one silent mock failure that makes three orçamento tests unreliable, and one assertion that cannot pass as written (ORC-03 / ORC-04 route mismatch). Six warnings cover assertion gaps, missing guard checks, test-bleed vectors, and missing coverage of important paths. Two info items cover minor quality improvements.

---

## Critical Issues

### CR-01: `getDoc` mock has no default in `orcamentoFluxo` — ORC-01/02/03 will fail whenever `clearMocks:true` resets it between tests within the same file

**File:** `mp-react/src/__tests__/orcamentoFluxo.test.jsx:14`

**Issue:** In the `vi.mock('../firebase', ...)` factory, `getDoc` is declared as `vi.fn()` with no `.mockResolvedValue(...)` default:

```js
getDoc: vi.fn(),   // ← no default resolved value
```

`clearMocks: true` in `vitest.config.js` clears call history and **also resets mock implementations** between every test. That means the `getDoc.mockResolvedValue(snapRetorno)` set inside `renderOrcamento()` is the only setup — and it works for the first test that calls `renderOrcamento`. But `clearMocks: true` is documented to call `mockReset()` semantics on every mock between tests (it clears `.mock.calls`, `.mock.instances` and the queued return values). Any test that relies on a previous test's `mockResolvedValue` will receive `undefined` instead of a snapshot, causing `snap.exists()` to throw a `TypeError: snap.exists is not a function`.

The correct fix is to give `getDoc` a safe fallback in the factory, matching the other mocks in the file:

```js
// In vi.mock factory:
getDoc: vi.fn().mockResolvedValue({ exists: () => false, id: '', data: () => ({}) }),
```

`renderOrcamento()` already calls `getDoc.mockResolvedValue(snapRetorno)` before each render, so the per-test override still wins. The factory default is just the safety net that `clearMocks` requires.

**Fix:**
```js
// mp-react/src/__tests__/orcamentoFluxo.test.jsx line 14
// Change:
getDoc: vi.fn(),
// To:
getDoc: vi.fn().mockResolvedValue({ exists: () => false, id: '', data: () => ({}) }),
```

---

### CR-02: ORC-03 and ORC-04 render with a route pattern that does not match the real page routes — tests may silently pass against a blank render

**File:** `mp-react/src/__tests__/orcamentoFluxo.test.jsx:73-82`

**Issue:** `renderOrcamento` mounts components under the route pattern `/:slug/:orcamentoId`. That matches the URL `/empresa-teste/orc-123`, so `useParams()` returns `{ slug: 'empresa-teste', orcamentoId: 'orc-123' }`. This is correct for `OrcamentoTecnicoPage` (which uses `useParams().orcamentoId`).

However, `AprovarOrcamentoPage` also uses `useParams().orcamentoId`. Looking at the actual app routes, `AprovarOrcamentoPage` lives at `/aprovar/:slug/:orcamentoId`, while `OrcamentoTecnicoPage` lives at `/orcamento/:slug/:orcamentoId`. The `renderOrcamento` helper uses the generic pattern `/:slug/:orcamentoId`, which works for both in isolation because the `slug` and `orcamentoId` params are extracted identically.

The deeper bug is that ORC-04's assertion (`screen.getByText(/Maria Santos/i)`) can pass even if `AprovarOrcamentoPage` never finishes loading — `Maria Santos` appears in `snapCliente.data().nome_cliente` and the component renders it as plain text in the "Seus Dados" section only after `loadingOrc` becomes false. The `waitFor` only waits for the loading spinner to disappear, but there is a window where `orc` is `null` and the component returns `null` (line 154 of `AprovarOrcamentoPage.jsx`). If the mock resolution is synchronous (it is — `mockResolvedValue` resolves on the next microtask), this is usually fine in practice, but the assertion is not guarded: if `queryByText` passes before the component has rendered the data section, the `getByText` after the `waitFor` could still find the text in a stale render or not find it at all.

**The real structural risk:** the single `renderOrcamento` helper is shared between `OrcamentoTecnicoPage` and `AprovarOrcamentoPage`. If the route structure of either page changes (e.g., the param is renamed from `orcamentoId` to `id`), both sets of tests break without a clear error. The helper should assert the param name or use the real route patterns.

**Fix:** Add the real route prefix to each page's render and assert that data is visible after `waitFor` resolves:

```js
// For OrcamentoTecnicoPage tests:
function renderTecnico(snap) {
  // ...mocks...
  return render(
    <MemoryRouter initialEntries={['/orcamento/empresa-teste/orc-123']}>
      <Routes>
        <Route path="/orcamento/:slug/:orcamentoId" element={<OrcamentoTecnicoPage />} />
      </Routes>
    </MemoryRouter>
  )
}

// For AprovarOrcamentoPage tests:
function renderAprovar(snap) {
  // ...mocks...
  return render(
    <MemoryRouter initialEntries={['/aprovar/empresa-teste/orc-123']}>
      <Routes>
        <Route path="/aprovar/:slug/:orcamentoId" element={<AprovarOrcamentoPage />} />
      </Routes>
    </MemoryRouter>
  )
}
```

---

## Warnings

### WR-01: OS-04 uses `vi.restoreAllMocks()` in `afterEach` which will break the `vi.mock('../firebase')` mocks for any test that runs after OS-04 in the same file

**File:** `mp-react/src/__tests__/osFluxo.test.jsx:194`

**Issue:** `afterEach(() => vi.restoreAllMocks())` inside the OS-04 `describe` block calls `restoreAllMocks()` after every test in that `describe`. `restoreAllMocks()` restores the original implementation of all spied functions — including any `vi.fn()` spy-wraps applied by `vi.mock`. In practice, the `window.confirm` spy is the only spy in scope, so it gets restored correctly. However, this relies on an implicit assumption that no other spy is active at the time OS-04's `afterEach` fires. If a future test adds a `vi.spyOn` outside OS-04's scope but runs before it, `restoreAllMocks()` would silently undo that spy too.

The correct, scoped fix is to store the spy reference and restore only it:

```js
describe('OS-04: excluir OS e remover da lista', () => {
  let confirmSpy
  beforeEach(() => {
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
  })
  afterEach(() => {
    confirmSpy.mockRestore()
  })
  // ...
})
```

---

### WR-02: OS-05 and OS-06 wrap `OSListaStub` in `<MemoryRouter>` but OS-01 through OS-04 do not — inconsistency may hide a real requirement

**File:** `mp-react/src/__tests__/osFluxo.test.jsx:218-228, 240-251`

**Issue:** `OSListaStub` does not use any router primitive — it has no `Link`, `useNavigate`, or `useParams`. Wrapping it in `<MemoryRouter>` is harmless but misleading: it implies the component needs a router context, which it does not. More importantly, the other stub components (OS-01 through OS-04) are rendered without `<MemoryRouter>`. If any of those stubs ever acquires a router dependency (e.g., after a redirect on successful creation), the tests for OS-01 through OS-04 will throw `useNavigate() may be used only in the context of a <Router>` without a clear clue about why OS-05/06 work and those do not. Standardize: either always wrap in `<MemoryRouter>` or never wrap when it's not needed.

**Fix:** Remove the unnecessary `<MemoryRouter>` from OS-05 and OS-06:
```js
render(<OSListaStub empresaId="emp-test-1" />)
```

---

### WR-03: ORC-03 assertion does not verify that `updateDoc` was called with the correct `doc` reference — a bug in `empresaId` or `orcamentoId` would go undetected

**File:** `mp-react/src/__tests__/orcamentoFluxo.test.jsx:193-198`

**Issue:** The assertion checks only that `updateDoc` was called with `expect.anything()` as the first argument (the doc reference) and `expect.objectContaining({ status: 'em_revisao' })` as the second. The `doc` mock returns a deterministic string: `mock-ref:empresas/emp-test-1/orcamentos/orc-123`. This value is fully knowable and should be asserted to catch regressions where the path is built incorrectly (wrong collection name, wrong tenant ID, etc.):

```js
await waitFor(() => {
  expect(updateDoc).toHaveBeenCalledWith(
    'mock-ref:empresas/emp-test-1/orcamentos/orc-123',
    expect.objectContaining({ status: 'em_revisao' })
  )
})
```

The same issue applies to ORC-06 (line 267).

---

### WR-04: ORC-03 test does not assert the `sucesso` screen is shown after `updateDoc` resolves — the test passes even if the component crashes silently after saving

**File:** `mp-react/src/__tests__/orcamentoFluxo.test.jsx:166-199`

**Issue:** ORC-03 verifies only that `updateDoc` was called. It does not confirm that the component reached the `sucesso=true` state and rendered the success screen (`"Orçamento Enviado!"`). If `updateDoc` resolves but a subsequent line in `handleSubmit` throws (e.g., due to a bad state update), the test still passes. Adding a post-save DOM assertion catches that entire code path:

```js
// After the waitFor for updateDoc:
await waitFor(() => {
  expect(screen.getByText('Orçamento Enviado!')).toBeInTheDocument()
})
```

---

### WR-05: ORC-03 validation path is brittle — the test types into `getByPlaceholderText(/Ex: Compressor/i)` which matches the placeholder of the FIRST item row, but `novoItem()` creates a new item on every render with a `Date.now()`-based id — if two items exist the selector is ambiguous

**File:** `mp-react/src/__tests__/orcamentoFluxo.test.jsx:181-186`

**Issue:** `screen.getByPlaceholderText(/Ex: Compressor/i)` will throw `TestingLibraryElementError: Found multiple elements with the placeholder text...` as soon as the component renders with more than one item row. `OrcamentoTecnicoPage` initialises `itens` with `[novoItem()]` (one row), so currently there is exactly one item. But if `snapTecnico` is ever updated to include pre-filled items (e.g., `itens: [{...}, {...}]`), the `getByPlaceholderText` call will fail with a multiple-element error rather than a meaningful test failure.

**Fix:** Use `getAllByPlaceholderText` and index, or query by a more stable selector (e.g., `within` the first row):
```js
const [inputDescricao] = screen.getAllByPlaceholderText(/Ex: Compressor/i)
```

---

### WR-06: `orcamentoFluxo.test.jsx` has no `afterEach` or `afterAll` to clean up `URL.createObjectURL` — jsdom does not implement it and the production code calls it in `handleFotoSelect`

**File:** `mp-react/src/__tests__/orcamentoFluxo.test.jsx` (entire file)

**Issue:** `OrcamentoTecnicoPage.jsx:163` calls `URL.createObjectURL(comprimido)` when photos are selected. jsdom does not implement `URL.createObjectURL`, so calling it throws `TypeError: URL.createObjectURL is not a function`. The test file does not stub it. This does not affect ORC-01 through ORC-06 because none of them trigger photo selection — but any future test that exercises `handleFotoSelect` will throw immediately. Establishing the stub in `setupTests.js` or at the top of this file prevents a confusing future failure:

```js
// In setupTests.js or at the top of orcamentoFluxo.test.jsx:
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()
```

---

## Info

### IN-01: `osFluxo.test.jsx` imports `db` but never uses it directly in test assertions

**File:** `mp-react/src/__tests__/osFluxo.test.jsx:28`

**Issue:** The named import `db` on line 28 is unused in test code. `db` is passed through the `OSExcluirStub` component at runtime (as an argument to the mocked `doc`), but the test assertions check the resolved string path — not `db` itself. The import does not cause a test failure, but it's dead weight that adds noise.

**Fix:** Remove `db` from the import:
```js
import { criarOS, atualizarOS, getOSdaEmpresa, deleteDoc, doc } from '../firebase'
```

---

### IN-02: `orcamentoFluxo.test.jsx` imports `MemoryRouter` and `Routes`/`Route` from `react-router-dom` at the top, but the `renderOrcamento` helper could be simplified

**File:** `mp-react/src/__tests__/orcamentoFluxo.test.jsx:5`

**Issue:** `MemoryRouter`, `Routes`, and `Route` are all three imported and used — this is fine. However, the import is listed after the `vi.mock` calls, which is intentional per Padrão C. Minor note only: `Routes` and `Route` are used exclusively inside `renderOrcamento`. If that helper is split per CR-02's fix, the import list becomes self-documenting. No action required beyond the CR-02 fix.

**Fix:** No standalone fix required; addressed by CR-02.

---

_Reviewed: 2026-05-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
