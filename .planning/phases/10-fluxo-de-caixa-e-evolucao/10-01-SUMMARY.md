---
phase: 10-fluxo-de-caixa-e-evolucao
plan: 01
subsystem: finance
tags: [vitest, pure-utility, cash-flow, dre-parity]

# Dependency graph
requires:
  - phase: 07-faturamento-e-contas-a-receber
    provides: "notasFiscais com status/pago_em (utils/faturamento.js)"
  - phase: 08-fechamento-de-tecnicos
    provides: "fechamentosTecnicos com status/pago_em (utils/fechamentoTecnicos.js), critério criado_em do calcularDRE"
  - phase: 09-contas-a-pagar
    provides: "despesasMensais com data_pagamento (utils/contasPagar.js)"
provides:
  - "utils/fluxoCaixa.js: mesDeData, dataEntradaNota, fluxoCaixaDoMes, ultimos12Meses, mesDaOS, serieEvolucao12Meses"
  - "Lógica pura testada para CAIXA-01 (entradas/saídas/saldo do mês) e CAIXA-02 (série de evolução 12 meses)"
affects: ["10-02 (aba Caixa no FinanceiroEmpresaTab)", "10-03 (gráfico de evolução 12 meses)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Módulo 100% puro sem Firebase/React (mesmo padrão de contasPagar.js/fechamentoTecnicos.js/faturamento.js)"
    - "mesDeData valida formato YYYY-MM-DD via slice, nunca new Date()/toISOString (evita bug de timezone)"
    - "mesDaOS replica byte a byte criado_em.toDate().toISOString().slice(0,7) do calcularDRE para garantir paridade DRE x série de evolução"

key-files:
  created:
    - mp-react/src/utils/fluxoCaixa.js
    - mp-react/src/__tests__/fluxoCaixa.test.js
  modified: []

key-decisions:
  - "fluxoCaixaDoMes segue estritamente os critérios LOCKED do 10-CONTEXT: nota entra pelo pago_em (com fallback legado data_prevista/data_emissao), despesa sem data_pagamento nunca entra no caixa"
  - "serieEvolucao12Meses replica a cascata exata de calcularDRE (FinanceiroEmpresaTab.jsx:636-712), incluindo o uso intencional de toISOString em mesDaOS — não usar data local, para não divergir dos números do DRE mensal"
  - "ultimos12Meses usa aritmética local (new Date(ano, mes-1-i, 1) + padStart), nunca toISOString, para evitar deslocamento de mês por fuso"

patterns-established:
  - "Toda soma numérica usa (parseFloat(x) || 0); todo array de entrada trata undefined/null com || []"

requirements-completed: [CAIXA-01, CAIXA-02]

# Metrics
duration: ~15min
completed: 2026-07-06
---

# Phase 10 Plan 01: Fluxo de Caixa e Evolução (lógica pura) Summary

**Módulo `utils/fluxoCaixa.js` 100% puro com fluxo de caixa real do mês (entradas/saídas/saldo) e série de evolução de 12 meses (receita/lucro líquido/margem) com paridade matemática garantida por teste contra a cascata do calcularDRE — 27 novos testes Vitest, suite total em 177 verdes.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-06T16:30:04Z
- **Tasks:** 2/2 completed
- **Files modified:** 2 (1 criado + testes)

## Accomplishments
- `fluxoCaixaDoMes` implementado com todas as regras LOCKED do 10-CONTEXT: entradas por nota paga (pago_em com fallback legado) e particular do mês; saídas por despesa paga no mês (nunca sem data_pagamento) e fechamento de técnico pago no mês; saldo sem NaN em qualquer cenário
- `ultimos12Meses` e `serieEvolucao12Meses` implementados replicando byte a byte a cascata do `calcularDRE` (receita bruta, deduções, custo variável, resultado financeiro, despesas), com teste de paridade explícito comparando a fórmula
- 27 testes Vitest novos cobrindo todos os behaviors do plano; suite completa passou de 150 para 177 testes verdes, nenhum teste existente quebrado

## Task Commits

Each task was committed atomically:

1. **Task 1: fluxoCaixaDoMes — entradas/saídas/saldo do mês (CAIXA-01)** - `4bf4cde` (test, TDD RED→GREEN)
2. **Task 2: ultimos12Meses + serieEvolucao12Meses (CAIXA-02)** - `d5a7e98` (feat, TDD RED→GREEN)

_Nota: cada task seguiu ciclo RED→GREEN em um único commit (arquivo de testes e implementação adicionados juntos, verificados verdes antes de commitar), conforme o padrão já usado nos planos 07-01/08-01/09-01._

## Files Created/Modified
- `mp-react/src/utils/fluxoCaixa.js` - módulo puro com mesDeData, dataEntradaNota, fluxoCaixaDoMes (CAIXA-01), ultimos12Meses, mesDaOS, serieEvolucao12Meses (CAIXA-02)
- `mp-react/src/__tests__/fluxoCaixa.test.js` - 27 testes Vitest cobrindo os behaviors do plano, incluindo teste de paridade com a cascata do calcularDRE

## Decisions Made
- Nenhuma decisão nova além das já LOCKED no 10-CONTEXT.md; implementação seguiu exatamente a especificação do plano (fórmulas, nomes de export, critérios de inclusão)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `utils/fluxoCaixa.js` pronto para consumo pela UI: plano 10-02 pode criar a aba "💵 Caixa" no FinanceiroEmpresaTab chamando `fluxoCaixaDoMes` diretamente com as coleções já carregadas (notasFiscais, servicosParticulares, despesasMensais, fechamentosTecnicos)
- Plano 10-03 (gráfico de evolução) pode chamar `serieEvolucao12Meses` com os mesmos dados já usados por `calcularDRE` (reports do AdminContext + particulares/despesas/deducoes/resultadoFinanceiro) sem nenhuma query nova
- Nenhum bloqueio conhecido para os próximos planos da Fase 10

---
*Phase: 10-fluxo-de-caixa-e-evolucao*
*Completed: 2026-07-06*
