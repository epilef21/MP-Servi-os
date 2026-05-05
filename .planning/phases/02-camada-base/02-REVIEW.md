---
phase: 02-camada-base
reviewed: 2026-05-05T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - mp-react/src/utils/formatters.js
  - mp-react/src/__tests__/formatters.test.js
  - mp-react/src/pages/AdminPage.jsx
  - mp-react/src/__tests__/firebase.test.js
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-05
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

This phase extracted five pure utility functions from `AdminPage.jsx` into `formatters.js` and added 47 Vitest tests (30 for formatters, 17 for firebase.js). The extraction itself is clean — AdminPage.jsx imports correctly and no duplicate local definitions remain. The test structure is sound and the documented exception for `vi.mock('firebase/firestore')` in `firebase.test.js` is properly justified.

Three critical issues were found: live Firebase credentials committed to the repository, a hardcoded superadmin email in a public source file (also leaked into `.env`), and a crash-inducing null-dereference in `maskPhone`/`maskCNPJ` when called with a non-string value. Four warnings cover logic defects in `getLucro` and `fmtDate`, a missing error-propagation test, and a gap in the `contarOSdoMes` date logic.

---

## Critical Issues

### CR-01: Live Firebase API key and admin password committed to git

**File:** `mp-react/.env:7-15`
**Issue:** `mp-react/.env` is tracked by git (`git ls-files` confirms it). It contains the real Firebase API key (`AIzaSyA3v…`), auth domain, project ID, storage bucket, sender ID, app ID, and `VITE_ADMIN_PASSWORD=mp@admin2024`. The root `.gitignore` lists `.env` but `mp-react/.gitignore` only lists `.vercel` — so the subdirectory `.gitignore` overrides and the file is tracked. Anyone with read access to the repo (or the commit history) has production credentials.

**Fix:**
1. Remove `mp-react/.env` from git tracking immediately: `git rm --cached mp-react/mp-react/.env` — adjust path as needed.
2. Add `.env` to `mp-react/.gitignore`:
   ```
   .env
   .env.local
   ```
3. Rotate the Firebase API key and the admin password through the Firebase Console and update the Vercel environment variables.
4. The commit history retains the secrets; consider a history rewrite (`git filter-repo`) if this repo is or will become public.

---

### CR-02: Superadmin email hardcoded as fallback in public source file

**File:** `mp-react/src/firebase.js:85`
**Issue:**
```js
export const SUPERADMIN_EMAIL = import.meta.env.VITE_SUPERADMIN_EMAIL || 'tvf23407@gmail.com'
```
The real superadmin email is embedded as a string literal in the source file, which is bundled into the client-side JavaScript. Any user who opens DevTools or views the production bundle can read it. An attacker learns which account to target for credential stuffing or social engineering, and this account controls the entire `/superadmin` panel.

**Fix:** Remove the hardcoded fallback. If the env var is missing the app should fail loudly at startup, not silently fall back to a real address:
```js
const superadminEmail = import.meta.env.VITE_SUPERADMIN_EMAIL
if (!superadminEmail) {
  throw new Error('VITE_SUPERADMIN_EMAIL is required')
}
export const SUPERADMIN_EMAIL = superadminEmail
```

---

### CR-03: `maskPhone` and `maskCNPJ` crash when called with a non-string value

**File:** `mp-react/src/utils/formatters.js:34,40`
**Issue:** Both functions call `.replace(/\D/g, '')` directly on the parameter without a null/type check:
```js
export function maskPhone(v) {
  const d = v.replace(/\D/g, '').slice(0, 11)   // TypeError if v is null/undefined/number
```
```js
export function maskCNPJ(v) {
  const d = v.replace(/\D/g, '').slice(0, 14)   // same
```
In `AdminPage.jsx` these are wired to `onChange` handlers where the value comes from `e.target.value` (always a string), so the crash is unlikely in normal UI flow. However, they are also called on state values that could be `undefined` on first render if the state shape is incomplete (e.g., when editing a record loaded from Firestore that lacks the field). `fmtDate` and `fmtBRL` both guard against falsy input; `maskPhone`/`maskCNPJ` do not.

**Fix:**
```js
export function maskPhone(v) {
  if (v == null) return ''
  const d = String(v).replace(/\D/g, '').slice(0, 11)
  // ... rest unchanged
}

export function maskCNPJ(v) {
  if (v == null) return ''
  const d = String(v).replace(/\D/g, '').slice(0, 14)
  // ... rest unchanged
}
```
Add matching tests for `maskPhone(null)` and `maskCNPJ(undefined)`.

---

## Warnings

### WR-01: `getLucro` logic is wrong when only `valor_deslocamento` is non-zero

**File:** `mp-react/src/utils/formatters.js:26-31`
**Issue:** The formula is `(mos - vpt) + vds` but the truthiness guard `(mos || vpt || vds)` evaluates to true even when only `vds` is non-zero. In that case the result is `(0 - 0) + vds = vds`. This can inflate profit figures: a delivery charge with no labour is reported as pure profit without any MO component. Whether this matches business intent is unclear, but it is inconsistent — if `mo_seguradora` is the revenue source, pure `valor_deslocamento` with no MO should arguably not produce a profit reading.

More concretely, the guard also allows a case where only `valor_prestador` is set (`vpt > 0`, `mos = 0`, `vds = 0`), which returns `-vpt` (a loss). The test suite at line 92 confirms negative profit is intentional, but there is no test for the `vds`-only scenario.

