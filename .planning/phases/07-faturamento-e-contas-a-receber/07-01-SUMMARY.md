---
phase: 07-faturamento-e-contas-a-receber
plan: 01
subsystem: financeiro
tags: [vitest, calendar, pure-function, faturamento]

# Dependency graph
requires: []
provides:
  - "Módulo puro utils/faturamento.js com regras de calendário Mapfre/Allianz/Mondial"
  - "calcularDataPrevista, proximoDiaUtil, getDivergenciaFat, digitosCodigo, getRegrasFaturamento"
  - "Suite Vitest com 27 testes cobrindo calendário, dia útil, divergência e grupos de seguradora"
affects: [07-02, 07-03, 07-04, 07-05, ConfigTab, FinanceiroEmpresaTab, DetalheOSModal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "getX(config, seguradora) com fallback para constante PADRAO — mesmo padrão de utils/tarifas.js"
    - "Função pura de cálculo de data sem toISOString (evita bug de timezone), formatação manual YYYY-MM-DD"

key-files:
  created:
    - mp-react/src/utils/faturamento.js
    - mp-react/src/__tests__/faturamento.test.js
  modified: []

key-decisions:
  - "Mondial usa o mesmo objeto de calendário da Allianz (alias direto), evitando duplicação de faixas"
  - "Guard de dataEmissao vazia/inválida retorna semCalendario:true em vez de lançar exceção (T-07-01)"

patterns-established:
  - "Regras de calendário por seguradora como array de faixas { diaDe, diaAte, addMeses, diaPagto } ou { diaDe, diaAte, naoFaturavel:true } — extensível via ConfigTab sem mudar código"

requirements-completed: [FAT-07, FAT-08]

# Metrics
duration: 12min
completed: 2026-07-02
---

# Phase 7 Plan 1: Módulo de Faturamento (calendário e divergência) Summary

**Módulo puro `utils/faturamento.js` com calendário de pagamento Mapfre (3 faixas) e Allianz/Mondial (5 faixas, incluindo período não-faturável 26–31), ajuste automático para próximo dia útil e cálculo de divergência de valor — 27 testes Vitest verdes.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-02T23:00:00Z (aprox.)
- **Completed:** 2026-07-02T23:13:35Z
- **Tasks:** 2/2
- **Files modified:** 2 (ambos criados)

## Accomplishments
- Calendário de pagamento LOCKED da Mapfre e Allianz/Mondial implementado como dados puros (faixas de dia), editável futuramente via `config.calendarioFaturamento` sem mudança de código
- `proximoDiaUtil` empurra sábado/domingo para segunda-feira (feriados deliberadamente fora de escopo, conforme CONTEXT.md deferred)
- Aviso de período não-faturável da Allianz (dias 26–31, FAT-08) sinalizado via `naoFaturavel:true` sem quebrar o fluxo
- `getDivergenciaFat` fornece a base numérica para o destaque verde/vermelho de valor código-vs-OS (Mapfre/Allianz)
- `digitosCodigo` corrige o bug latente do DetalheOSModal que usava padrão errado de dígitos para Tempo

## Task Commits

Each task was committed atomically:

1. **Task 1: Criar utils/faturamento.js com regras de calendário e funções puras** - `53615e1` (feat)
2. **Task 2: Criar suite Vitest de faturamento.test.js** - `53aeda6` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `mp-react/src/utils/faturamento.js` - Constantes de agrupamento de seguradora, calendário padrão Mapfre/Allianz/Mondial, `getRegrasFaturamento`, `calcularDataPrevista`, `proximoDiaUtil`, `getDivergenciaFat`, `digitosCodigo`
- `mp-react/src/__tests__/faturamento.test.js` - 27 testes Vitest cobrindo todos os casos de calendário, guards de data inválida, dia útil, divergência, dígitos de código e grupos de seguradora

## Decisions Made
- Mondial aponta para o mesmo objeto `REGRAS_FATURAMENTO_PADRAO.Allianz` (alias, não cópia) — se o calendário da Allianz mudar, Mondial acompanha automaticamente (comportamento correto pois LOCKED diz "Mondial usa o mesmo calendário da Allianz")
- Formatação de data usa helper local `fmtISO` com `padStart` em vez de `toISOString()`, evitando o bug clássico de timezone (UTC vs local) em cálculos de data

## Deviations from Plan

None - plan executado exatamente como escrito. Único ajuste cosmético: reescrita do comentário de cabeçalho para não conter literalmente a string "import...firebase" (o texto original mencionava firebase apenas em prosa, mas colidia com o grep de acceptance criteria que verifica ausência de import real; o código nunca teve import de firebase).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Módulo `utils/faturamento.js` pronto para ser consumido por: ConfigTab (editar `calendarioFaturamento`), fila de faturamento (usar `getDivergenciaFat` e `digitosCodigo`), e fluxo "Fechar Nota" (usar `calcularDataPrevista`)
- Nenhum bloqueio identificado para os próximos planos da Phase 7 (fila de faturamento, códigos na OS, notas/faturas, painel-resumo)

---
*Phase: 07-faturamento-e-contas-a-receber*
*Completed: 2026-07-02*
