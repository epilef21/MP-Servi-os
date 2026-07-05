---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Financeiro Completo
status: executing
stopped_at: "Completado 09-03-PLAN.md (FinanceiroEmpresaTab: badges de status + botao Pagar + banner de alertas). Phase 9 3/3 concluida (PAG-01/02/03 Complete). Proximo: Phase 10 (Fluxo de Caixa e Evolucao)."
last_updated: "2026-07-05T22:05:00Z"
last_activity: 2026-07-05 -- Phase 9 Plan 3 completo, Fase 9 100% concluida
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 13
  completed_plans: 12
  percent: 92
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-02)

**Core value:** Da OS finalizada até o dinheiro na conta — o admin controla faturamento, recebimento, pagamentos e caixa em um lugar só.
**Current focus:** Phase 10 — Fluxo de Caixa e Evolução

## Current Position

Phase: 9 (Contas a Pagar) — COMPLETE
Plan: 3 of 3
Status: Phase 9 concluida (3/3 planos). Proximo: planejar Phase 10.
Last activity: 2026-07-05 -- Phase 9 Plan 3 completo (FinanceiroEmpresaTab: badges de status + botao Pagar + banner de alertas)

Progress: [█████████░] 92%

## Performance Metrics

**Velocity:**

- Total plans completed: 22 (2 v1.0 infra + 2 v1.0 base + 2 v1.0 auth + 2 v1.0 fluxos + 1 v1.1 imagens + 2 v1.1 relatório + 5 v1.2 fase 7 + 4 v1.2 fase 8 + 3 v1.2 fase 9, arredondado — ver ROADMAP.md para detalhe por fase)
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
| 8. Fechamento de Técnicos | 4 | 4 | ~7 min |
| 9. Contas a Pagar | 3 | 3 | ~10 min |
| 10-11. Financeiro Completo (restante) | TBD | 0 | - |

**Recent Trend:** Milestone v1.1 completo (2026-05-05). Milestone v1.2 iniciado 2026-07-02 — Phase 7 completa: Plan 1 (utils/faturamento.js + 27 testes Vitest), Plan 2 (DetalheOSModal: códigos MO+deslocamento), Plan 3 (ConfigTab: calendário de pagamento editável), Plan 4 (AbaFaturamento: fila por seguradora + checklist persistente) e Plan 5 (Fechar Nota + status/painel a receber + marcar paga) executados. Phase 7 (Faturamento e Contas a Receber) 100% concluída. Phase 8 (Fechamento de Técnicos) 100% concluída: Plan 1 (utils/fechamentoTecnicos.js + 16 testes), Plan 2 (TecnicosTab: chave PIX + forma de pagamento), Plan 3 (regra fechamentosTecnicos deployada + aba "👷 Técnicos" com fechamento mensal por técnico) e Plan 4 (marcar pago com snapshot imutável + histórico consultável de pagamentos) executados. Phase 9 (Contas a Pagar) em andamento: Plan 1 (utils/contasPagar.js: statusDespesa/diasParaVencer/dataVencimentoDoMes/resumoAlertas + 21 testes Vitest) e Plan 2 (FinanceiroEmpresaTab: dia_vencimento no cadastro recorrente, data_vencimento no lançamento mensal, auto-lançamento de fixas preenchendo vencimento — PAG-03 completo) executados — suite total 150 testes verdes. Próximo: 09-03-PLAN.md (badges de status + botão Pagar + banner de alertas).

**Per-Plan Metrics (v1.2):**

