---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Financeiro Completo
status: executing
stopped_at: "Completado 08-01-PLAN.md (utils/fechamentoTecnicos.js + testes Vitest). Proximo: 08-02-PLAN.md (TecnicosTab: chave PIX)"
last_updated: "2026-07-05T18:15:39.000Z"
last_activity: 2026-07-05 -- Phase 8 Plan 1 completo
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 9
  completed_plans: 6
  percent: 67
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-02)

**Core value:** Da OS finalizada até o dinheiro na conta — o admin controla faturamento, recebimento, pagamentos e caixa em um lugar só.
**Current focus:** Phase 8 — Fechamento de Técnicos

## Current Position

Phase: 8 (Fechamento de Técnicos) — EXECUTING
Plan: 2 of 4
Status: Executing Phase 8
Last activity: 2026-07-05 -- Phase 8 Plan 1 completo (utils/fechamentoTecnicos.js + testes)

Progress: [███████░░░] 67%

## Performance Metrics

**Velocity:**

- Total plans completed: 15 (2 v1.0 infra/base + 2 v1.0 auth/fluxos + 1 v1.1 imagens + 2 v1.1 relatório + 5 v1.2 fase 7, arredondado — ver ROADMAP.md para detalhe por fase)
- Average duration: ~7 min
- Total execution time: ~1 hour

**By Phase:**

| Phase | Plans | Completed | Avg/Plan |
|-------|-------|-----------|----------|
| 1. Infraestrutura | 2 | 2 | 8 min |
| 2. Camada Base | 2 | 2 | ~12 min |
| 3. Auth e Roteamento | 2 | 2 | ~6 min |
| 4. Fluxos Críticos | 2 | 2 | ~4 min |
| 5. Compressão de Imagens | 1 | 1 | ~4 min |
| 6. Relatório Mensal em PDF | 2 | 2 | ~8 min |
| 7. Faturamento e Contas a Receber | 5 | 5 | ~11 min |
| 8-11. Financeiro Completo (restante) | TBD | 0 | - |

**Recent Trend:** Milestone v1.1 completo (2026-05-05). Milestone v1.2 iniciado 2026-07-02 — Phase 7 completa: Plan 1 (utils/faturamento.js + 27 testes Vitest), Plan 2 (DetalheOSModal: códigos MO+deslocamento), Plan 3 (ConfigTab: calendário de pagamento editável), Plan 4 (AbaFaturamento: fila por seguradora + checklist persistente) e Plan 5 (Fechar Nota + status/painel a receber + marcar paga) executados. Phase 7 (Faturamento e Contas a Receber) 100% concluída — próxima: Phase 8 (Fechamento de Técnicos).

**Per-Plan Metrics (v1.2):**

| Phase/Plan | Duration | Tasks | Files |
|------------|----------|-------|-------|
| Phase 07 P01 | 12min | 2 tasks | 2 files |
| Phase 07 P02 | 5min | 2 tasks | 1 file |
| Phase 07 P03 | 9min | 2 tasks | 1 file |
| Phase 07 P04 | ~15min | 2 tasks | 2 files |
| Phase 07 P05 | ~20min | 2 tasks | 2 files |
| Phase 08 P01 | ~10min | 2 tasks | 2 files |

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
- [Phase 7]: 07-04: AbaFaturamento e a UNICA fonte de escrita do checklist fat_lancado_* — DetalheOSModal (07-02) permanece somente-leitura
- [Phase 7]: 07-04: toggleLancado migra definitivamente o legado ao gravar item MO — zera fat_lancado_em e grava fat_lancado_mo_em
- [Phase 7]: 07-05: statusNota deriva atrasada comparando data_prevista com hoje na leitura — nunca gravado no Firestore, sem job/cron
- [Phase 7]: 07-05: Quitacao em massa das OS vinculadas usa Promise.all de atualizarOS (loop), nao writeBatch — firebase.js nao exporta essa funcao
- [Phase 7]: 07-05: Nota grava snapshot imutavel dos itens (os_id, tipo, codigo, valor, num_assist, nome_segurado) em vez de referencia viva a OS, protegendo o historico contra edicoes futuras
- [Phase 8]: 08-01: Criterio de "OS do mes" do fechamento de tecnicos replicado de calcularDRE (criado_em) para manter consistencia com o DRE
- [Phase 8]: 08-01: Agrupamento usa normNome(tecnico_nome) como chave (nome sempre existe na OS); grupo carrega tecnicoId (primeiro nao vazio) para o consumidor casar por ID primeiro, com fallback por nome normalizado

### Pending Todos

None yet.

### Blockers/Concerns

- v1.2: Calendário de pagamento da Tempo e Maxpar ainda não foi levantado com o usuário — usar data manual até FAT-11 (v1.3) ser endereçado
- v1.2 herdado de v1.0: AdminPage.jsx tem ~580 linhas pós-refatoração — abas/modais do Financeiro vivem em mp-react/src/components/admin/ e devem ser testados/implementados isoladamente, nunca renderizando o AdminPage inteiro

## Session Continuity

Last session: 2026-07-05T18:15:39Z
Stopped at: Completado 08-01-PLAN.md (utils/fechamentoTecnicos.js + testes Vitest). Proximo: 08-02-PLAN.md (TecnicosTab: chave PIX)
Resume file: None
