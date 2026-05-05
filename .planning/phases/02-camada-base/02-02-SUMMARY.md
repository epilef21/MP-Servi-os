---
phase: 02-camada-base
plan: 02
subsystem: testing
tags: [vitest, firebase, firestore, mocks, sdk-level]

requires:
  - phase: 01-infraestrutura
    provides: vitest.config.js, .env.test stubs — test infrastructure without real Firebase

provides:
  - mp-react/src/__tests__/firebase.test.js with 17 tests covering DATA-01..06

affects: [03-auth-roteamento, 04-fluxos-criticos]

tech-stack:
  added: []
  patterns: [sdk-level mocking for data layer tests, vi.mock hoisting order]

key-files:
  created:
    - mp-react/src/__tests__/firebase.test.js
  modified: []

key-decisions:
  - "vi.mock('firebase/firestore') SDK-level exception: documented inline — required to test firebase.js internals without emulator"
  - "beforeEach sets mockResolvedValue per describe — clearMocks:true resets call counts but not return values"
  - "QuerySnapshot shape: { docs: [{ id, data: () => ({}) }] } — not flat array or plain object"
  - "AggregateQuerySnapshot shape: { data: () => ({ count: N }) } — not { count: N } directly"

patterns-established:
  - "SDK-level mock exception: vi.mock('firebase/firestore') allowed ONLY in firebase.test.js"
  - "All other tests continue using vi.mock('../firebase') per CLAUDE.md"

requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06]

duration: 10min
completed: 2026-05-05
---

# Phase 02-02: Firebase Data Layer Tests Summary

**17 tests covering firebase.js data layer (criarOS/atualizarOS/getOSdaEmpresa/getEmpresaBySlug/cadastrarEmpresa/contarOSdoMes) with SDK-level mocks — no real Firebase calls**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-05T22:25Z
- **Completed:** 2026-05-05T22:35Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created `firebase.test.js` with 17 tests across 6 describe blocks (DATA-01..06)
- All 50 tests in the full suite pass (smoke: 3, formatters: 30, firebase: 17)
- SDK-level mock exception to CLAUDE.md documented inline in the file

## Task Commits

1. **Task 1: Escrever firebase.test.js** — `fad1822` (test)

## Files Created/Modified

- `mp-react/src/__tests__/firebase.test.js` — 17 tests, vi.mock at SDK level for all 4 Firebase packages

## Decisions Made

- SDK-level mocking is the only way to intercept firebase.js internal calls without an emulator.
- `getDoc` NOT imported in test file — `getEmpresaBySlug` uses `getDocs`, not `getDoc`. Kept mock minimal.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Subagent executor could not get Bash permissions in worktree — plan executed inline instead.

## Self-Check: PASSED

## Next Phase Readiness

- Firebase data layer fully covered (DATA-01..06)
- Phase 3 (Auth e Roteamento) can now build on this foundation
- `useEmpresa.js` `verificarLimite` deferred to Phase 3 as documented in plan

---
*Phase: 02-camada-base*
*Completed: 2026-05-05*
