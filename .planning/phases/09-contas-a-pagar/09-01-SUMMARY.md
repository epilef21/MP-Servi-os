---
phase: 09-contas-a-pagar
plan: 01
subsystem: financeiro
tags: [vitest, contas-a-pagar, vencimento, status-derivado]

# Dependency graph
requires:
  - phase: 07-faturamento-e-contas-a-receber
    provides: "Padrão de módulo puro + helper fmtISO local (faturamento.js) e status derivado nunca gravado (fechamentoTecnicos.js)"
provides:
  - "utils/contasPagar.js: statusDespesa, diasParaVencer, dataVencimentoDoMes, resumoAlertas"
  - "Suíte de testes contasPagar.test.js (21 testes) cobrindo status, clamp de fim de mês, dias e resumo de alertas"
affects: [09-02, 09-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Módulo 100% puro sem Firebase/React, testável isoladamente (mesmo padrão de faturamento.js e fechamentoTecnicos.js)"
    - "Status sempre DERIVADO na leitura, nunca gravado no Firestore"
    - "Comparação de datas 'YYYY-MM-DD' via Date.UTC (evita bug de timezone/DST do toISOString)"

key-files:
  created:
    - mp-react/src/utils/contasPagar.js
    - mp-react/src/__tests__/contasPagar.test.js
  modified: []

key-decisions:
  - "diasParaVencer usa Date.UTC(y, m-1, d) para os dois lados da subtração, evitando qualquer viés de fuso/DST"
  - "dataVencimentoDoMes faz clamp com new Date(ano, mes, 0).getDate() + Math.min, igual ao padrão documentado no CONTEXT.md"
  - "statusDespesa trata despesa sem data_vencimento como nunca-atrasado (compat legado) — só pode ser 'pago' ou 'pendente'"

patterns-established:
  - "Pattern: utilitário de vencimento puro consumido por telas/planos futuros (09-02, 09-03) sem acoplamento a Firebase"

requirements-completed: [PAG-01, PAG-02, PAG-03]

# Metrics
duration: ~8min
completed: 2026-07-05
---

# Phase 9 Plan 1: Utilitário de vencimento e status de Contas a Pagar Summary

**Módulo puro `contasPagar.js` com statusDespesa/diasParaVencer/dataVencimentoDoMes (clamp de fim de mês)/resumoAlertas, coberto por 21 testes Vitest — suíte total sobe de 129 para 150 testes verdes.**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-07-05
- **Tasks:** 2/2
- **Files modified:** 2 (ambos criados)

## Accomplishments
- Lógica de vencimento/status das despesas extraída para módulo puro, sem dependência de Firebase/React
- Clamp de fim de mês implementado e testado para todos os casos de borda (mês de 30 dias, fevereiro comum e bissexto)
- resumoAlertas pronto para alimentar o painel de alertas dos planos de UI (09-02, 09-03)
- Suite total permanece verde: 150 testes (129 anteriores + 21 novos)

## Task Commits

Cada task foi commitada individualmente:

1. **Task 1: Criar utils/contasPagar.js com as funções puras de vencimento/status** - `264b1f5` (feat)
2. **Task 2: Escrever contasPagar.test.js cobrindo status, clamp, dias e resumo** - `4edd1f6` (test)

**Plan metadata:** (commit final desta execução, ver git log)

## Files Created/Modified
- `mp-react/src/utils/contasPagar.js` - statusDespesa, diasParaVencer, dataVencimentoDoMes, resumoAlertas (módulo puro)
- `mp-react/src/__tests__/contasPagar.test.js` - 21 testes cobrindo status, clamp de fim de mês, dias para vencer e resumo de alertas

## Decisions Made
- diasParaVencer usa Date.UTC nos dois lados para evitar bug de timezone/DST (mesma cautela de calcularDataPrevista da Fase 7)
- dataVencimentoDoMes clampa com `new Date(ano, mes, 0).getDate()` + `Math.min`, exatamente como especificado no plano
- statusDespesa trata ausência de data_vencimento como nunca-atrasado (compat com lançamentos antigos sem vencimento cadastrado)

## Deviations from Plan

None - plan executado exatamente como escrito.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `contasPagar.js` pronto para ser consumido pelos planos 09-02 (UI de despesas com vencimento) e 09-03 (painel de alertas)
- Nenhum bloqueio identificado

---
*Phase: 09-contas-a-pagar*
*Completed: 2026-07-05*
