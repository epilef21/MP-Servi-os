---
plan: 01-01
phase: 01-infraestrutura-de-testes
status: complete
wave: 1
tags: [vitest, testing-library, jsdom, config, env]
dependency_graph:
  requires: []
  provides: [test-runner, test-env, firebase-env-stub]
  affects: [mp-react/package.json, mp-react/vitest.config.js, mp-react/.env.test]
tech_stack:
  added: [vitest@4.1.5, jsdom@25.0.1, "@testing-library/react@16.3.2", "@testing-library/dom@10.4.1", "@testing-library/user-event@14.6.1", "@testing-library/jest-dom@6.9.1"]
  patterns: [standalone-vitest-config, env-stub-file]
key_files:
  created: [mp-react/vitest.config.js, mp-react/.env.test]
  modified: [mp-react/package.json, mp-react/package-lock.json]
decisions:
  - vitest/config import (standalone, not extending vite_config.js)
  - clearMocks: true only — no resetMocks, no restoreMocks
  - .env.test committed (not gitignored) — stub values only, safe to commit
metrics:
  duration: 8 minutes
  completed: 2026-05-04
  tasks_completed: 2
  files_changed: 4
---

# Phase 01 Plan 01: Install dependencies and config Summary

## What was done

- Installed vitest@4.x, jsdom@25, @testing-library/react@16, @testing-library/dom@10, @testing-library/user-event@14, @testing-library/jest-dom@6 as devDependencies in mp-react/
- Added test, test:watch, test:coverage scripts to mp-react/package.json
- Created mp-react/vitest.config.js (standalone, vitest/config, jsdom, globals, clearMocks: true)
- Created mp-react/.env.test with 7 Firebase stub vars (safe to commit)

## Verification passed

- package.json has all 3 test scripts and vitest/RTL devDependencies
- vitest.config.js imports from vitest/config, uses jsdom, clearMocks: true, no resetMocks
- .env.test has all 7 VITE_FIREBASE_* and VITE_SUPERADMIN_EMAIL stubs

## Deviations from Plan

None - plan executed exactly as written.

## Notes for Wave 2

- setupFiles points to ./src/test-utils/setupTests.js — Wave 2 must create this file
- .env.test is in place — env-guard bomb is defused for all subsequent test files

## Self-Check: PASSED

- mp-react/vitest.config.js: FOUND
- mp-react/.env.test: FOUND
- mp-react/package.json scripts (test, test:watch, test:coverage): FOUND
- Commit af51b77: FOUND