**Fix:** Add a test to document the intended behaviour and fix the formula or guard if the `vds`-only case should return `null`:
```js
// If only displacement is set with no MO revenue, treat as indeterminate:
return (mos || vpt) ? (mos - vpt) + vds : null
```
If the current behaviour is intentional, add a test that pins it so it does not regress silently.

---

### WR-02: `fmtDate` silently corrupts ISO-8601 strings that contain a hyphen but are not dates

**File:** `mp-react/src/utils/formatters.js:8-11`
**Issue:** The branch `if (d.includes('-'))` matches any string containing a hyphen — it is not limited to valid `YYYY-MM-DD` format. A string like `'N/A-ref'` or `'Mapfre-123'` passes through `d.split('-')` and produces `[y='N/A', m='ref', day='123']`, returning `'123/ref/N/A'` instead of `'—'`. The test at line 38 checks a string with no separators at all (`'naodata'`), but never tests a hyphenated non-date string.

**Fix:** Replace the loose `includes('-')` guard with a stricter regex before splitting:
```js
if (/^\d{4}-\d{2}-\d{2}/.test(d)) {
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}
```
Add a test: `expect(fmtDate('Mapfre-123')).toBe('—')`.

---

### WR-03: `contarOSdoMes` uses a plain `Date` object where Firestore expects a `Timestamp` — query silently returns wrong results in production

**File:** `mp-react/src/firebase.js:150-158`
**Issue:**
```js
const inicio = new Date()
inicio.setDate(1)
inicio.setHours(0, 0, 0, 0)
const q = query(refChecklist(empresaId), where('criado_em', '>=', inicio))
```
Firestore's `where` clause comparing a `Timestamp` field against a plain JS `Date` object is a type mismatch. The Firestore SDK may coerce it, but the behaviour is not guaranteed across SDK versions and is officially documented as requiring `Timestamp` objects for comparisons against `Timestamp` fields. In practice this query has returned incorrect counts in some Firebase SDK versions.

The test in `firebase.test.js` mocks `getCountFromServer` at the return-value level (line 201-202), so it cannot detect this query construction bug — the mock is valid but does not exercise the `where` call arguments.

**Fix:**
```js
import { Timestamp } from 'firebase/firestore'

const inicio = new Date()
inicio.setDate(1)
inicio.setHours(0, 0, 0, 0)
const inicioTs = Timestamp.fromDate(inicio)
const q = query(refChecklist(empresaId), where('criado_em', '>=', inicioTs))
```

---

### WR-04: `firebase.test.js` has no error-path tests — all 17 tests cover only the happy path

**File:** `mp-react/src/__tests__/firebase.test.js`
**Issue:** Every test resolves successfully. None of the six functions is tested when the underlying Firestore call rejects (network error, permission denied, etc.). For example, if `addDoc` rejects in `criarOS`, the promise rejection propagates to the caller with no wrapping — callers in `AdminPage.jsx` need to catch it. Without a test for the rejection path there is no guarantee the rejection is not swallowed somewhere in the call chain now or in a future refactor.

This is particularly important for `criarOS` and `atualizarOS` which are called with user data and where a silent failure would cause data loss from the user's perspective.

**Fix:** Add at least one rejection test per write function:
```js
it('rejeita quando addDoc falha', async () => {
  addDoc.mockRejectedValue(new Error('permission-denied'))
  await expect(criarOS('emp-123', { seguradora: 'Mapfre' })).rejects.toThrow('permission-denied')
})
```

---

## Info

### IN-01: `fmtBRL` does not handle thousands separator — large values are ambiguous

**File:** `mp-react/src/utils/formatters.js:20-24`
**Issue:** `fmtBRL(1234.56)` returns `'R$ 1234,56'` (test line 70 confirms this as the expected output). In pt-BR convention the expected format for amounts over 999 is `R$ 1.234,56`. The function is used throughout `AdminPage.jsx` including on dashboard metric cards and report tables. For a business handling insurance claims this could cause readability errors with large values.

**Fix (optional):** Use `Intl.NumberFormat`:
```js
export function fmtBRL(v) {
  const n = parseFloat(v)
  if (isNaN(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
```
Update the test at line 70 to expect `'R$ 1.234,56'` (note: `Intl` uses a non-breaking space before `R$`). Treat as a scope decision — if the current format is intentional, pin it with a comment.

---

### IN-02: `maskPhone` test at line 119-122 asserts an implementation detail that will break on partial input

**File:** `mp-react/src/__tests__/formatters.test.js:119-122`
**Issue:**
```js
it('retorna digitos sem mascara para entrada parcial menor que 6 digitos', () => {
  const result = maskPhone('11')
  expect(result).toBe('11')
})
```
The current implementation returns `'11'` for `'11'` because the regex `(\d{2})(\d{4})(\d{0,4})` requires at least 2+4=6 digits to produce groups 1 and 2 — with only 2 digits the match still works but group 2 is empty, yielding `'(11) -'` → after `.replace(/-$/, '')` → `'(11) '`. Actually tracing the regex: `'11'.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')` — with only 2 digits `\d{4}` fails to match, so no replacement occurs and `'11'` is returned as-is. This is correct, but the comment "menor que 6 digitos" is misleading: the boundary is actually 6 digits (2+4), and input `'1198'` (4 digits, >2) also returns as-is. There is no test for `'119'`, `'1198'`, `'11987'` (3, 4, 5 digit partial inputs). If the regex is ever tightened, those cases will silently break.

**Fix:** Add tests for 3, 4, and 5-digit partial inputs to cover the full partial-mask range, or update the test description to accurately describe the boundary condition.

---

_Reviewed: 2026-05-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
