---
phase: 07-faturamento-e-contas-a-receber
plan: 05
subsystem: financeiro
tags: [react, firestore, faturamento, notas-fiscais, calendario]

# Dependency graph
requires:
  - phase: 07-01
    provides: "utils/faturamento.js — calcularDataPrevista, getRegrasFaturamento"
  - phase: 07-04
    provides: "AbaFaturamento.jsx — fila por seguradora + checklist fat_lancado_*"
provides:
  - "ModalFecharNota.jsx — fecha nota com número, data de emissão, preview/bloqueio da data prevista"
  - "notasFiscais em empresas/{empresaId}/notasFiscais — nota com itens snapshot, status, pago_em"
  - "Lista de notas com status derivado (aguardando/paga/atrasada) e painel total a receber por seguradora"
  - "marcarNotaPaga — quita todas as OS vinculadas de uma nota de uma vez"
affects: [08-fechamento-mensal-de-tecnicos, 10-fluxo-de-caixa]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Status derivado (não gravado) calculado na leitura comparando data_prevista com a data de hoje — evita job/cron para marcar atrasada"
    - "Quitação em massa via Promise.all de atualizarOS (loop), nunca writeBatch — firebase.js não exporta writeBatch"
    - "Nota grava snapshot imutável dos itens (os_id, tipo, codigo, valor, num_assist, nome_segurado) em vez de referência viva à OS"

key-files:
  created:
    - mp-react/src/components/admin/faturamento/ModalFecharNota.jsx
  modified:
    - mp-react/src/components/admin/faturamento/AbaFaturamento.jsx

key-decisions:
  - "Botão 'Fechar nota' fica desabilitado quando não há itens lançados pendentes, evitando nota vazia"
  - "Modal calcula a data prevista a cada mudança de data de emissão (useMemo) para dar feedback imediato do calendário antes de confirmar"
  - "Painel 'Total a receber' soma apenas notas com status != paga e usa a menor data_prevista como a mais próxima"

requirements-completed: [FAT-06, FAT-07, FAT-08, FAT-09, FAT-10]

# Metrics
duration: ~20min
completed: 2026-07-02
---

# Phase 7 Plan 5: Fechar Nota, Status e Painel a Receber Summary

**ModalFecharNota.jsx fecha o ciclo de faturamento gravando a nota em `notasFiscais` com total somado e itens vinculados, calculando a data prevista de pagamento pelo calendário da seguradora (com bloqueio no período não faturável 26-31 da Allianz/Mondial); AbaFaturamento.jsx ganha lista de notas com status aguardando/paga/atrasada derivado, painel de total a receber por seguradora e ação de marcar nota como paga que quita todas as OS vinculadas de uma vez.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-02
- **Tasks:** 2/2
- **Files modified:** 2 (1 criado, 1 modificado)

## Accomplishments
- `ModalFecharNota.jsx`: campos número da fatura + data de emissão, total somado dos itens lançados, preview em tempo real da data prevista de pagamento (`calcularDataPrevista`), aviso vermelho e botão bloqueado no período não faturável (FAT-08), e campo de data manual obrigatório quando a seguradora não tem calendário (Tempo/Maxpar)
- `AbaFaturamento.jsx`: carga de `notasFiscais` da empresa ao trocar de empresa, botão "Fechar nota com os N itens lançados" (desabilitado sem itens), handler `confirmarNota` que grava a nota com snapshot dos itens e vincula cada um via `fat_nota_mo_id`/`fat_nota_desloc_id`/`fat_nota_id` (saindo da fila)
- `statusNota` deriva aguardando/paga/atrasada comparando `data_prevista` com a data de hoje — `atrasada` nunca é gravada no Firestore, só calculada na leitura
- Lista de notas por seguradora com selo de status colorido e botão "Marcar como paga" quando ainda não paga
- Painel-resumo "Total a receber por seguradora" (FAT-09) somando notas não pagas e mostrando a data prevista mais próxima
- `marcarNotaPaga` (FAT-10) grava `status: 'paga'` + `pago_em` na nota e quita de uma vez todas as OS vinculadas (`fat_pago_em`) via `Promise.all`, com confirmação nativa antes de aplicar

## Task Commits

Each task was committed atomically:

1. **Task 1: ModalFecharNota.jsx + carga de notas + botão Fechar Nota na aba** - `c61a723` (feat)
2. **Task 2: Lista de notas com status, painel a receber por seguradora e marcar paga** - `40b4e79` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `mp-react/src/components/admin/faturamento/ModalFecharNota.jsx` - Modal de fechamento de nota: número, data de emissão, preview/bloqueio da data prevista, data manual, lista de itens para conferência
- `mp-react/src/components/admin/faturamento/AbaFaturamento.jsx` - Carga de notasFiscais, botão Fechar Nota, `confirmarNota`, lista de notas com status derivado, painel total a receber, `marcarNotaPaga`

## Decisions Made
- `statusNota` como função pura de módulo (fora do componente) — `atrasada` é sempre derivado da comparação `data_prevista < hoje`, nunca persistido, evitando necessidade de job agendado para atualizar status
- Quitação em massa das OS vinculadas usa `Promise.all` de `atualizarOS` em loop, não `writeBatch` (firebase.js não exporta essa função — decisão já registrada no Plano 01/04)
- Nota grava um snapshot imutável dos itens (`os_id, tipo, codigo, valor, num_assist, nome_segurado`) em vez de apenas referenciar as OS, protegendo o histórico da nota contra edições futuras na OS (mitigação T-07-10 do threat model)

## Deviations from Plan

None - plano executado exatamente como escrito. Os dois arquivos e todas as acceptance criteria (greps de padrão) foram verificados e batem com o especificado no PLAN.md. Único ajuste de execução: as mudanças em `AbaFaturamento.jsx` foram feitas em uma única passada e depois reorganizadas em dois commits (Task 1 / Task 2) para manter a granularidade atômica exigida pelo protocolo de commit — sem impacto no código final, apenas na sequência de commits.

## Issues Encountered

None.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- Phase 7 (Faturamento e Contas a Receber) está completa: 5/5 planos executados (utils de calendário, dois códigos na OS, calendário editável em Config, fila com checklist persistente, fechar nota + status + painel a receber)
- Campos `fat_pago_em` (gravado ao marcar nota paga) e `notasFiscais` ficam disponíveis para a Phase 10 (Fluxo de Caixa), que soma entradas reais a partir de notas pagas
- Calendário de pagamento da Tempo/Maxpar segue pendente (FAT-11, v1.3) — fluxo atual usa data prevista manual para essas seguradoras, conforme decisão registrada no Plano 01
- Nenhum bloqueio identificado para as próximas fases do milestone v1.2 (Fechamento Mensal de Técnicos, Contas a Pagar, Fluxo de Caixa, Exportação)

## Self-Check: PASSED

- FOUND: mp-react/src/components/admin/faturamento/ModalFecharNota.jsx
- FOUND: mp-react/src/components/admin/faturamento/AbaFaturamento.jsx (modificado)
- FOUND commit: c61a723
- FOUND commit: 40b4e79

---
*Phase: 07-faturamento-e-contas-a-receber*
*Completed: 2026-07-02*
