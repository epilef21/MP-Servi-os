# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-05)

**Core value:** Produto confiável e completo — fluxos críticos cobertos por testes e features core entregues.
**Current focus:** v1.0 Test Coverage — Phases 2-4 pendentes (Camada Base, Auth, Fluxos Críticos)

## Current Position

Milestone: v1.0 Test Coverage — em progresso
Phase: 2 of 4 (v1.0 scope) — Ready to execute
Plan: 0 of 2 (Phase 2 plans) — Planned, not yet executed
Status: Phase 2 planned (2026-05-05) — 2 planos criados e verificados. Pronto para execução.
Last activity: 2026-05-05 — Phase 2 planned — 02-01 (formatters extraction + tests) e 02-02 (firebase data layer tests)

Progress (v1.0): [██░░░░░░░░] 25% (Phase 1 complete, Phases 2-4 pending)
Progress (v1.1): [██████████] 100% (Phases 5+6 complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 5 (2 v1.0 + 3 v1.1)
- Average duration: ~6 min
- Total execution time: ~0.5 hours

**By Phase:**

| Phase | Plans | Completed | Avg/Plan |
|-------|-------|-----------|----------|
| 1. Infraestrutura | 2 | 2 | 8 min |
| 2. Camada Base | 2 | 0 | — |
| 3. Auth e Roteamento | 2 | 0 | — |
| 4. Fluxos Críticos | 2 | 0 | — |
| 5. Compressão de Imagens | 1 | 1 | ~4 min |
| 6. Relatório Mensal em PDF | 2 | 2 | ~8 min |

**Recent Trend:** Phase 6 complete (2026-05-05) — 2 planos executados, aprovados e verificados

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
- 06-01: getLucroLocal copiado internamente para evitar dependência circular utils->pages
- 06-01: agregarRelatorio filtra client-side (in-memory) sem nova query Firestore
- 06-01: tableRow helper para tabelas de breakdown (3 colunas) em vez de textBlock
- 06-02: seletor de período com 12 opções geradas por loop — sem input livre para evitar valores inválidos
- 06-02: tabelas inline com style props — sem adicionar novas classes CSS conforme CLAUDE.md
- 06-02: mudar o select limpa relDados para forçar nova geração (evita dados desatualizados)
- v1.1: campo lucroReal já salvo em cada documento de OS em empresas/{empresaId}/checklist/{osId} — sem migration necessária
- 05-01: compressão ocorre no handleSubmit (não no handleFotoSelect) — evita bloqueio async na seleção
- 05-01: estado `comprimindo` (não uploadingFoto) — reflete que o feedback corresponde à fase de compressão

### Pending Todos

- Executar Phases 2-4 do milestone v1.0 (Camada Base, Auth, Fluxos Críticos)

### Blockers/Concerns

- Phase 1 risk: env-guard bomb em firebase.js — resolvido por .env.test com stubs VITE_FIREBASE_*
- Phase 3 risk: onAuthStateChanged fora de act() — resolvido por mock síncrono com cb(null)
- Phase 4 risk: AdminPage 3264 linhas — testar handlers/hooks isolados, não renderizar o componente inteiro
- Phase 6 review: CR-01 (checkPage não reserva rodapé), CR-02 (MESES[mes-1] sem validação), WR-01 (getLucroLocal duplicado) — registrados em 06-REVIEW.md para tratamento futuro

## Session Continuity

Last session: 2026-05-05
Stopped at: Phase 2 planejada — 2 planos prontos para execução. Próximo: /gsd-execute-phase 2
Resume file: None
