# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-03)

**Core value:** Nenhum fluxo crítico (OS, orçamentos, autenticação) deve quebrar silenciosamente quando o código muda.
**Current focus:** Phase 1 — Infraestrutura de Testes

## Current Position

Phase: 1 of 4 (in progress)
Plan: 1 of 8 total
Status: In progress — Phase 1, Plan 01-02 next
Last activity: 2026-05-04 — Plan 01-01 complete (vitest deps + config + .env.test)

Progress: [█░░░░░░░░░] 12%

## Performance Metrics

**Velocity:**
- Total plans completed: 1
- Average duration: ~8 min
- Total execution time: 0.13 hours

**By Phase:**

| Phase | Plans | Completed | Avg/Plan |
|-------|-------|-----------|----------|
| 1. Infraestrutura | 2 | 1 | 8 min |
| 2. Camada Base | 2 | 0 | — |
| 3. Auth e Roteamento | 2 | 0 | — |
| 4. Fluxos Críticos | 2 | 0 | — |

**Recent Trend:** 1 plan complete (2026-05-04)

## Accumulated Context

### Decisions

- Pre-start: Vitest 4.1.5 + RTL 16 + vi.mock() para Firebase (sem Emulator Suite, sem MSW)
- Pre-start: JavaScript puro — sem TypeScript nos testes
- Pre-start: clearMocks: true globalmente (nunca resetMocks: true)
- 01-01: vitest.config.js standalone (vitest/config, não extendendo vite_config.js)
- 01-01: .env.test commitado (não no .gitignore) — stubs seguros para todos os testes

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1 risk: env-guard bomb em firebase.js — resolvido por .env.test com stubs VITE_FIREBASE_*
- Phase 3 risk: onAuthStateChanged fora de act() — resolvido por mock síncrono com cb(null)
- Phase 4 risk: AdminPage 3264 linhas — testar handlers/hooks isolados, não renderizar o componente inteiro

## Session Continuity

Last session: 2026-05-04
Stopped at: Completed 01-01 (vitest deps + vitest.config.js + .env.test). Next: 01-02
Resume file: None
