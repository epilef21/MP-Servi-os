# Phase 2: Camada Base — Research

**Researched:** 2026-05-05
**Domain:** Vitest unit testing — pure functions and Firestore data layer mocking
**Confidence:** HIGH

---

## Summary

Phase 2 tests two categories of code that have no React rendering dependencies:
(1) pure formatting/calculation functions currently embedded inside AdminPage.jsx, and
(2) async Firestore accessor functions exported from firebase.js.

The critical architectural discovery for this phase is that `fmtDate`, `fmtBRL`, `getLucro`,
`maskPhone`, and `maskCNPJ` are **not in a dedicated utils file** — they are module-level
functions inside `mp-react/src/pages/AdminPage.jsx` (3264 lines). They cannot be imported
directly for testing without rendering the entire component. The plan must decide: either
test them by extracting to a shared file, or test them as closures imported from AdminPage
only. The cleanest option aligned with REFACTOR-01 (out of scope for v1 but enabled by
tests) is to extract to `src/utils/formatters.js` as part of this phase.

The second category (`criarOS`, `atualizarOS`, `getOSdaEmpresa`, `getEmpresaBySlug`,
`cadastrarEmpresa`) is straightforward: these are exported async functions in firebase.js
that call Firestore APIs. Testing them requires `vi.mock('../firebase')` at the module level
and configuring the mock return values per test case.

A naming mismatch exists in REQUIREMENTS.md: DATA-06 says "`verificarLimite`" but that
function lives in `useEmpresa.js` (a React hook), not `firebase.js`. The closest firebase.js
function is `contarOSdoMes`, which is called by AdminPage to feed the count to
`verificarLimite`. Plan 02-02 must address this mismatch explicitly.

**Primary recommendation:** Extract the 5 utility functions to `src/utils/formatters.js`
(new file), test them there in Plan 02-01. Test firebase.js exported functions in Plan 02-02
using `vi.mock('../firebase')` with configured mock return values per test.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 2 |
|-----------|-------------------|
| Mock Firebase via `vi.mock('../firebase')` — NEVER mock `firebase/firestore` directly | All DATA tests must mock at the `../firebase` module boundary |
| `clearMocks: true` globally in vitest.config.js | Never use `resetMocks` or `restoreMocks`; mocks are auto-cleared between tests |
| `.env.test` with VITE_FIREBASE_* stubs is MANDATORY | Already in place — do not remove |
| AdminPage.jsx has 3264 lines — test isolated behaviors, never render the whole component | The utility functions in AdminPage cannot be tested by rendering AdminPage — extract them |
| Framework: Vitest 4.1.5 — not Jest | All syntax must be Vitest (`vi.mock`, `vi.fn`, `describe/it/expect`) |
| JavaScript only — no TypeScript | Test files are `.js` and `.jsx`, never `.ts`/`.tsx` |
| Files containing JSX must use `.jsx` extension | Pure function tests: `.test.js`; any file with JSX markup: `.test.jsx` |
| Coding style: 2-space indent, single quotes, no semicolons | Apply to all new test files |

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UTIL-01 | `fmtDate` formata Firestore Timestamp corretamente (toDate() + pt-BR) | Function found in AdminPage.jsx lines 46-63 — handles string DD/MM/YYYY, string YYYY-MM-DD, Firestore Timestamp (toDate()), and null/undefined |
| UTIL-02 | `fmtBRL` formata valores monetários no padrão brasileiro | Function found in AdminPage.jsx line 74-78 — uses parseFloat + toFixed(2) + replace('.', ',') |
| UTIL-03 | `getLucro` calcula margem de lucro corretamente | Function found in AdminPage.jsx lines 79-84 — formula: (mo_seguradora - valor_prestador) + valor_deslocamento; returns null when all fields are falsy |
| UTIL-04 | `maskPhone` e `maskCNPJ` mascaram entradas conforme esperado | Both found in AdminPage.jsx lines 85-97 — regex-based masking |
| DATA-01 | `criarOS` chama addDoc com os campos corretos e retorna o ID | `criarOS(empresaId, dados)` in firebase.js line 136 — calls addDoc(refChecklist(empresaId), {...dados, criado_em: serverTimestamp()}) |
| DATA-02 | `atualizarOS` chama updateDoc no documento certo com os campos | `atualizarOS(empresaId, osId, dados)` in firebase.js line 144 — calls updateDoc(doc(db, 'empresas', empresaId, 'checklist', osId), dados) |
| DATA-03 | `getOSdaEmpresa` consulta subcoleção por empresaId | `getOSdaEmpresa(empresaId)` in firebase.js line 129 — query(refChecklist(empresaId), orderBy('criado_em', 'desc')) then maps docs |
| DATA-04 | `getEmpresaBySlug` busca por slug e retorna null quando não existe | `getEmpresaBySlug(slug)` in firebase.js line 108 — query empresas where slug==slug and ativo==true limit 1; returns null if snap.empty |
| DATA-05 | `cadastrarEmpresa` cria documento e retorna os dados | `cadastrarEmpresa(empresaId, dadosEmpresa, dadosConfig)` in firebase.js line 163 — two setDoc calls: refEmpresa and refConfig |
| DATA-06 | `verificarLimite` retorna true/false por plano e contagem | MISMATCH: `verificarLimite` is in `useEmpresa.js` (a React hook), not firebase.js. firebase.js has `contarOSdoMes(empresaId)` which feeds the count. Plan 02-02 must resolve this. |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pure formatting (fmtDate, fmtBRL) | Utility layer (stateless functions) | — | No I/O, no React, no Firebase — pure input-to-output transformations |
| Calculation (getLucro) | Utility layer (stateless functions) | — | Arithmetic on plain object fields — no side effects |
| Input masking (maskPhone, maskCNPJ) | Utility layer (stateless functions) | — | String transformation for UI input fields — no React needed |
| Firestore read (getOSdaEmpresa, getEmpresaBySlug) | Data layer (firebase.js) | Firestore SDK | Async I/O functions — require mocking the Firestore SDK |
| Firestore write (criarOS, atualizarOS, cadastrarEmpresa) | Data layer (firebase.js) | Firestore SDK | Async I/O — return Firestore promises |
| Limit checking (verificarLimite) | Hook layer (useEmpresa.js) | Data layer (contarOSdoMes) | Business logic inside a React hook; receives pre-fetched count as argument |

