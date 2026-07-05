---
phase: 08-fechamento-de-tecnicos
plan: 04
subsystem: financeiro
tags: [react, firestore, tecnicos, pagamento, historico]

# Dependency graph
requires:
  - phase: 08-fechamento-de-tecnicos
    provides: "Plano 01 — utils/fechamentoTecnicos.js (agrupamento por técnico, acharFechamento, statusFechamento)"
  - phase: 08-fechamento-de-tecnicos
    provides: "Plano 03 — AbaFechamentoTecnicos.jsx + regra fechamentosTecnicos deployada + placeholders de inserção"
provides:
  - "Botão 'Marcar como pago' em AbaFechamentoTecnicos.jsx: grava snapshot imutável (os_ids/total/qtd_os/pago_em) em empresas/{id}/fechamentosTecnicos"
  - "Bloqueio client-side de pagamento duplicado no mesmo mês (acharFechamento)"
  - "Seção 'Histórico de pagamentos' consultável por técnico, ordenada por mês desc"
affects: [10-fluxo-de-caixa]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Marcar-pago com prompt de data + confirm, seguindo o mesmo padrão de AbaFaturamento (Fase 7): snapshot imutável em vez de referência viva às OS"
    - "Histórico consultável renderiza sempre os campos do snapshot gravado, nunca recalcula das OS ao vivo (protege contra edição de valor_prestador depois do pagamento)"

key-files:
  created: []
  modified:
    - mp-react/src/components/admin/fechamento/AbaFechamentoTecnicos.jsx

key-decisions:
  - "Fonte de verdade do snapshot é sempre o GRUPO (agruparPorTecnico), nunca a OS direta — a OS não tem campo `tecnico`, só `tecnico_nome`/`tecnico_id`"
  - "Pagamento é imutável nesta versão: sem edição/estorno do fechamento (CONTEXT deferred)"
  - "Trava de pagamento duplo é client-side apenas (T-08-12 aceito) — mesmo precedente de notasFiscais na Fase 7, sem constraint de unicidade no Firestore"

patterns-established:
  - "Ação de fechamento financeiro (marcar pago + snapshot imutável + histórico consultável) reaplicável nas Fases 9/10/11 para outras entidades de pagamento"

requirements-completed: [TEC-03]

# Metrics
duration: ~8min
completed: 2026-07-05
---

# Phase 08 Plan 04: Marcar Pago + Histórico de Pagamentos Summary

**Botão "Marcar como pago" grava snapshot imutável (os_ids, total e quantidade de OS da época) em `fechamentosTecnicos`, bloqueia pagamento duplo no mesmo mês, e uma nova seção "Histórico de pagamentos" lista todos os fechamentos já pagos de qualquer mês, ordenados por mês/técnico, sem nunca recalcular valores a partir das OS ao vivo.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-05T18:28:58Z
- **Completed:** 2026-07-05T18:36:40Z
- **Tasks:** 2/2
- **Files modified:** 1

## Accomplishments
- `marcarPago(g)` grava em `empresas/{empresaId}/fechamentosTecnicos` um snapshot com `tecnico`, `tecnico_norm`, `mes_referencia`, `os_ids`, `total`, `qtd_os`, `status: 'pago'`, `pago_em` e `criado_em: serverTimestamp()` — todos os campos de identidade vêm do grupo (`g`), nunca lidos direto da OS (a OS não tem campo `tecnico`)
- Trava de pagamento duplo: `acharFechamento` é checado antes de abrir o prompt de data; se já existe fechamento pago para o técnico+mês, mostra toast de erro e não grava nada
- Fluxo de confirmação: `window.prompt` pede a data (default hoje, formato AAAA-MM-DD com validação de regex) e `window.confirm` confirma nome/valor/qtd de OS antes de gravar
- Card do técnico agora mostra o botão "💵 Marcar como pago" quando pendente, ou "✅ Pago em {data}" quando já pago; botão desabilitado durante o `addDoc` e quando o técnico não tem nome (grupos "sem técnico" não podem ser pagos)
- Nova seção "🗂️ Histórico de pagamentos" no fim do componente: deriva `historico` via `useMemo` ordenando por `mes_referencia` desc e depois por nome; renderiza sempre os campos do snapshot (`f.tecnico`, `f.total`, `f.qtd_os`, `f.pago_em`), garantindo que o histórico não mude se uma OS mudar de valor depois de paga
- Ambos os placeholders `{/* marcar pago + histórico: plano 08-04 */}` (no card e no fim do componente) foram removidos, incluindo a referência textual no comentário de cabeçalho do arquivo

