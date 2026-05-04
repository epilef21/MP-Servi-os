---
plan: 01-02
phase: 01-infraestrutura-de-testes
status: complete
wave: 2
subsystem: test-infrastructure
tags: [vitest, testing-library, mocks, providers]
dependency_graph:
  requires: [01-01]
  provides: [test-utils/setupTests, test-utils/mockFirebase, test-utils/renderWithProviders]
  affects: [all test files in Phase 2+]
tech_stack:
  added: []
  patterns: [FakeAuthProvider, createFirebaseMocks factory, renderWithProviders wrapper]
key_files:
  created:
    - mp-react/src/test-utils/setupTests.js
    - mp-react/src/test-utils/mockFirebase.js
    - mp-react/src/test-utils/renderWithProviders.jsx
    - mp-react/src/test-utils/smoke.test.jsx
  modified:
    - mp-react/src/contexts/AuthContext.jsx
decisions:
  - Exported AuthContext const from AuthContext.jsx to allow FakeAuthProvider direct context injection without using AuthProvider (which would trigger Firebase onAuthStateChanged)
  - Renamed smoke.test.js to smoke.test.jsx — Vite 8 / OXC parser requires .jsx extension for JSX syntax, .js files are not transpiled as JSX
metrics:
  duration: ~8 minutes
  completed: 2026-05-03
  tasks_completed: 2
  files_created: 4
  files_modified: 1
---

# Phase 01 Plan 02: Test utils helpers and smoke test Summary

## One-liner

Shared test helpers: jest-dom/vitest matchers setup, createFirebaseMocks() factory with sync onAuthStateChanged, and renderWithProviders with FakeAuthProvider injecting AuthContext directly.

## What was done

- Created `mp-react/src/test-utils/setupTests.js` — imports `@testing-library/jest-dom/vitest` matchers and registers `afterEach(cleanup)` to prevent state leaks
- Created `mp-react/src/test-utils/mockFirebase.js` — exports `createFirebaseMocks()` factory returning fresh `vi.fn()` instances per call; `onAuthStateChanged` calls `cb(null)` synchronously and returns `() => {}` to prevent TypeError on unmount
- Created `mp-react/src/test-utils/renderWithProviders.jsx` — wraps UI with `MemoryRouter` + `FakeAuthProvider`; `loadingAuth: false` is hardcoded in DEFAULT_AUTH to prevent invisible component rendering
- Created `mp-react/src/test-utils/smoke.test.jsx` — 3 tests exercising the infrastructure end-to-end
- Exported `AuthContext` from `AuthContext.jsx` (was `const`, not `export const`) — required for `FakeAuthProvider` to inject context without triggering the real `AuthProvider` which connects to Firebase

## Verification passed

- `npm test`: 3/3 tests pass
- No env-guard bomb errors (`.env.test` stubs in place from 01-01)
- No missing module errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] smoke.test.js renamed to smoke.test.jsx**
- **Found during:** Task 2 verification (npm test)
- **Issue:** Vite 8 uses OXC transformer which requires `.jsx` extension for JSX syntax. File `smoke.test.js` contained JSX (`<div data-testid='vazio'>`) and threw `PARSE_ERROR: Unexpected JSX expression` at runtime.
- **Fix:** Renamed `smoke.test.js` to `smoke.test.jsx`
- **Files modified:** `mp-react/src/test-utils/smoke.test.jsx` (renamed)
- **Commit:** aff651e

**2. [Rule 2 - Missing critical functionality] Exported AuthContext from AuthContext.jsx**
- **Found during:** Task 2 pre-implementation review
- **Issue:** `AuthContext` was declared as `const AuthContext = createContext(null)` (no export), making it impossible to import in `renderWithProviders.jsx` for `FakeAuthProvider`. Without this export, tests would require using the real `AuthProvider` which triggers Firebase connection.
- **Fix:** Changed `const AuthContext` to `export const AuthContext`
- **Files modified:** `mp-react/src/contexts/AuthContext.jsx`
- **Commit:** aff651e

## Phase 1 complete

All INFRA-01..08 requirements satisfied. Test infrastructure is ready for Phase 2.

## Self-Check: PASSED

Files verified:
- mp-react/src/test-utils/setupTests.js — FOUND
- mp-react/src/test-utils/mockFirebase.js — FOUND
- mp-react/src/test-utils/renderWithProviders.jsx — FOUND
- mp-react/src/test-utils/smoke.test.jsx — FOUND

Commit verified: aff651e — FOUND