---

## Standard Stack

### Core (already installed — Phase 1 complete)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^4.1.5 | Test runner + assertion library | Compatible with Vite 8; locked in CLAUDE.md |
| jsdom | ^25.0.0 | Browser environment simulation | Required for React Testing Library |
| @testing-library/react | ^16.3.2 | Component rendering helpers | Industry standard for React component tests |
| @testing-library/jest-dom | ^6.9.1 | DOM matchers (toBeInTheDocument, etc.) | Extends expect() with readable assertions |

### No new dependencies needed for Phase 2

Pure function tests require zero additional libraries. Firestore function tests use the
`vi.mock` mechanism already demonstrated in Phase 1 mockFirebase.js. No new `npm install`
needed.

[VERIFIED: mp-react/package.json and existing test-utils files confirmed via Read tool]

---

## Architecture Patterns

### System Architecture Diagram

```
Plan 02-01: Pure Function Tests
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [test file]
      │ imports
      ▼
  src/utils/formatters.js      ← NEW file (extracted from AdminPage.jsx)
  ┌─────────────────────────┐
  │ fmtDate(d)              │
  │ fmtBRL(v)               │
  │ getLucro(r)             │
  │ maskPhone(v)            │
  │ maskCNPJ(v)             │
  └─────────────────────────┘
      │ no Firebase, no React
      ▼
  [pure return values asserted with expect()]


Plan 02-02: Firestore Layer Tests
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [test file]
      │  vi.mock('../firebase')        ← intercepts at module boundary
      ▼
  mockFirebase.js createFirebaseMocks()
  ┌──────────────────────────────────────────────────────────────┐
  │ addDoc, updateDoc, getDocs, setDoc, query, where, ...        │
  │ refChecklist, refConfig, refEmpresa (all vi.fn())            │
  └──────────────────────────────────────────────────────────────┘
      │  mock configured per test (mockResolvedValueOnce, etc.)
      ▼
  firebase.js exported functions under test
  ┌────────────────────────────┐
  │ criarOS(empresaId, dados)  │──→ calls addDoc (mocked)
  │ atualizarOS(...)           │──→ calls updateDoc (mocked)
  │ getOSdaEmpresa(empresaId)  │──→ calls getDocs (mocked)
  │ getEmpresaBySlug(slug)     │──→ calls getDocs (mocked)
  │ cadastrarEmpresa(...)      │──→ calls setDoc x2 (mocked)
  │ contarOSdoMes(empresaId)   │──→ calls getCountFromServer (mocked)
  └────────────────────────────┘
      │ actual firebase.js logic executes; mocked Firestore I/O
      ▼
  [return values / call arguments asserted with expect()]
```

