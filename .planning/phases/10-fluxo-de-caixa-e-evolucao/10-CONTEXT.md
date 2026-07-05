# Phase 10: Fluxo de Caixa e Evolução - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning
**Source:** Planejamento do milestone v1.2 confirmado com o usuário (2026-07-02)

<domain>
## Phase Boundary

Visão de caixa (dinheiro que DE FATO entrou e saiu no mês, usando os status das Fases 7-9) e gráfico de evolução dos últimos 12 meses (receita, lucro líquido, margem). NÃO inclui: conciliação bancária, exportação (Fase 11), alterar o DRE existente.

</domain>

<decisions>
## Implementation Decisions

### O que o usuário pediu (LOCKED)
- **CAIXA-01**: aba "💵 Caixa" no FinanceiroEmpresaTab mostrando o mês selecionado (mesRef):
  - **Entradas reais**: notas fiscais PAGAS no mês (`notasFiscais` com `pago_em` dentro do mês — data do recebimento, não da emissão) + serviços particulares do mês (`servicosParticulares`, `mes_referencia`).
  - **Saídas reais**: despesas PAGAS no mês (`despesasMensais` com `data_pagamento` no mês) + fechamentos de técnicos PAGOS no mês (`fechamentosTecnicos` com `pago_em` no mês).
  - **Saldo do mês** = entradas − saídas, em destaque (verde/vermelho).
  - Diferença didática para o usuário: o DRE responde "o mês deu lucro?"; o Caixa responde "quanto dinheiro entrou e saiu de verdade?" — deixar essa explicação curta na tela.
- **CAIXA-02**: gráfico de evolução dos últimos 12 meses com **receita**, **lucro líquido** e **margem %** por mês.

### Decisões técnicas (LOCKED)
- **Sem biblioteca de gráficos nova** — barras CSS simples (divs com altura/largura proporcional), padrão visual do projeto. Zero dependência nova.
- Evolução 12 meses: receita e custos variáveis derivam de `reports` (todas as OS já estão em memória no AdminContext — mesmo critério `criado_em` do calcularDRE). Despesas/deduções/resultado financeiro/particulares dos 12 meses: UMA leitura completa de cada coleção (sem `where` de mês) e agregação client-side — coleções pequenas, aceitável; NÃO fazer 12×4 queries.
- Lógica pura de agregação (entradas/saídas do mês, série de 12 meses) em utilitário testável (`utils/fluxoCaixa.js`) com testes Vitest — padrão das Fases 7-9.
- SEM coleção nova, SEM firestore.rules novas (todas as coleções lidas já têm regra).
- Compat legado na leitura: nota paga sem `pago_em` (improvável) usa `data_prevista`/emissão como fallback documentado; despesa paga sem `data_pagamento` não entra no caixa.

### Onde vive na UI (LOCKED)
- Nova aba interna "💵 Caixa" no FinanceiroEmpresaTab (mesmo padrão das abas dre/despesas/particulares/impostos/faturamento/tecnicos).
- Gráfico de 12 meses dentro da mesma aba, abaixo do resumo do mês.

### Claude's Discretion
- Layout das barras (uma barra por mês com tooltip/label de valor; margem pode ser linha de texto sob cada barra).
- Detalhamento das entradas/saídas (lista dos itens que compõem cada total — recomendado, expansível).
- Aprendizados: empty states explicativos ("Nenhuma entrada registrada — marque notas como pagas na aba Faturamento").

</decisions>

<canonical_refs>
## Canonical References

- `mp-react/src/components/admin/FinanceiroEmpresaTab.jsx` — abas internas, mesRef, calcularDRE (critério de receita/custos por mês), carregarDados (padrão de leitura de coleções).
- `mp-react/src/components/admin/faturamento/AbaFaturamento.jsx` — notasFiscais shape (total, pago_em, status).
- `mp-react/src/components/admin/fechamento/AbaFechamentoTecnicos.jsx` — fechamentosTecnicos shape (total, pago_em, mes_referencia).
- `mp-react/src/utils/fechamentoTecnicos.js` / `faturamento.js` — padrão utilitário puro + testes.
- `CLAUDE.md` — decisões de teste.

</canonical_refs>

<specifics>
## Specific Ideas

- Usuário não técnico: "Entradas R$ X · Saídas R$ Y · Sobrou R$ Z no caixa" — linguagem direta.

</specifics>

<deferred>
## Deferred Ideas

- Conciliação bancária (OFX) — out of scope do milestone.
- Projeção de caixa futuro (contas a vencer + notas previstas) — boa ideia para v1.3, não pedido.

</deferred>

---

*Phase: 10-fluxo-de-caixa-e-evolucao*
*Context gathered: 2026-07-05*
