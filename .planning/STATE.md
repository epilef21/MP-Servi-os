---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Financeiro Completo
status: executing
stopped_at: "Completado 07-03-PLAN.md (ConfigTab: calendarios de pagamento editaveis). Proximo: 07-04"
last_updated: "2026-07-02T23:34:13Z"
last_activity: 2026-07-02
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 5
  completed_plans: 3
  percent: 60
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-02)

**Core value:** Da OS finalizada até o dinheiro na conta — o admin controla faturamento, recebimento, pagamentos e caixa em um lugar só.
**Current focus:** Phase 7 — Faturamento e Contas a Receber

## Current Position

Phase: 7 (Faturamento e Contas a Receber) — EXECUTING
Plan: 4 of 5
Status: Ready to execute
Last activity: 2026-07-02

Progress: [██████░░░░] 60%

## Performance Metrics

**Velocity:**

- Total plans completed: 12 (2 v1.0 infra/base + 2 v1.0 auth/fluxos + 1 v1.1 imagens + 2 v1.1 relatório + 2 v1.2 fase 7, arredondado — ver ROADMAP.md para detalhe por fase)
- Average duration: ~6 min
- Total execution time: ~0.8 hours

**By Phase:**

| Phase | Plans | Completed | Avg/Plan |
|-------|-------|-----------|----------|
| 1. Infraestrutura | 2 | 2 | 8 min |
| 2. Camada Base | 2 | 2 | ~12 min |
| 3. Auth e Roteamento | 2 | 2 | ~6 min |
| 4. Fluxos Críticos | 2 | 2 | ~4 min |
| 5. Compressão de Imagens | 1 | 1 | ~4 min |
| 6. Relatório Mensal em PDF | 2 | 2 | ~8 min |
| 7-11. Financeiro Completo | TBD | 2 | ~8 min |

**Recent Trend:** Milestone v1.1 completo (2026-05-05). Milestone v1.2 iniciado 2026-07-02 — Phase 7 Plan 1 (utils/faturamento.js + 27 testes Vitest), Plan 2 (DetalheOSModal: códigos MO+deslocamento) e Plan 3 (ConfigTab: calendário de pagamento editável) executados.

**Per-Plan Metrics (v1.2):**

| Phase/Plan | Duration | Tasks | Files |
|------------|----------|-------|-------|
| Phase 07 P01 | 12min | 2 tasks | 2 files |
| Phase 07 P02 | 5min | 2 tasks | 1 file |
| Phase 07 P03 | 9min | 2 tasks | 1 file |

## Accumulated Context

### Decisions

- Pre-start (v1.2): Faturamento por seguradora modelado por dois caminhos — códigos por OS (Mapfre/Allianz) vs. fila automática por num_assist (Tempo/Maxpar)
- Pre-start (v1.2): Valores da Tempo/Maxpar não são travados na OS — confirmados na hora de faturar, pois mudam com frequência
- Pre-start (v1.2): Calendários de pagamento (Mapfre, Allianz) pré-cadastrados e editáveis via Config; demais seguradoras usam data manual até serem levantadas
- Pre-start (v1.2): Fluxo de Caixa (Phase 10) depende dos dados de notas pagas, técnicos pagos e despesas pagas produzidos nas Phases 7-9
- Pre-start (v1.2): Fechamento do mês (Phase 11) depende de todas as áreas financeiras anteriores estarem completas antes de travar lançamentos
- [Phase 7]: 07-01: Mondial usa o mesmo objeto de calendario da Allianz (alias, nao copia)
- [Phase 7]: 07-01: calcularDataPrevista formata data com helper local (padStart) em vez de toISOString, evitando bug de timezone
- [Phase 7]: 07-02: mo_seguradora/valor_deslocamento nao sao sobrescritos ao salvar codigos MO/deslocamento — preservam o valor da OS para permitir a divergencia do Plano 04 (FAT-05)
- [Phase 7]: 07-02: Handler marcarLancado e estado savingLancado removidos do DetalheOSModal — checklist de lancamento passa a viver exclusivamente na fila da AbaFaturamento (Plano 04), fonte de verdade unica
- [Phase 7]: 07-03: Secao de calendario adicionada dentro da sub-aba "Tarifas" do ConfigTab (nao criou sub-aba nova) — evita colidir com a sub-aba 'calendario' que ja e usada para Google Calendar
- [Phase 7]: 07-03: saveCalendario sempre espelha Mondial = Allianz ao gravar, mantendo o alias estabelecido em 07-01

### Pending Todos

None yet.

### Blockers/Concerns

- v1.2: Calendário de pagamento da Tempo e Maxpar ainda não foi levantado com o usuário — usar data manual até FAT-11 (v1.3) ser endereçado
- v1.2 herdado de v1.0: AdminPage.jsx tem ~580 linhas pós-refatoração — abas/modais do Financeiro vivem em mp-react/src/components/admin/ e devem ser testados/implementados isoladamente, nunca renderizando o AdminPage inteiro

## Session Continuity

Last session: 2026-07-02T23:34:13Z
Stopped at: Completado 07-03-PLAN.md (ConfigTab: calendarios de pagamento editaveis). Proximo: 07-04
Resume file: None
