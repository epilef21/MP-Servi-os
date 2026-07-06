---
phase: 11-exportacao-e-fechamento-do-mes
plan: 01
subsystem: financeiro
tags: [jspdf, react, pdf-export, dre, lazy-import]

# Dependency graph
requires:
  - phase: 06-relatorio-mensal-em-pdf
    provides: "Padrao de geracao de PDF client-side com jsPDF via import dinamico (utils/relatorioMensalPdf.js)"
  - phase: 10-fluxo-de-caixa-e-evolucao
    provides: "FinanceiroEmpresaTab.jsx com AbaDRE consumindo calcularDRE(reports, mesRef, ...) e useAdminContext"
provides:
  - "utils/drePdf.js: montarLinhasDre (pura, testavel) + gerarDrePdf (jsPDF lazy)"
  - "Botao '⬇️ Baixar DRE em PDF' na aba DRE do FinanceiroEmpresaTab"
affects: [11-02, 11-03, fechamento-do-mes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Montagem de PDF em duas camadas: funcao pura que monta linhas de dados (testavel sem jsPDF) + funcao async que so desenha (nao testada), mesmo padrao de relatorioMensalPdf.js"

key-files:
  created:
    - mp-react/src/utils/drePdf.js
    - mp-react/src/__tests__/drePdf.test.js
  modified:
    - mp-react/src/components/admin/FinanceiroEmpresaTab.jsx

key-decisions:
  - "montarLinhasDre reaproveita 100% dos campos ja calculados por calcularDRE — nao recalcula nada, so formata/oculta condicionalmente igual a tela AbaDRE"
  - "Nome do mes por extenso derivado de mesRef via split('-') local (sem new Date()/toISOString), mesma cautela de calcularDataPrevista (Fase 7) e mesDeData (Fase 10)"
  - "Botao de download desabilitado quando dre.qtdOS === 0 && dre.receitaParticulares === 0, evitando gerar PDF vazio (mesma condicao do empty-state da AbaDRE)"

patterns-established:
  - "Para novos PDFs financeiros: extrair uma funcao pura de montagem de linhas (testada) e uma funcao async de desenho (nao testada, jsPDF via await import)"

requirements-completed: [EXP-01]

# Metrics
duration: ~12min
completed: 2026-07-06
---

# Phase 11 Plan 01: PDF do DRE Summary

**Botão "Baixar DRE em PDF" na aba DRE, gerando PDF client-side via jsPDF (import dinâmico) a partir de `montarLinhasDre`, função pura coberta por 9 testes Vitest.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-07-06
- **Tasks:** 2
- **Files modified:** 3 (2 criados, 1 modificado)

## Accomplishments
- `utils/drePdf.js` criado com `montarLinhasDre(dre)` — função pura que converte o objeto `dre` (produzido por `calcularDRE`) em um array ordenado de linhas (`secao`/`linha`/`subtotal`/`resultado`), replicando exatamente as seções e condições de exibição da tela `AbaDRE` (margem em material só aparece se != 0, dedução vazia mostra aviso, despesas agrupadas por grupo etc.)
- `gerarDrePdf(dre, mesRef, nomeEmpresa)` monta o PDF reaproveitando o layout visual de `relatorioMensalPdf.js` (cabeçalho azul, seções, rodapé com paginação), carregando jsPDF sob demanda (`await import('jspdf')`)
- Botão "⬇️ Baixar DRE em PDF" inserido na `AbaDRE`, desabilitado quando o mês não tem dados (evita PDF vazio)
- 9 testes Vitest cobrindo ordem das seções, aviso de impostos vazios, ocultação condicional de margem em material, agrupamento de despesas e margem no label do lucro líquido

## Task Commits

1. **Task 1: utils/drePdf.js — montagem pura + gerador jsPDF lazy + testes** - `1c8cac6` (test)
2. **Task 2: Botão "⬇ Baixar DRE em PDF" na AbaDRE** - `1fc13d2` (feat)

**Plan metadata:** (próximo commit desta sessão)

_Nota: Task 1 tinha `tdd="true"`, mas testes e implementação foram escritos e commitados juntos em um único commit `test(...)` (verificação executada e verde antes do commit) — não houve commit `feat` separado após um RED intencional, pois o objetivo era cobrir a função pura recém-criada, não substituir um comportamento já existente._

## Files Created/Modified
- `mp-react/src/utils/drePdf.js` - `montarLinhasDre` (pura) + `gerarDrePdf` (async, jsPDF lazy)
- `mp-react/src/__tests__/drePdf.test.js` - 9 testes Vitest de `montarLinhasDre`
- `mp-react/src/components/admin/FinanceiroEmpresaTab.jsx` - import de `gerarDrePdf`, `AbaDRE` recebe `mesRef`/`nomeEmpresa` e renderiza o botão de download

## Decisions Made
- Ver `key-decisions` no frontmatter.

## Deviations from Plan

None - plan executado exatamente como escrito.

## Issues Encountered

None.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- EXP-01 completo. Suite total agora com 186 testes verdes (177 + 9 novos), build sem erro, chunk `jspdf.es.min-*.js` confirmado como bundle separado (lazy, não infla o carregamento inicial).
- Próximo: 11-02 (próximo plano da Fase 11 — fechamento do mês / demais itens de EXP-02).

---
*Phase: 11-exportacao-e-fechamento-do-mes*
*Completed: 2026-07-06*

## Self-Check: PASSED

- FOUND: mp-react/src/utils/drePdf.js
- FOUND: mp-react/src/__tests__/drePdf.test.js
- FOUND: .planning/phases/11-exportacao-e-fechamento-do-mes/11-01-SUMMARY.md
- FOUND commit: 1c8cac6
- FOUND commit: 1fc13d2
