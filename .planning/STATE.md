# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-03)

**Core value:** Nenhum fluxo crítico (OS, orçamentos, autenticação) deve quebrar silenciosamente quando o código muda.
**Current focus:** Phase 1 — Infraestrutura de Testes

## Current Position

Phase: 0 of 4 (pre-start)
Plan: 0 of 8 total
Status: Ready to plan
Last activity: 2026-05-03 — Roadmap criado, milestone Test Coverage v1 inicializado

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Completed | Avg/Plan |
|-------|-------|-----------|----------|
| 1. Infraestrutura | 2 | 0 | — |
| 2. Camada Base | 2 | 0 | — |
| 3. Auth e Roteamento | 2 | 0 | — |
| 4. Fluxos Críticos | 2 | 0 | — |

**Recent Trend:** N/A

## Accumulated Context

### Decisions

- Pre-start: Vitest 4.1.5 + RTL 16 + vi.mock() para Firebase (sem Emulator Suite, sem MSW)
- Pre-start: JavaScript puro — sem TypeScript nos testes
- Pre-start: clearMocks: true globalmente (nunca resetMocks: true)

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1 risk: env-guard bomb em firebase.js — resolvido por .env.test com stubs VITE_FIREBASE_*
- Phase 3 risk: onAuthStateChanged fora de act() — resolvido por mock síncrono com cb(null)
- Phase 4 risk: AdminPage 3264 linhas — testar handlers/hooks isolados, não renderizar o componente inteiro

## Session Continuity

Last session: 2026-05-03
Stopped at: Roadmap e STATE inicializados — pronto para `/gsd-plan-phase 1`
Resume file: None