### Recommended Project Structure

```
mp-react/src/
├── utils/
│   ├── formatters.js        ← NEW: extracted from AdminPage.jsx
│   ├── pdfGenerator.js      (existing)
│   ├── orcamentoPdfGenerator.js (existing)
│   ├── relatorioMensalPdf.js (existing)
│   └── pngGenerator.js      (existing)
├── test-utils/              (existing, from Phase 1)
│   ├── setupTests.js
│   ├── mockFirebase.js
│   ├── renderWithProviders.jsx
│   └── smoke.test.jsx
└── __tests__/               ← NEW test directory for Phase 2
    ├── formatters.test.js   (Plan 02-01)
    └── firebase.test.js     (Plan 02-02)
```

Alternative: place test files adjacent to source (`utils/formatters.test.js`). Either works
with the current vitest.config.js which has no `include` restriction. The `__tests__/`
directory is slightly preferred to keep `src/` clean.

### Pattern 1: Testing Pure Functions (Plan 02-01)

**What:** Import the function directly, call it with controlled inputs, assert outputs.
**When to use:** Any function with no I/O, no module-level side effects, no React.

```js
// Source: Vitest docs — pure function testing
// File: src/__tests__/formatters.test.js
import { describe, it, expect } from 'vitest'
import { fmtDate, fmtBRL, getLucro, maskPhone, maskCNPJ } from '../utils/formatters'

describe('fmtDate', () => {
  it('formata Firestore Timestamp via toDate()', () => {
    const ts = { toDate: () => new Date(2024, 0, 15) } // January 15, 2024
    expect(fmtDate(ts)).toBe('15/01/2024')
  })

  it('converte string YYYY-MM-DD para DD/MM/YYYY', () => {
    expect(fmtDate('2024-03-07')).toBe('07/03/2024')
  })

  it('retorna string DD/MM/YYYY sem alteração', () => {
    expect(fmtDate('15/01/2024')).toBe('15/01/2024')
  })

  it('retorna "—" para null', () => {
    expect(fmtDate(null)).toBe('—')
  })

  it('retorna "—" para undefined', () => {
    expect(fmtDate(undefined)).toBe('—')
  })
})
```

### Pattern 2: Testing Firestore Functions (Plan 02-02)

**What:** Mock the entire `../firebase` module, then call the function under test and assert
which mock was called with which arguments.
**When to use:** Any function that imports from `../firebase` and calls Firestore APIs.

**Critical constraint:** The functions under test ARE exported from firebase.js and CALL
other things also exported from firebase.js (e.g., `criarOS` calls `addDoc` and
`refChecklist`, both of which are exported from firebase.js). This means `vi.mock('../firebase')`
must mock the module that the functions under test live in — which creates a problem:
you cannot re-import `criarOS` from a module that is itself mocked.

**Solution:** Import the functions under test BEFORE the mock takes effect, OR — the
standard Vitest pattern — restructure so the test mocks `firebase/firestore` (the SDK)
rather than `../firebase`. However, CLAUDE.md explicitly forbids mocking `firebase/firestore`
directly. This means the approach for DATA tests requires careful module isolation.

**The correct approach for this codebase:**

Since CLAUDE.md says "mock Firebase via `vi.mock('../firebase')`", the DATA tests cannot
test the firebase.js exported async functions by mocking the module they live in. Instead,
the DATA tests should test the behavior by calling the functions after mocking the
underlying Firestore SDK operations that firebase.js itself imports.

BUT — this contradicts the CLAUDE.md directive against mocking `firebase/firestore` directly.

**Resolution:** The CLAUDE.md directive applies to component tests (where AuthContext,
useEmpresa etc. call firebase functions). For testing the firebase.js DATA layer functions
themselves, the correct pattern is to mock `firebase/firestore` at the SDK level — this is
the ONLY way to test firebase.js internals without a real Firebase instance.

The CLAUDE.md directive "mock Firebase via `vi.mock('../firebase')`" is intended to prevent
components from reaching into Firestore internals, not to prevent testing firebase.js itself.
The planner should confirm this interpretation with the user, OR test at the behavior level
(call the function, assert the mock SDK was called) using the SDK-level mock for these
specific files only.