## Task Commits

Each task was committed atomically:

1. **Task 1: Marcar fechamento do técnico como pago (snapshot imutável, sem pagar 2x)** - `1e00ad2` (feat)
2. **Task 2: Seção de histórico de pagamentos por técnico** - `b839b1f` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `mp-react/src/components/admin/fechamento/AbaFechamentoTecnicos.jsx` - Import de `addDoc`/`serverTimestamp` (firebase.js) e `fmtDate` (formatters.js); estado `pagando`; helper `hojeISO()`; handler `marcarPago(g)`; botão/selo condicional no card; `historico` (useMemo) + seção de histórico de pagamentos no fim do componente

## Decisions Made
- Fonte do snapshot é sempre o grupo (`g.tecnicoNome`, `g.tecnicoNorm`, `g.osList`, `g.total`, `g.count`) — nunca a OS direta, evitando reintroduzir o bug de campo inexistente (`os.tecnico`) já corrigido no plano 08-01
- Fechamento é imutável nesta versão: não há edição nem estorno — qualquer correção exigiria fluxo futuro (fora do escopo do TEC-03 textual)
- Comentário de cabeçalho do arquivo atualizado para não referenciar mais "plano 08-04" (evita falso-positivo no critério de aceitação de placeholder removido, que faz grep textual simples por "plano 08-04" no arquivo inteiro)

## Deviations from Plan

**1. [Rule 1 - Bug] Comentário de cabeçalho do arquivo referenciava "plano 08-04"**
- **Found during:** Task 2 (verificação do critério de aceitação `grep "plano 08-04" ... não retorna nada`)
- **Issue:** O critério de aceitação do plano faz grep textual pela string "plano 08-04" no arquivo inteiro, mas o comentário de cabeçalho (linha 5, não-JSX) também continha essa string, fazendo o grep falhar mesmo com os dois placeholders JSX corretamente removidos
- **Fix:** Reescrito o comentário de cabeçalho para descrever TEC-02 e TEC-03 como concluídos, sem citar o número do plano
- **Files modified:** mp-react/src/components/admin/fechamento/AbaFechamentoTecnicos.jsx
- **Verification:** `grep "plano 08-04" AbaFechamentoTecnicos.jsx` retorna vazio (exit 1); eslint e build seguem limpos
- **Committed in:** b839b1f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Ajuste cosmético no comentário, sem mudança de comportamento. Nenhum scope creep.

## Issues Encountered

None.

## User Setup Required

None - a regra do Firestore `fechamentosTecnicos` já foi deployada no plano 08-03; este plano só grava documentos na coleção já habilitada.

## Next Phase Readiness

- TEC-03 completo: admin marca pago com data, snapshot imutável gravado, pagamento duplo bloqueado (client-side), histórico consultável por técnico
- Phase 8 (Fechamento de Técnicos) 100% concluída (4/4 planos) — TEC-01, TEC-02 e TEC-03 todos completos
- `npm run build` compila; `npx eslint` sem erros no arquivo; suite Vitest permanece verde (129/129) — nenhum teste novo necessário (lógica de agrupamento já coberta no plano 08-01, este plano é só UI + escrita simples no Firestore)
- Phase 9 (Contas a Pagar) pode iniciar sem bloqueios — não depende de Phase 8
- Phase 10 (Fluxo de Caixa) depende de Phase 7, 8 e 9 completas; Phase 8 agora está pronta para essa dependência

## Self-Check: PASSED

- FOUND: mp-react/src/components/admin/fechamento/AbaFechamentoTecnicos.jsx
- FOUND commit: 1e00ad2
- FOUND commit: b839b1f

---
*Phase: 08-fechamento-de-tecnicos*
*Completed: 2026-07-05*
