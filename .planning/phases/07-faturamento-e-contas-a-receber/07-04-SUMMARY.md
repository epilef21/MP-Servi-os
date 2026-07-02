---
phase: 07-faturamento-e-contas-a-receber
plan: 04
subsystem: financeiro
tags: [react, firestore, faturamento, fila, checklist]

# Dependency graph
requires:
  - phase: 07-01
    provides: "utils/faturamento.js com SEGS_COM_CODIGO, SEGS_AUTO_NUM_ASSIST, STATUS_FATURAVEIS, getDivergenciaFat"
provides:
  - "AbaFaturamento.jsx — fila de faturamento por seguradora derivada em memória de reports"
  - "Checklist persistente 'lançado no portal' gravado em checklist/{osId} (fat_lancado_mo_em/fat_lancado_desloc_em/fat_lancado_em)"
  - "Valor editável (Tempo/Maxpar) e divergência destacada (Mapfre/Allianz/Mondial)"
affects: [07-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fila derivada 100% em memória via useMemo sobre reports (sem query adicional ao Firestore), mesmo padrão de OrdensServicoTab"
    - "Fila como ÚNICA fonte de escrita do checklist — modal (Plano 02) permanece somente-leitura"
    - "Migração de campo legado na leitura (fallback ||/??) e na gravação (zera fat_lancado_em ao gravar fat_lancado_mo_em)"

key-files:
  created:
    - mp-react/src/components/admin/faturamento/AbaFaturamento.jsx
  modified:
    - mp-react/src/components/admin/FinanceiroEmpresaTab.jsx

key-decisions:
  - "toggleLancado sempre grava o campo granular novo e zera o legado fat_lancado_em ao togglar item MO — migração definitiva e irreversível para o novo esquema"
  - "Valor editável da Tempo/Maxpar grava só no onBlur (não a cada tecla), evitando escrita excessiva no Firestore"
  - "Botão 'Copiar todos os códigos' copia apenas os itens NÃO lançados da fila atual, um por linha"

requirements-completed: [FAT-02, FAT-03, FAT-04, FAT-05]

# Metrics
duration: ~15min
completed: 2026-07-02
---

# Phase 7 Plan 4: Aba Faturamento (fila por seguradora + checklist persistente) Summary

**Novo componente `AbaFaturamento.jsx` monta a fila de faturamento por seguradora a partir de `reports` em memória — Mapfre/Allianz/Mondial com itens de mão de obra e deslocamento separados por código (com destaque de divergência), Tempo/Maxpar com item único automático pelo nº da assistência e valor editável — e persiste o checklist "lançado no portal" diretamente no doc da OS, migrando o rastro legado do modal antigo.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-02
- **Tasks:** 2/2
- **Files modified:** 2 (1 criado, 1 modificado)

## Accomplishments
- Fila derivada de `reports` (sem query extra) filtrando por seguradora selecionada e `STATUS_FATURAVEIS` (`processado`, `enviado`)
- Mapfre/Allianz/Mondial: até dois itens por OS (mão de obra + deslocamento opcional), cada um com seu próprio código, valor liberado, valor da OS e badge de divergência (`getDivergenciaFat`)
- Migração do legado na leitura: `fat_codigo`/`fat_valor_aprovado` (modal pré-Fase 7) tratados como código/valor de mão de obra quando os campos novos (`fat_codigo_mo`/`fat_valor_mo`) não existem
- Tempo/Maxpar: item único por OS pelo `num_assist`, sem digitação de código, com valor editável (`fat_valor_faturado`) e sugestão "a OS diz {valor}" vinda de `mo_seguradora + valor_deslocamento`
- Progresso da fila ("X lançados ✓ · Y faltando") e total somado (`fmtBRL`) sempre visíveis no topo
- Checkbox "lançado no portal" persiste no doc da OS por tipo de item (`fat_lancado_mo_em`, `fat_lancado_desloc_em`, `fat_lancado_em`) e sobrevive a recarregar a página — a fila é a ÚNICA fonte de escrita desse checklist
- Migração na gravação: ao togglar um item de mão de obra, grava sempre o campo granular novo e zera o legado `fat_lancado_em`, completando a transição de esquema iniciada no Plano 02
- Confirmação nativa (`window.confirm`) ao desmarcar um item já lançado (mitigação T-07-08 do threat model)
- Botão "📋 Copiar todos os códigos" copia para a área de transferência os códigos ainda não lançados da fila atual, um por linha
- Nova aba interna "📄 Faturamento" cadastrada no `FinanceiroEmpresaTab.jsx`, renderizando `<AbaFaturamento />` quando `abaFin === 'faturamento'`

## Task Commits

Each task was committed atomically:

1. **Task 1: Criar AbaFaturamento.jsx com fila derivada (incl. legado) + wiring da nova aba** - `11c746c` (feat)
2. **Task 2: Persistência do checklist lançado + valor editável + copiar códigos** - `70dc837` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `mp-react/src/components/admin/faturamento/AbaFaturamento.jsx` — componente novo: fila derivada, progresso, divergência, checklist persistente, valor editável, copiar códigos
- `mp-react/src/components/admin/FinanceiroEmpresaTab.jsx` — import de `AbaFaturamento`, nova entrada `{ id: 'faturamento', label: '📄 Faturamento' }` na barra de abas, render condicional

## Decisions Made
- A fila é a ÚNICA fonte de gravação de `fat_lancado_*` — o `DetalheOSModal` (Plano 02) permanece somente-leitura, evitando fonte dupla de verdade
- Migração do legado acontece tanto na leitura (fallback `||`/`??` para os campos antigos) quanto na gravação (zera `fat_lancado_em` ao gravar `fat_lancado_mo_em` pela primeira vez), completando a transição de esquema de forma definitiva
- Valor editável da Tempo/Maxpar grava apenas no `onBlur`, não a cada tecla digitada, evitando writes excessivos no Firestore
- Item de deslocamento só aparece na fila se `fat_codigo_desloc` estiver preenchido (opcional, conforme contrato do Plano 02)

## Deviations from Plan

None - plano executado exatamente como escrito. Os dois arquivos e todas as acceptance criteria (greps de padrão) foram verificados e batem com o especificado no PLAN.md.

## Issues Encountered

None.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- Campos `fat_lancado_mo_em`, `fat_lancado_desloc_em`, `fat_lancado_em`, `fat_nota_mo_id`, `fat_nota_desloc_id`, `fat_nota_id`, `fat_valor_faturado` agora são gravados/lidos pela fila e ficam prontos para o Plano 05 (Fechar Nota): itens marcados como lançados na fila poderão ser selecionados e vinculados a uma nota, que por sua vez grava os campos `fat_nota_*_id` que os removem da fila
- Nenhum bloqueio identificado para o Plano 05 (fechar nota / status de pagamento / marcar paga)

## Self-Check: PASSED

- FOUND: mp-react/src/components/admin/faturamento/AbaFaturamento.jsx
- FOUND: mp-react/src/components/admin/FinanceiroEmpresaTab.jsx (modificado)
- FOUND commit: 11c746c
- FOUND commit: 70dc837

---
*Phase: 07-faturamento-e-contas-a-receber*
*Completed: 2026-07-02*