**Simplest safe approach — SDK-level mock in firebase.test.js only:**

```js
// Source: Vitest vi.mock pattern — [VERIFIED: vitest.config.js, CLAUDE.md analysis]
// File: src/__tests__/firebase.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Firestore SDK modules (allowed at the test level for firebase.js unit tests)
vi.mock('firebase/firestore', () => ({
  getFirestore:       vi.fn(() => ({})),
  collection:         vi.fn(),
  addDoc:             vi.fn(),
  updateDoc:          vi.fn(),
  getDocs:            vi.fn(),
  setDoc:             vi.fn(),
  doc:                vi.fn(),
  query:              vi.fn(),
  where:              vi.fn(),
  orderBy:            vi.fn(),
  limit:              vi.fn(),
  serverTimestamp:    vi.fn(() => 'SERVERTIMESTAMP'),
  getCountFromServer: vi.fn(),
}))
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  // ... other auth mocks
}))
vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})),
}))
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}))

import { addDoc, getDocs, updateDoc, setDoc, getCountFromServer } from 'firebase/firestore'
import { criarOS, atualizarOS, getOSdaEmpresa, getEmpresaBySlug, cadastrarEmpresa, contarOSdoMes } from '../firebase'

describe('criarOS', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    addDoc.mockResolvedValue({ id: 'new-os-id' })
  })

  it('chama addDoc com os campos corretos incluindo serverTimestamp', async () => {
    const dados = { seguradora: 'Mapfre', nome_segurado: 'João' }
    const result = await criarOS('emp-123', dados)
    expect(addDoc).toHaveBeenCalledOnce()
    const [, docArg] = addDoc.mock.calls[0]
    expect(docArg).toMatchObject({ seguradora: 'Mapfre', nome_segurado: 'João' })
    expect(docArg.criado_em).toBeDefined()
    expect(result.id).toBe('new-os-id')
  })
})
```

### Pattern 3: Handling getOSdaEmpresa (getDocs returning snapshot)

`getOSdaEmpresa` maps over `snap.docs` to produce plain objects. The mock must return a
Firestore-shaped QuerySnapshot:

```js
// [VERIFIED: firebase.js line 132 — snap.docs.map(d => ({ id: d.id, ...d.data() }))]
getDocs.mockResolvedValue({
  docs: [
    { id: 'os-1', data: () => ({ seguradora: 'Mapfre', status: 'pendente' }) },
    { id: 'os-2', data: () => ({ seguradora: 'Tempo',  status: 'processado' }) },
  ]
})
const result = await getOSdaEmpresa('emp-123')
expect(result).toHaveLength(2)
expect(result[0]).toEqual({ id: 'os-1', seguradora: 'Mapfre', status: 'pendente' })
```

For the "empty" case:
```js
getDocs.mockResolvedValue({ docs: [] })
const result = await getOSdaEmpresa('emp-123')
expect(result).toHaveLength(0)
```

### Pattern 4: Handling getEmpresaBySlug (snap.empty path)

`getEmpresaBySlug` checks `snap.empty` and returns null if true:

```js
// [VERIFIED: firebase.js lines 115-119]
// Case: slug found
getDocs.mockResolvedValue({
  empty: false,
  docs: [{ id: 'emp-123', data: () => ({ nome: 'Empresa Teste', slug: 'teste', ativo: true }) }]
})
const result = await getEmpresaBySlug('teste')
expect(result).toEqual({ id: 'emp-123', nome: 'Empresa Teste', slug: 'teste', ativo: true })

// Case: slug not found
getDocs.mockResolvedValue({ empty: true, docs: [] })
const notFound = await getEmpresaBySlug('nao-existe')
expect(notFound).toBeNull()
```

### Pattern 5: Handling cadastrarEmpresa (two setDoc calls)

`cadastrarEmpresa` calls setDoc twice — once for the empresa document and once for the
config document:

```js
// [VERIFIED: firebase.js lines 163-178]
setDoc.mockResolvedValue(undefined)
await cadastrarEmpresa(
  'emp-123',
  { nome: 'Empresa Teste', plano: 'basico' },
  { telefone: '(11) 9999-9999', seguradoras: ['Mapfre'] }
)
expect(setDoc).toHaveBeenCalledTimes(2)
// First call — empresa document
const [, empresaDoc] = setDoc.mock.calls[0]
expect(empresaDoc).toMatchObject({ nome: 'Empresa Teste', ativo: true })
// Second call — config document
const [, configDoc] = setDoc.mock.calls[1]
expect(configDoc).toMatchObject({ nome: 'Empresa Teste', telefone: '(11) 9999-9999' })
```

