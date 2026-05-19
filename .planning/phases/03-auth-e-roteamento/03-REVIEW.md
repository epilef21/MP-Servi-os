---
phase: 03-auth-e-roteamento
padded_phase: "03"
status: clean
depth: standard
files_reviewed: 5
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
reviewed_at: 2026-05-19
---

# Code Review — Phase 03: Auth e Roteamento

**Status: clean** — 0 critical, 0 warning, 2 info

Files reviewed:
- `mp-react/src/__tests__/authContext.test.jsx`
- `mp-react/src/__tests__/rotasEmpresa.test.jsx`
- `mp-react/src/hooks/useEmpresa.js`
- `mp-react/src/App.jsx`
- `mp-react/src/test-utils/mockFirebase.js`

---

## Findings

### INFO-01 — `_clearCacheForTest` exported from production module

**File:** `mp-react/src/hooks/useEmpresa.js:107`

**Description:** A test helper function is exported from a production module. The `_` prefix convention signals test-only intent, but the function is bundled into the production build.

**Risk:** Negligible — the function only deletes keys from a module-scoped object. No security or runtime impact. The decision was explicitly planned (documented in SUMMARY and CLAUDE.md patterns).

**Recommendation:** Acceptable as-is. If the production bundle size becomes a concern later, consider tree-shaking via `if (process.env.NODE_ENV === 'test')` guard or moving to a separate test-utils file. Do not change for this phase.

---

### INFO-02 — `signOut` vi.fn() has no default resolved value in mockFirebase.js

**File:** `mp-react/src/test-utils/mockFirebase.js:21`

**Description:** `signOut: vi.fn()` returns `undefined` by default (not a resolved promise). `logout()` in AuthContext calls `await signOut(auth)` — awaiting `undefined` is valid JavaScript (resolves immediately) but could mask missing mock setup in future tests.

**Risk:** Low — works correctly because awaiting undefined resolves without error. Tests that need specific signOut behavior override it with `mockImplementation`.

**Recommendation:** Add `.mockResolvedValue(undefined)` for consistency with other async mocks, and to make intent explicit. Non-blocking for this phase.

---

## Summary

The phase 3 changes are clean. Test files follow the established Padrão C (vi.mock with inline object literal), guards are correctly defined, and the useEmpresa cache mechanism is properly isolated with `_clearCacheForTest`. The RotaAdmin security fix (adding `!empresaId` check) is correct and tested.

No changes required before proceeding to verification.
