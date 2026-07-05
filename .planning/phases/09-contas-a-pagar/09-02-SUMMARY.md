---
phase: 09-contas-a-pagar
plan: 02
subsystem: financeiro
tags: [react, firestore, contas-a-pagar, vencimento]

# Dependency graph
requires:
  - phase: 09-contas-a-pagar
    provides: "utils/contasPagar.js: dataVencimentoDoMes (clamp de fim de mês) — plano 09-01"
provides:
  - "FinanceiroEmpresaTab.jsx: campo dia_vencimento no cadastro de despesa recorrente (form + modal + salvar/editar)"
  - "FinanceiroEmpresaTab.jsx: campo data_vencimento no lançamento mensal (form + modal + salvar/editar)"
  - "autoLancarFixas preenchendo data_vencimento do mês via dataVencimentoDoMes(dia_vencimento, mesRef)"
affects: [09-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Campos de vencimento seguem o mesmo padrão de compat legado dos planos anteriores: ausente no Firestore vira '' (string) ou null (número) na leitura/edição"
    - "Cálculo de data derivado de util puro (dataVencimentoDoMes) chamado no momento da escrita (auto-lançamento), não na leitura"

key-files:
  created: []
  modified:
    - mp-react/src/components/admin/FinanceiroEmpresaTab.jsx

key-decisions:
  - "dia_vencimento gravado como Number() quando preenchido, null quando vazio — nunca string vazia persistida no Firestore"
  - "data_vencimento e data_pagamento exibidos lado a lado no ModalLancamentoMensal com rótulos 'Vence em' / 'Pago em' para deixar claro ao admin não técnico a diferença"
  - "dia_vencimento visível para ambos os tipos (fixa/variável) sem lógica condicional extra, per CONTEXT — só é consumido pelo auto-lançamento de fixas"

patterns-established: []

requirements-completed: [PAG-01, PAG-03]

# Metrics
duration: ~10min
completed: 2026-07-05
---

# Phase 9 Plan 2: Caminho de escrita de vencimento em Contas a Pagar Summary

**Campos dia_vencimento (recorrente) e data_vencimento (mensal) adicionados ao FinanceiroEmpresaTab.jsx, com auto-lançamento de fixas preenchendo automaticamente a data_vencimento do mês via dataVencimentoDoMes — suíte permanece em 150 testes verdes.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-05
- **Tasks:** 2/2
- **Files modified:** 1

## Accomplishments
- Cadastro de despesa recorrente aceita e grava `dia_vencimento` (1–31, opcional), repovoado corretamente na edição
- Lançamento mensal aceita e grava `data_vencimento`, exibido lado a lado com `data_pagamento` ("Vence em" / "Pago em")
- `autoLancarFixas` calcula `data_vencimento` do mês a partir do `dia_vencimento` cadastrado via `dataVencimentoDoMes` (com clamp de fim de mês herdado do plano 09-01) — entrega PAG-03
- Suite total permanece verde: 150 testes (nenhum teste renderiza FinanceiroEmpresaTab inteiro, mudança de UI segura)

## Task Commits

Cada task foi commitada individualmente:

1. **Task 1: dia_vencimento no cadastro de despesa recorrente (form + modal + salvar/editar)** - `d550b57` (feat)
2. **Task 2: data_vencimento no lançamento mensal + auto-lançamento de fixas preenchendo vencimento** - `c19cc94` (feat)

**Plan metadata:** (commit final desta execução, ver git log)

## Files Created/Modified
- `mp-react/src/components/admin/FinanceiroEmpresaTab.jsx` - dia_vencimento no cadastro/edição de despesa recorrente; data_vencimento no lançamento mensal; import e chamada de dataVencimentoDoMes em autoLancarFixas

## Decisions Made
- dia_vencimento gravado como Number() ou null (nunca string vazia) para manter o Firestore limpo e compatível com o clamp de dataVencimentoDoMes
- Campos "Vence em" / "Pago em" lado a lado no ModalLancamentoMensal para reduzir ambiguidade para o usuário não técnico
- dia_vencimento fica visível para despesas fixas e variáveis sem lógica condicional extra (só é usado pelo auto-lançamento de fixas), conforme CONTEXT.md

## Deviations from Plan

None - plan executado exatamente como escrito.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Caminho de escrita completo: despesas recorrentes e mensais já persistem vencimento, e o auto-lançamento de fixas já entra no mês com data_vencimento preenchida
- Pronto para o plano 09-03 (caminho de leitura: badges de status, botão Pagar, banner de alertas) consumir statusDespesa/resumoAlertas de contasPagar.js sobre os dados agora persistidos
- Nenhum bloqueio identificado

---
*Phase: 09-contas-a-pagar*
*Completed: 2026-07-05*

## Self-Check: PASSED

- FOUND: mp-react/src/components/admin/FinanceiroEmpresaTab.jsx
- FOUND commit: d550b57
- FOUND commit: c19cc94