### Pattern 6: Handling contarOSdoMes (getCountFromServer)

`contarOSdoMes` calls `getCountFromServer` and reads `.data().count`:

```js
// [VERIFIED: firebase.js lines 149-160]
getCountFromServer.mockResolvedValue({ data: () => ({ count: 37 }) })
const count = await contarOSdoMes('emp-123')
expect(count).toBe(37)
```

### Anti-Patterns to Avoid

- **Rendering AdminPage to access utility functions:** AdminPage is 3264 lines and has many
  Firebase imports. Rendering it in a test would trigger dozens of hooks and effects.
  Always extract and import functions directly.
- **Static mock objects (not calling beforeEach):** clearMocks: true resets call counts but
  does NOT reset `mockResolvedValue`. Always re-configure return values in `beforeEach`.
- **Forgetting the snapshot shape:** `getDocs` returns an object with `.docs` (array) and
  `.empty` (boolean). `getDoc` returns an object with `.exists()` (function) and `.data()`
  (function). Mock the correct shape or assertions will fail silently.
- **Mocking `contarOSdoMes` return incorrectly:** It calls `snap.data().count` — mock as
  `{ data: () => ({ count: N }) }`, not `{ count: N }`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Firestore SDK simulation | Custom Firestore mock object | `vi.mock('firebase/firestore')` with vi.fn() | Custom mocks drift from real API shapes and miss edge cases |
| QuerySnapshot shape | Custom snap object with arbitrary fields | `{ docs: [{ id, data: () => ({}) }], empty: false }` | Matches the exact API firebase.js uses (snap.docs, snap.empty, d.id, d.data()) |
| date assertions | String comparison of formatted dates | Pass a controlled `new Date(year, month, day)` to the Timestamp mock | Avoids locale differences between CI and local environments |

**Key insight:** The Firestore SDK API surface used by firebase.js is small and well-defined.
Mock only what firebase.js actually calls — do not build a general Firestore simulator.

---

## Critical Discovery: verificarLimite is NOT in firebase.js

**DATA-06 requirement says:** "`verificarLimite` retorna true/false corretamente baseado no plano e contagem de OS do mês"

**Reality found in codebase:**

- `verificarLimite` is defined in `mp-react/src/hooks/useEmpresa.js` (lines 76-90)
- It is a plain function RETURNED by the `useEmpresa` hook (not a Firebase function)
- It receives `totalOSdoMes` (a count integer) as an argument and uses `plano.limiteOS`
  from the hook's local state
- It returns an object `{ bloqueado, aviso, restantes, limite, total }` — not a boolean

The function that IS in firebase.js is `contarOSdoMes(empresaId)` — which fetches the
count. `verificarLimite` is pure business logic that uses the count + plan data.

**Options for Plan 02-02:**

1. **Test `contarOSdoMes` instead** — the actual firebase.js function. Clean, within scope.
2. **Also test `verificarLimite` as a pure function** — it takes a plain integer and a plan
   config, making it trivially testable. But it requires rendering (or calling) `useEmpresa`
   which brings in React hook machinery.

**Recommendation:** Plan 02-02 covers `contarOSdoMes` (the firebase.js function that
feeds the limit check). `verificarLimite` logic testing belongs in Phase 3 (Auth/hooks) as
part of the useEmpresa tests. The requirement description should be updated or clarified.

**Exact signature of `verificarLimite`:**
```js
// [VERIFIED: useEmpresa.js lines 76-90]
function verificarLimite(totalOSdoMes) {
  // returns { bloqueado: bool, aviso: bool, restantes: int, limite: int, total: int }
  // OR { bloqueado: false, aviso: false } when plano is null or limiteOS === -1
}
```

---

## Exact Function Signatures (verified from source)

### Utility Functions (AdminPage.jsx lines 46-97)
[VERIFIED: Read tool, AdminPage.jsx lines 46-97]

```js
// fmtDate — handles: null/undefined → '—', string DD/MM/YYYY → passthrough,
//           string YYYY-MM-DD → converts, object with .toDate() → formats
function fmtDate(d) {
  if (!d) return '—'
  if (typeof d === 'string') {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return d           // DD/MM/YYYY passthrough
    if (d.includes('-')) {
      const [y, m, day] = d.split('-')
      return `${day}/${m}/${y}`                              // YYYY-MM-DD conversion
    }
  }
  if (d?.toDate) {
    const dt = d.toDate()
    return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`
  }
  return '—'
}

