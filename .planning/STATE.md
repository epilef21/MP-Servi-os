# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-04)

**Core value:** Produto confiável e completo — fluxos críticos cobertos por testes e features core entregues.
**Current focus:** v1.1 Produto Core — Phase 5 (Compressão de Imagens) e Phase 6 (Relatório Mensal em PDF)

## Current Position

Milestone: v1.1 Produto Core
Phase: 6 of 6 (v1.1 scope) — Ready to execute
Plan: 1 of 3 total (v1.1 plans)
Status: Phase 5 complete — Phase 6 (Relatório Mensal em PDF) planned (2 plans), ready to execute
Last activity: 2026-05-04 — Phase 6 planned — 06-01 (relatorioMensalPdf.js) + 06-02 (UI AdminPage)

Progress (v1.0): [██░░░░░░░░] 25% (Phase 1 complete, Phases 2-4 pending)
Progress (v1.1): [████████░░] 80% (Phase 5 complete, Phase 6 planned)

## Performance Metrics

**Velocity:**
- Total plans completed: 2 (v1.0 Phase 1)
- Average duration: ~8 min
- Total execution time: 0.27 hours

**By Phase:**

| Phase | Plans | Completed | Avg/Plan |
|-------|-------|-----------|----------|
| 1. Infraestrutura | 2 | 2 | 8 min |
| 2. Camada Base | 2 | 0 | — |
| 3. Auth e Roteamento | 2 | 0 | — |
| 4. Fluxos Críticos | 2 | 0 | — |
| 5. Compressão de Imagens | 1 | 1 | ~4 min |
| 6. Relatório Mensal em PDF | 2 | 0 | — |

**Recent Trend:** 2 plans complete (2026-05-03) — nenhum plano executado desde então

## Accumulated Context

### Decisions

- Pre-start: Vitest 4.1.5 + RTL 16 + vi.mock() para Firebase (sem Emulator Suite, sem MSW)
- Pre-start: JavaScript puro — sem TypeScript nos testes
- Pre-start: clearMocks: true globalmente (nunca resetMocks: true)
- 01-01: vitest.config.js standalone (vitest/config, não extendendo vite_config.js)
- 01-01: .env.test commitado (não no .gitignore) — stubs seguros para todos os testes
- 01-02: AuthContext exportado (export const) para permitir FakeAuthProvider sem trigger do Firebase
- 01-02: Arquivos de teste com JSX devem usar extensão .jsx — OXC/Vite 8 não processa JSX em .js
- v1.1: browser-image-compression já instalado — integrar diretamente em OrcamentoTecnicoPage.jsx
- v1.1: jsPDF já instalado (usado em pdfGenerator.js e orcamentoPdfGenerator.js) — reaproveitar padrão existente em utils/relatorioMensalPdf.js
- v1.1: campo lucroReal já salvo em cada documento de OS em empresas/{empresaId}/checklist/{osId} — sem migration necessária
- 05-01: compressão ocorre no handleSubmit (não no handleFotoSelect) — evita bloqueio async na seleção
- 05-01: estado `comprimindo` (não uploadingFoto) — reflete que o feedback corresponde à fase de compressão

### Pending Todos

- Executar Phases 2-4 do milestone v1.0 (Camada Base, Auth, Fluxos Críticos)
- Executar Phase 6 do milestone v1.1 (Relatório Mensal em PDF) — 2 planos prontos

### Blockers/Concerns

- Phase 1 risk: env-guard bomb em firebase.js — resolvido por .env.test com stubs VITE_FIREBASE_*
- Phase 3 risk: onAuthStateChanged fora de act() — resolvido por mock síncrono com cb(null)
- Phase 4 risk: AdminPage 3264 linhas — testar handlers/hooks isolados, não renderizar o componente inteiro
- Phase 6 risk: UI do relatório vai dentro do AdminPage de 3264 linhas — usar padrão de seção/tab existente; não renderizar o componente inteiro em testes

## Session Continuity

Last session: 2026-05-04
Stopped at: Phase 6 planejada — 06-01 (relatorioMensalPdf.js: agregarRelatorio + gerarRelatorioMensalPdf) e 06-02 (UI AdminPage: sidebar + seletor + tabelas + download PDF). Pronto para executar.
Resume file: None
