---
phase: 11-exportacao-e-fechamento-do-mes
plan: 03
subsystem: financeiro
tags: [firestore, react, client-side-guard, ux]

# Dependency graph
requires:
  - phase: 11-exportacao-e-fechamento-do-mes (11-02)
    provides: "Regra Firestore fechamentosMes deployada + helpers puros estaFechado(doc)/formatarFechadoEm(v)"
provides:
  - "Estado mesFechado no FinanceiroEmpresaTab.jsx: leitura do doc fechamentosMes a cada troca de mês"
  - "Botão de cadeado (🔒 Fechar mês / 🔓 Reabrir mês) no cabeçalho do Financeiro"
  - "Banner explicativo 'Mês fechado em DD/MM/AAAA — reabra para alterar'"
  - "Guardas if (mesFechado) em todos os handlers de escrita (Despesas, Particulares, Impostos, Financeiro, Técnicos)"
  - "Botões de adicionar/editar/excluir/pagar ocultos ou desabilitados (title='Mês fechado') nas sub-abas quando o mês está travado"
affects: [fechamento-do-mes, financeiro-encerramento-mensal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guarda dupla: defesa central no handler (early-return com toast) + desabilitação/ocultação visual do botão — mesmo padrão de outras travas client-side do projeto (T-08-12)"

key-files:
  created: []
  modified:
    - mp-react/src/components/admin/FinanceiroEmpresaTab.jsx
    - mp-react/src/components/admin/fechamento/AbaFechamentoTecnicos.jsx
    - mp-react/src/index.css

key-decisions:
  - "Enforcement de mês fechado é 100% client-side (risco aceito, single-admin) — mesmo precedente documentado em T-08-12/T-11-04; reabrir é ação intencional e confirmada, não é proteção contra usuário malicioso"
  - "Faturamento (AbaFaturamento) NÃO recebe a prop mesFechado — a nota é emitida por seguradora com calendário próprio, não por mês de competência; decisão documentada em comentário no JSX"
  - "fecharMes/reabrirMes gravam fechado_em/reaberto_em via serverTimestamp para trilha de auditoria (T-11-05), mesmo sem enforcement server-side"
  - "Guarda if (mesFechado) replicada no início de TODOS os handlers de escrita (salvar*/excluir*/pagarMensal/autoLancarFixas/marcarPago), não apenas na desabilitação visual — defesa robusta contra qualquer botão que escape da UI"

patterns-established:
  - "Para novas travas de edição: par (guarda no handler + disabled/hidden no botão com title explicativo) replicável em futuras seções do Financeiro"

requirements-completed: [EXP-02]

# Metrics
duration: ~10min
completed: 2026-07-06
---

# Phase 11 Plan 03: Fechar/Reabrir Mês — Cadeado, Banner e Guardas de Escrita Summary

**Botão de cadeado no cabeçalho do Financeiro que fecha/reabre o mês selecionado, com banner explicativo e bloqueio de todos os handlers de escrita (despesas, particulares, impostos, resultado financeiro e fechamento de técnicos) enquanto o mês estiver travado — Faturamento permanece sempre operável.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-06
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `FinanceiroEmpresaTab.jsx` lê `empresas/{empresaId}/fechamentosMes/{mesRef}` a cada troca de mês (dentro de `carregarDados`) e deriva `mesFechado` via `estaFechado(fechamentoMes)` (helper puro do Plano 02)
- Botão de cadeado no cabeçalho (`fin-periodo`): `🔒 Fechar mês` grava `{ fechado: true, fechado_em: serverTimestamp() }`; `🔓 Reabrir mês` grava `{ fechado: false, reaberto_em: serverTimestamp() }` via merge — ambos com `window.confirm` explicativo
- Banner `🔒 Mês fechado em DD/MM/AAAA — reabra para alterar` exibido acima das abas quando o mês está travado
- Guarda `if (mesFechado) { showToast(...); return }` adicionada no início de 11 handlers de escrita: `autoLancarFixas`, `salvarRecorrente`, `excluirRecorrente`, `salvarMensal`, `excluirMensal`, `pagarMensal`, `salvarParticular`, `excluirParticular`, `salvarDeducao`, `excluirDeducao`, `salvarResultFin`, `excluirResultFin` (12 ocorrências no grep, incluindo `marcarPago` em `AbaFechamentoTecnicos.jsx`)
- Botões de "adicionar" (+ Nova, + Avulso, + Novo Serviço, + Lançar Imposto, + Lançar Taxa/Juro) ocultos com o mês fechado; ações inline (✏️ editar, 🗑️ excluir, ✓ Pagar, 💵 Marcar como pago) desabilitadas com `title="Mês fechado"`
- Banner de auto-lançamento de fixas e alerta de "lançar rapidamente" não renderizam com o mês fechado (evita induzir uma gravação)
- Faturamento permanece 100% operável — comentário no código explica que a nota é emitida por seguradora, não por mês de competência
- Suite mantida em 197 testes verdes (nenhum teste novo necessário — comportamento coberto por verificação manual/grep conforme `<verification>` do plano); build sem erro

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Estado mesFechado + botão cadeado (fechar/reabrir) + banner** - `7af4192` (feat)
2. **Task 2: Guardas de escrita + desabilitar botões nas sub-abas (inclui Técnicos)** - `af40106` (feat)

**Plan metadata:** (próximo commit desta sessão)

## Files Created/Modified
- `mp-react/src/components/admin/FinanceiroEmpresaTab.jsx` - imports `getDoc/setDoc` + `estaFechado/formatarFechadoEm`; estado `fechamentoMes`/`mesFechado`; leitura em `carregarDados`; `fecharMes()`/`reabrirMes()`; botão de cadeado + banner no cabeçalho; guarda `if (mesFechado)` em 11 handlers; prop `mesFechado` passada para `AbaDespesas`, `AbaParticulares`, `AbaImpostosFinanceiro`, `AbaFechamentoTecnicos`; botões condicionais/desabilitados nas três sub-abas locais e em `ItemRecorrente`
- `mp-react/src/components/admin/fechamento/AbaFechamentoTecnicos.jsx` - prop `mesFechado`; guarda em `marcarPago`; botão "💵 Marcar como pago" desabilitado com `title="Mês fechado"` quando travado
- `mp-react/src/index.css` - `.fin-cadeado-btn` (+ variante `.fechado`) e `.fin-banner-fechado`

## Decisions Made
Ver `key-decisions` no frontmatter.

## Deviations from Plan

None - plano executado exatamente como escrito. A única adaptação de execução (não de comportamento) foi dividir as edições de `FinanceiroEmpresaTab.jsx` em dois commits (Task 1 = estado/botão/banner; Task 2 = guardas/props/desabilitação), revertendo e reaplicando os patches por camada para manter a atomicidade por task apesar de as edições estarem entrelaçadas no mesmo arquivo — sem impacto no resultado final.

## Issues Encountered

None.

## User Setup Required

None - nenhuma configuração de serviço externo necessária (a regra Firestore já foi deployada no Plano 02).

## Next Phase Readiness

- EXP-02 completo. Phase 11 (Exportação e Fechamento do Mês) 100% concluída (3/3 planos).
- **Milestone v1.2 Financeiro Completo 100% concluído** — 20/20 requisitos (FAT-01..10, TEC-01..03, PAG-01..03, CAIXA-01..02, EXP-01..02), 18/18 planos executados desde a Phase 7.
- Suite total mantida em 197 testes verdes, build sem erro.
- Nenhum bloqueio conhecido. Próximo passo é decisão do usuário sobre o escopo do próximo milestone (v1.3) — candidatos já listados em REQUIREMENTS.md > Future Requirements (FAT-11 calendário Tempo/Maxpar, CHK-01 checklists por tipo de serviço, GPS-01 rastreamento) e no CLAUDE.md (extração Mapfre na extensão Chrome).

---
*Phase: 11-exportacao-e-fechamento-do-mes*
*Completed: 2026-07-06*

## Self-Check: PASSED

- FOUND: .planning/phases/11-exportacao-e-fechamento-do-mes/11-03-SUMMARY.md
- FOUND commit: 7af4192
- FOUND commit: af40106