// fmtBRL — parseFloat → toFixed(2) → replace('.', ',')
// Returns '—' for NaN input
function fmtBRL(v) {
  const n = parseFloat(v)
  if (isNaN(n)) return '—'
  return `R$ ${n.toFixed(2).replace('.', ',')}`
}

// getLucro — (mo_seguradora - valor_prestador) + valor_deslocamento
// Returns null when all three fields are 0/falsy
function getLucro(r) {
  const mos = parseFloat(r.mo_seguradora)      || 0
  const vpt = parseFloat(r.valor_prestador)    || 0
  const vds = parseFloat(r.valor_deslocamento) || 0
  return (mos || vpt || vds) ? (mos - vpt) + vds : null
}

// maskPhone — max 11 digits; 10 digits = (XX) XXXX-XXXX, 11 = (XX) XXXXX-XXXX
function maskPhone(v) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
}

// maskCNPJ — XX.XXX.XXX/XXXX-XX format
function maskCNPJ(v) {
  const d = v.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}
```

### Firebase.js Data Functions
[VERIFIED: Read tool, firebase.js full file]

```js
// criarOS(empresaId, dados) → Promise<DocumentReference>
// Internally calls: addDoc(refChecklist(empresaId), { ...dados, criado_em: serverTimestamp() })
// refChecklist(empresaId) = collection(db, 'empresas', empresaId, 'checklist')

// atualizarOS(empresaId, osId, dados) → Promise<void>
// Internally calls: updateDoc(doc(db, 'empresas', empresaId, 'checklist', osId), dados)

// getOSdaEmpresa(empresaId) → Promise<Array<{id, ...data}>>
// Internally: query(refChecklist(empresaId), orderBy('criado_em', 'desc')) → getDocs → map

// getEmpresaBySlug(slug) → Promise<{id, ...data} | null>
// Internally: query(collection(db,'empresas'), where('slug','==',slug), where('ativo','==',true), limit(1))
// → getDocs → if snap.empty return null, else { id: snap.docs[0].id, ...snap.docs[0].data() }

// cadastrarEmpresa(empresaId, dadosEmpresa, dadosConfig) → Promise<void>
// Calls: setDoc(refEmpresa(empresaId), { ...dadosEmpresa, ativo: true, criadoEm: serverTimestamp() })
// Then:  setDoc(refConfig(empresaId), { nome, telefone, seguradoras, logoUrl, corPrimaria })
// refEmpresa(empresaId) = doc(db, 'empresas', empresaId)
// refConfig(empresaId)  = doc(db, 'empresas', empresaId, 'config', 'geral')

