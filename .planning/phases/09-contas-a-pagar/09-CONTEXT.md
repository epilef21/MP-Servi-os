# Phase 9: Contas a Pagar - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning
**Source:** Planejamento do milestone v1.2 confirmado com o usuário (2026-07-02)

<domain>
## Phase Boundary

Vencimento e status nas despesas já existentes: cada despesa mensal ganha data de vencimento e status pendente/pago/atrasado, com alerta de contas a vencer nos próximos 7 dias e atrasadas. Despesas recorrentes fixas entram no mês já com vencimento preenchido. NÃO inclui: novas coleções (usa despesasMensais/despesasRecorrentes existentes), pagamento de técnicos (Fase 8, pronto), fluxo de caixa (Fase 10).

</domain>

<decisions>
## Implementation Decisions

### O que o usuário pediu (LOCKED)
- **PAG-01**: despesas mensais têm **data de vencimento** e status **pendente / pago / atrasado**. "Atrasado" = hoje > vencimento e não pago — **derivado, nunca gravado** (mesmo padrão das notas da Fase 7 e fechamentos da Fase 8).
- **PAG-02**: alerta visível de **contas a vencer nos próximos 7 dias** e **contas atrasadas** (ex.: "3 contas vencem esta semana · 1 atrasada").
- **PAG-03**: despesas recorrentes **fixas** ganham **dia de vencimento** no cadastro (1–31); o auto-lançamento mensal já preenche a data de vencimento do mês automaticamente (dia 31 em mês de 30 → último dia do mês).

### Modelo de dados (LOCKED — estende coleções existentes, sem coleção nova)
- `despesasMensais`: novo campo `data_vencimento` (string YYYY-MM-DD, opcional para lançamentos antigos). Campo `data_pagamento` existente passa a significar "pago em" — despesa com `data_pagamento` preenchida = paga.
- `despesasRecorrentes`: novo campo `dia_vencimento` (número 1–31, opcional).
- **Compatibilidade com dados antigos é obrigatória**: despesas sem `data_vencimento` continuam funcionando (sem status de atraso, apenas pendente/pago pela data_pagamento).
- SEM firestore.rules novas — despesasMensais/despesasRecorrentes já têm regra.

### Onde vive na UI (LOCKED)
- Aba **Despesas** existente do FinanceiroEmpresaTab: status/vencimento nos itens de lançamento, campo de vencimento nos modais (ModalLancamentoMensal e ModalDespesaRecorrente).
- Alerta (PAG-02): banner no topo do Financeiro (visível em qualquer aba interna), somando despesas do mês corrente a vencer em ≤7 dias e atrasadas, com botão que leva à aba Despesas.
- Botão rápido "✓ Pagar" no item da despesa: preenche data_pagamento com hoje (confirmando antes).

### Claude's Discretion
- Lógica pura de vencimento/status (diasParaVencer, statusDespesa, dataVencimentoDoMes) em utilitário testável com Vitest (padrão das Fases 7/8).
- Visual dos badges (pendente/pago/atrasado) — seguir classes existentes (despesa-status-*, badge).
- Se o alerta agrega só o mês corrente ou também meses anteriores em aberto — decidir pelo mais útil e simples (sugestão: mês corrente + qualquer despesa atrasada não paga de meses anteriores carregados; se exigir query extra cara, limitar ao mês corrente e documentar).
- Aprendizados das fases anteriores: empty-states explicativos; compat legado lida na LEITURA (não migrar dados).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `mp-react/src/components/admin/FinanceiroEmpresaTab.jsx` — aba Despesas, ModalLancamentoMensal, ModalDespesaRecorrente, autoLancarFixas (onde o dia_vencimento entra), FORM_DESP_* iniciais.
- `mp-react/src/utils/faturamento.js` e `mp-react/src/utils/fechamentoTecnicos.js` — padrão de utilitário puro + testes.
- `CLAUDE.md` — decisões de teste.

</canonical_refs>

<specifics>
## Specific Ideas

- Usuário não técnico: mensagens diretas ("Aluguel vence em 3 dias", "Água e Luz atrasada há 5 dias").

</specifics>

<deferred>
## Deferred Ideas

- Notificação push de contas a vencer — possível depois (infra de push existe), não pedido.
- Anexar comprovante de pagamento — não pedido.

</deferred>

---

*Phase: 09-contas-a-pagar*
*Context gathered: 2026-07-05*
