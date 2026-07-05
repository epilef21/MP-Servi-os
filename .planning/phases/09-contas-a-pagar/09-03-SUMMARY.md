---
phase: 09-contas-a-pagar
plan: 03
subsystem: financeiro
tags: [react, firestore, contas-a-pagar, vencimento, alertas]

# Dependency graph
requires:
  - phase: 09-contas-a-pagar
    provides: "utils/contasPagar.js: statusDespesa/diasParaVencer/resumoAlertas (plano 09-01) e campos data_vencimento/dia_vencimento gravaveis (plano 09-02)"
provides:
  - "FinanceiroEmpresaTab.jsx: badge de status pendente/pago/atrasado + mensagem de dias por despesa mensal"
  - "FinanceiroEmpresaTab.jsx: botao '✓ Pagar' gravando data_pagamento=hoje apos confirmacao"
  - "FinanceiroEmpresaTab.jsx: banner de alerta no topo (qualquer aba interna) somando contas a vencer em <=7 dias e atrasadas"
affects: [10-fluxo-de-caixa]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Status sempre derivado na leitura (statusDespesa/diasParaVencer), nunca gravado no Firestore"
    - "hojeISO() local com padStart (mesmo padrao de mesAtual()), nunca toISOString, evitando bug de timezone/DST"
    - "Banner de alertas no render principal, antes do switch de aba interna, garantindo visibilidade global"

key-files:
  created: []
  modified:
    - mp-react/src/components/admin/FinanceiroEmpresaTab.jsx
    - mp-react/src/index.css

key-decisions:
  - "resumoAlertas calculado apenas sobre despesasMensais do mes corrente ja carregado (sem query extra) — discricao aceita e documentada no threat model (T-09-08)"
  - "ehPend (variavel sem valor lancado) continua tendo prioridade visual sobre o status derivado — badge '⚠️ Pendente' legado preservado para nao confundir o admin com dois conceitos de 'pendente'"
  - "Botao '✓ Pagar' ocultado quando status já é 'pago' (evita reabrir confirmacao em despesa ja quitada)"

patterns-established:
  - "Pattern: banner de alerta financeiro agregado (contas a vencer/atrasadas) reaproveitando o estilo do .despesa-alerta existente, mas com classe propria (.fin-alerta-contas) para nao colidir"

requirements-completed: [PAG-01, PAG-02]

# Metrics
duration: ~12min
completed: 2026-07-05
---

# Phase 9 Plan 3: Caminho de leitura de Contas a Pagar (badges, botão Pagar, banner de alertas) Summary

**FinanceiroEmpresaTab.jsx agora exibe badge de status (pendente/pago/atrasado) com mensagem de dias por despesa, botão "✓ Pagar" que grava data_pagamento=hoje, e um banner no topo do Financeiro somando contas a vencer em até 7 dias e atrasadas — suíte permanece em 150 testes verdes.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-07-05
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments
- Cada lançamento mensal exibe badge de status derivado (`statusDespesa`) com mensagem direta ao admin: "Vence em N dia(s)", "Vence hoje" ou "Atrasada há N dia(s)"
- Botão "✓ Pagar" grava `data_pagamento = hoje` após `window.confirm`, some quando a despesa já está paga
- Banner `.fin-alerta-contas` no topo do Financeiro (fora do switch de abas) soma contas a vencer em ≤7 dias e atrasadas, com botão "Ver despesas" que leva direto à aba Despesas
- Fase 9 (Contas a Pagar) 100% concluída: PAG-01 e PAG-02 completos, PAG-03 já entregue no plano 09-02
- Suite total permanece verde: 150 testes (nenhum teste renderiza FinanceiroEmpresaTab inteiro — mudança de UI segura)

## Task Commits

Cada task foi commitada individualmente:

1. **Task 1: Badge de status + mensagem de vencimento + botão Pagar no item da despesa** - `38f8f85` (feat)
2. **Task 2: Banner de alerta de contas (PAG-02) no topo do Financeiro** - `e7d3dcd` (feat)

**Plan metadata:** (commit final desta execução, ver git log)

## Files Created/Modified
- `mp-react/src/components/admin/FinanceiroEmpresaTab.jsx` - helper `hojeISO()`; handler `pagarMensal`; badge de status/dias e botão Pagar no item de `AbaDespesas`; cálculo `resumoAlertas` e banner `.fin-alerta-contas` no render principal
- `mp-react/src/index.css` - `.despesa-status-atrasado`, `.despesa-item.atrasado`, `.fin-alerta-contas`

## Decisions Made
- `resumoAlertas` roda apenas sobre `despesasMensais` do mês corrente já carregado (evita query extra cara) — decisão de discrição aceita no threat model (T-09-08), documentada aqui e no CONTEXT
- Comportamento legado `ehPend` (despesa variável sem valor lançado) mantido com prioridade visual sobre o status derivado, evitando dois conceitos distintos de "pendente" na mesma tela
- Botão "✓ Pagar" oculto quando `st === 'pago'`

## Deviations from Plan

None - plan executado exatamente como escrito.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Fase 9 (Contas a Pagar) 100% concluída: PAG-01, PAG-02, PAG-03 completos
- Dados de despesas pagas (data_pagamento preenchida) já ficam disponíveis para o Fluxo de Caixa (Fase 10)
- Nenhum bloqueio identificado

---
*Phase: 09-contas-a-pagar*
*Completed: 2026-07-05*

## Self-Check: PASSED

- FOUND: mp-react/src/components/admin/FinanceiroEmpresaTab.jsx
- FOUND: mp-react/src/index.css
- FOUND commit: 38f8f85
- FOUND commit: e7d3dcd
