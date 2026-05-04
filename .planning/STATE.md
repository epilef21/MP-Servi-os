# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-03)

**Core value:** Nenhum fluxo crítico (OS, orçamentos, autenticação) deve quebrar silenciosamente quando o código muda.
**Current focus:** Phase 1 — Infraestrutura de Testes

## Current Position

Phase: 1 of 4 (complete)
Plan: 2 of 8 total
Status: Phase 1 complete — Phase 2 next
Last activity: 2026-05-03 — Plan 01-02 complete (test-utils helpers + smoke test, 3/3 pass)

Progress: [██░░░░░░░░] 25%

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: ~8 min
- Total execution time: 0.27 hours

**By Phase:**

| Phase | Plans | Completed | Avg/Plan |
|-------|-------|-----------|----------|
| 1. Infraestrutura | 2 | 2 | 8 min |
| 2. Camada Base | 2 | 0 | — |
| 3. Auth e Roteamento | 2 | 0 | — |
| 4. Fluxos Críticos | 2 | 0 | — |

**Recent Trend:** 2 plans complete (2026-05-03)

## Accumulated Context

### Decisions

- Pre-start: Vitest 4.1.5 + RTL 16 + vi.mock() para Firebase (sem Emulator Suite, sem MSW)
- Pre-start: JavaScript puro — sem TypeScript nos testes
- Pre-start: clearMocks: true globalmente (nunca resetMocks: true)
- 01-01: vitest.config.js standalone (vitest/config, não extendendo vite_config.js)
- 01-01: .env.test commitado (não no .gitignore) — stubs seguros para todos os testes
- 01-02: AuthContext exportado (export const) para permitir FakeAuthProvider sem trigger do Firebase
- 01-02: Arquivos de teste com JSX devem usar extensão .jsx — OXC/Vite 8 não processa JSX em .js

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1 risk: env-guard bomb em firebase.js — resolvido por .env.test com stubs VITE_FIREBASE_*
- Phase 3 risk: onAuthStateChanged fora de act() — resolvido por mock síncrono com cb(null)
- Phase 4 risk: AdminPage 3264 linhas — testar handlers/hooks isolados, não renderizar o componente inteiro

## Session Continuity

Last session: 2026-05-03
Stopped at: Completed 01-02 (test-utils helpers + smoke test — 3/3 pass). Phase 1 complete. Next: Phase 2
Resume file: None