| Phase/Plan | Duration | Tasks | Files |
|------------|----------|-------|-------|
| Phase 07 P01 | 12min | 2 tasks | 2 files |
| Phase 07 P02 | 5min | 2 tasks | 1 file |
| Phase 07 P03 | 9min | 2 tasks | 1 file |
| Phase 07 P04 | ~15min | 2 tasks | 2 files |
| Phase 07 P05 | ~20min | 2 tasks | 2 files |
| Phase 08 P01 | ~10min | 2 tasks | 2 files |
| Phase 08 P02 | 6min | 2 tasks | 1 file |
| Phase 08 P03 | ~6min | 3 tasks | 3 files |
| Phase 08 P04 | ~8min | 2 tasks | 1 file |
| Phase 09 P01 | ~8min | 2 tasks | 2 files |
| Phase 09 P02 | ~10min | 2 tasks | 1 file |
| Phase 09 P03 | ~12min | 2 tasks | 2 files |

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
- [Phase 8]: 08-02: forma_pagamento restrita a select fixo (pix/dinheiro/transferencia) para evitar valor arbitrario no Firestore (mitigacao T-08-04); chave_pix e forma_pagamento sao opcionais, nao entram na validacao de campos obrigatorios
- [Phase 8]: 08-03: regra fechamentosTecnicos deployada ANTES de qualquer getDocs na aba (aprendizado LOCKED da Fase 7 -- colecao sem regra derruba a aba em producao)
- [Phase 8]: 08-03: join grupo (OS do mes) com cadastro de tecnico casa por tecnico_id primeiro, fallback por normNome(t.nome); total exibido usa snapshot do fechamento (fech.total) quando pago, total ao vivo (g.total) quando pendente
- [Phase 8]: 08-03: TEC-03 permanece Pending em REQUIREMENTS.md -- a visao de leitura (status derivado PAGO/PENDENTE) foi entregue neste plano, mas a acao de "marcar como pago" + historico consultavel (escopo textual de TEC-03) e responsabilidade do plano 08-04
- [Phase 8]: 08-04: marcarPago sempre le identidade do GRUPO (g.tecnicoNome/g.tecnicoNorm/g.osList), nunca da OS direta -- snapshot imutavel gravado em fechamentosTecnicos com status:'pago' (pendente e sempre derivado, nunca gravado)
- [Phase 8]: 08-04: trava de pagamento duplo no mesmo mes e client-side apenas (acharFechamento) -- risco de corrida por 2 abas simultaneas aceito (T-08-12), mesmo precedente de notasFiscais na Fase 7
- [Phase 8]: 08-04: Phase 8 (Fechamento de Tecnicos) 100% concluida (4/4 planos) -- TEC-01, TEC-02, TEC-03 completos
- [Phase 9]: 09-01: diasParaVencer usa Date.UTC(y, m-1, d) nos dois lados da subtracao, evitando vies de fuso/DST (mesma cautela de calcularDataPrevista da Fase 7)
- [Phase 9]: 09-01: dataVencimentoDoMes clampa com new Date(ano, mes, 0).getDate() + Math.min -- dia 31 em mes de 30 dias e dia 30 em fevereiro (comum e bissexto) tratados
- [Phase 9]: 09-01: statusDespesa trata despesa sem data_vencimento como nunca-atrasado (compat lancamentos antigos sem vencimento cadastrado) -- so pode ser 'pago' ou 'pendente'
- [Phase 9]: 09-01: PAG-01/02/03 permanecem Pending em REQUIREMENTS.md -- 09-01 entrega so a logica pura (sem UI); comportamento observavel pelo admin (data de vencimento visivel, alerta, auto-lancamento) e responsabilidade de 09-02/09-03
- [Phase 9]: 09-02: dia_vencimento gravado como Number() ou null (nunca string vazia) no Firestore -- compat com o clamp de dataVencimentoDoMes
- [Phase 9]: 09-02: PAG-03 marcado Complete em REQUIREMENTS.md -- auto-lancamento de fixas ja preenche data_vencimento do mes. PAG-01 permanece Pending: so a base de escrita foi entregue (data_vencimento gravavel), o status derivado pendente/pago/atrasado (leitura) e responsabilidade de 09-03
- [Phase 9]: 09-03: resumoAlertas roda apenas sobre despesasMensais do mes corrente ja carregado (sem query extra) -- discricao aceita e documentada no threat model (T-09-08)
- [Phase 9]: 09-03: badge "⚠️ Pendente" legado (despesa variavel sem valor lancado) mantido com prioridade visual sobre o status derivado statusDespesa, evitando dois conceitos de "pendente" na mesma tela
- [Phase 9]: 09-03: PAG-01 e PAG-02 marcados Complete em REQUIREMENTS.md -- Phase 9 (Contas a Pagar) 100% concluida (3/3 planos)

### Pending Todos

None yet.

### Blockers/Concerns

- v1.2: Calendário de pagamento da Tempo e Maxpar ainda não foi levantado com o usuário — usar data manual até FAT-11 (v1.3) ser endereçado
- v1.2 herdado de v1.0: AdminPage.jsx tem ~580 linhas pós-refatoração — abas/modais do Financeiro vivem em mp-react/src/components/admin/ e devem ser testados/implementados isoladamente, nunca renderizando o AdminPage inteiro

## Session Continuity

Last session: 2026-07-05T22:05:00Z
Stopped at: Completado 09-03-PLAN.md (FinanceiroEmpresaTab: badges de status + botao Pagar + banner de alertas). Phase 9 3/3 concluida (PAG-01/02/03 Complete). Proximo: Phase 10 (Fluxo de Caixa e Evolucao).
Resume file: None