// contarOSdoMes(empresaId) → Promise<number>
// Calls: getCountFromServer(query(refChecklist(empresaId), where('criado_em', '>=', inicio)))
// Returns: snap.data().count (integer)
```

---

## Common Pitfalls

### Pitfall 1: Utility Functions are Not Exported from AdminPage

**What goes wrong:** Test tries `import { fmtDate } from '../pages/AdminPage'` and gets
undefined or a module evaluation error (AdminPage imports recharts, firebase, and runs
complex hook initializations at module load time).
**Why it happens:** The functions are defined as regular (non-exported) module-level
functions inside a 3264-line component file.
**How to avoid:** Extract to `src/utils/formatters.js` with named exports. AdminPage
imports from there instead. This is a clean prerequisite for Plan 02-01.
**Warning signs:** If AdminPage.jsx is imported in a test and throws errors about missing
Firebase state or recharts, this is the root cause.

### Pitfall 2: Mock Return Value Not Configured (clearMocks vs resetMocks)

**What goes wrong:** `addDoc` returns `undefined` instead of `{ id: 'new-id' }` in the
second test. Or `getDocs` resolves to `undefined` causing `snap.docs.map is not a function`.
**Why it happens:** `clearMocks: true` resets call history but does NOT reset
`mockResolvedValue`. However, if you forget to set the mock return value in `beforeEach`
and rely on a previous test's mock setup, the next test may get the correct return or not
depending on test order.
**How to avoid:** Configure all mock return values in `beforeEach` (or inside each `it`
block). Never rely on mock state from a previous test.
**Warning signs:** Tests pass individually but fail when run as a suite.

### Pitfall 3: Wrong QuerySnapshot Shape

**What goes wrong:** `snap.docs.map is not a function` or `snap.empty is not defined`.
**Why it happens:** Mock returns `[]` directly instead of `{ docs: [], empty: true }`.
**How to avoid:** Always mock getDocs with the full QuerySnapshot shape:
`{ docs: [...], empty: false }`. For getDoc: `{ exists: () => true, data: () => ({}) }`.
**Warning signs:** TypeError mentioning `.map`, `.docs`, or `.empty` in test output.

### Pitfall 4: getCountFromServer mock shape

**What goes wrong:** `snap.data is not a function` when testing `contarOSdoMes`.
**Why it happens:** Mock returns `{ count: 5 }` instead of `{ data: () => ({ count: 5 }) }`.
**How to avoid:** Mock as `getCountFromServer.mockResolvedValue({ data: () => ({ count: 5 }) })`.
**Warning signs:** TypeError on `snap.data()` inside `contarOSdoMes`.

### Pitfall 5: fmtDate month indexing

**What goes wrong:** Test asserts '15/01/2024' but gets '15/00/2024' or '15/02/2024'.
**Why it happens:** `new Date(2024, 0, 15)` is January (month 0 = January). fmtDate uses
`getMonth() + 1` which is correct. But `new Date('2024-01-15')` parsed as UTC may give the
wrong date in some timezones.
**How to avoid:** Use `new Date(year, month, day)` (local timezone) for the `.toDate()`
mock, not `new Date('YYYY-MM-DD')` (UTC-parsed string).
**Warning signs:** Date assertions off by one month in CI environments with UTC timezone.

### Pitfall 6: getLucro null vs 0 confusion

**What goes wrong:** Test expects `null` when all fields are zero but gets `0`.
**Why it happens:** `(0 || 0 || 0)` is falsy in JS but the expression `(mos - vpt) + vds`
evaluates to `0`, not `null`. The guard is `(mos || vpt || vds) ? ... : null`.
**How to avoid:** Test the null case explicitly with `{ mo_seguradora: undefined, valor_prestador: undefined, valor_deslocamento: undefined }` and the zero case is `{ mo_seguradora: '0', valor_prestador: '0', valor_deslocamento: '0' }` — both should return `null`.
**Warning signs:** getLucro test for "all zero" returns 0 instead of null.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Plan 02-02 should test `contarOSdoMes` in place of `verificarLimite` for DATA-06 | Critical Discovery section | If user wants `verificarLimite` tested in Phase 2, it requires hook testing machinery (not available until Phase 3 patterns are established) |
| A2 | Extracting utility functions to `src/utils/formatters.js` is acceptable (pre-REFACTOR-01) | Architecture Patterns | If user wants functions to remain in AdminPage only, tests cannot import them without rendering AdminPage |
| A3 | Firebase/firestore SDK-level mocking is permitted inside `src/__tests__/firebase.test.js` even though CLAUDE.md says "mock via `vi.mock('../firebase')`" for component tests | Pattern 2 | If CLAUDE.md directive applies to ALL test files (not just component tests), the DATA tests cannot be written without a different strategy |

---

## Open Questions

1. **DATA-06 / verificarLimite scope**
   - What we know: `verificarLimite` is inside `useEmpresa.js` (a React hook), not firebase.js. `contarOSdoMes` is the firebase.js function that feeds it.
   - What's unclear: Does Plan 02-02 cover `contarOSdoMes` (firebase.js) and defer `verificarLimite` to Phase 3, or should `verificarLimite` be extracted and tested as a pure function here?
   - Recommendation: Test `contarOSdoMes` in Plan 02-02. Extract `verificarLimite` to a standalone pure function in `src/utils/limiteUtils.js` so it can be tested without hook machinery. Note this in Plan 02-02 as the resolution for DATA-06.

2. **CLAUDE.md mock boundary for firebase.js unit tests**
   - What we know: CLAUDE.md says "mock via `vi.mock('../firebase')`" — intended for component tests so they don't reach Firestore internals.
   - What's unclear: Does this rule apply to the firebase.js unit tests themselves? Testing firebase.js functions requires mocking the Firestore SDK (what firebase.js calls internally).
   - Recommendation: SDK-level mocking in `firebase.test.js` is the only viable approach. The CLAUDE.md directive is understood as applying to component/hook tests only. Document this explicitly in the plan.

---

## Environment Availability

Step 2.6: No new external dependencies required. All tools available from Phase 1.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| vitest | Test runner | Yes | 4.1.5 | — |
| @testing-library/react | renderWithProviders | Yes | ^16.3.2 | — |
| @testing-library/jest-dom | DOM matchers | Yes | ^6.9.1 | — |
| node.js | Test execution | Yes | per environment | — |

[VERIFIED: mp-react/src/test-utils/ files exist and smoke.test.jsx passes per Phase 1 completion]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `mp-react/vitest.config.js` (exists) |
| Quick run command | `cd mp-react && npm test` |
| Full suite command | `cd mp-react && npm test` (all files) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UTIL-01 | fmtDate handles Timestamp, strings, null | unit | `npm test -- formatters` | No — Wave 0 |
| UTIL-02 | fmtBRL formats numbers in pt-BR | unit | `npm test -- formatters` | No — Wave 0 |
| UTIL-03 | getLucro computes margin correctly | unit | `npm test -- formatters` | No — Wave 0 |
| UTIL-04 | maskPhone and maskCNPJ mask inputs | unit | `npm test -- formatters` | No — Wave 0 |
| DATA-01 | criarOS calls addDoc with correct args | unit | `npm test -- firebase` | No — Wave 0 |
| DATA-02 | atualizarOS calls updateDoc on correct doc | unit | `npm test -- firebase` | No — Wave 0 |
| DATA-03 | getOSdaEmpresa queries subcollection | unit | `npm test -- firebase` | No — Wave 0 |
| DATA-04 | getEmpresaBySlug handles found and not-found | unit | `npm test -- firebase` | No — Wave 0 |
| DATA-05 | cadastrarEmpresa calls setDoc twice | unit | `npm test -- firebase` | No — Wave 0 |
| DATA-06 | contarOSdoMes (or verificarLimite) | unit | `npm test -- firebase` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `cd mp-react && npm test`
- **Per wave merge:** `cd mp-react && npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `mp-react/src/utils/formatters.js` — extracted utility functions (prerequisite for UTIL-01..04)
- [ ] `mp-react/src/__tests__/formatters.test.js` — covers UTIL-01, UTIL-02, UTIL-03, UTIL-04
- [ ] `mp-react/src/__tests__/firebase.test.js` — covers DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06

---

## Security Domain

No new security surface is introduced in Phase 2. This phase adds test files and a utility
extraction. No auth, no network calls in production code, no new dependencies.

ASVS categories do not apply to test infrastructure additions.

---

## Sources

### Primary (HIGH confidence)

- `mp-react/src/firebase.js` — Read directly; all function signatures and Firestore call patterns verified
- `mp-react/src/pages/AdminPage.jsx` lines 46-97 — Read directly; all utility function implementations verified
- `mp-react/src/hooks/useEmpresa.js` — Read directly; verificarLimite implementation and module location verified
- `mp-react/src/test-utils/mockFirebase.js` — Read directly; createFirebaseMocks() factory verified
- `mp-react/src/test-utils/renderWithProviders.jsx` — Read directly; FakeAuthProvider pattern verified
- `mp-react/vitest.config.js` — Read directly; clearMocks: true, jsdom, globals confirmed
- `mp-react/.env.test` — Read directly; all 7 VITE_FIREBASE_* stubs confirmed present
- `.planning/phases/01-infraestrutura-de-testes/01-CONTEXT.md` — Read directly; all Phase 1 decisions confirmed
- `CLAUDE.md` — Read via system context; all directives applied

### Secondary (MEDIUM confidence)

- Vitest documentation patterns for vi.mock and vi.fn — [ASSUMED] based on training knowledge; consistent with mockFirebase.js patterns already in codebase

---

## Metadata

**Confidence breakdown:**
- Utility function signatures: HIGH — read directly from AdminPage.jsx
- Utility function location problem: HIGH — confirmed not exported, confirmed in AdminPage only
- Firebase.js function signatures: HIGH — read directly from firebase.js
- verificarLimite location: HIGH — found in useEmpresa.js, confirmed NOT in firebase.js
- Mock patterns: HIGH — createFirebaseMocks() already established in Phase 1 codebase
- SDK-level mock strategy: MEDIUM — correct Vitest approach but CLAUDE.md interpretation requires confirmation

**Research date:** 2026-05-05
**Valid until:** 2026-06-05 (stable codebase — utility functions rarely change)
