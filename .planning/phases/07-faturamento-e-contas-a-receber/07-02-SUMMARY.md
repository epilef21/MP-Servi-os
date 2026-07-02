---
phase: 07-faturamento-e-contas-a-receber
plan: 02
subsystem: financeiro
tags: [react, firestore, faturamento, detalheosmodal]

# Dependency graph
requires:
  - phase: 07-01
    provides: "utils/faturamento.js com SEGS_COM_CODIGO e digitosCodigo"
provides:
  - "DetalheOSModal.jsx com dois códigos de faturamento por OS (mão de obra + deslocamento opcional)"
  - "Campos fat_codigo_mo/fat_valor_mo/fat_codigo_desloc/fat_valor_desloc gravados em checklist/{osId}"
  - "Passo 3 somente-leitura (status de lançamento por item), fonte de verdade única na fila do Plano 04"
affects: [07-03, 07-04, 07-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Import real de utils/faturamento.js (SEGS_COM_CODIGO, digitosCodigo) sem duplicação local"
    - "Migração de campo legado único para par MO/Deslocamento na leitura via fallback ??"

key-files:
  created: []
  modified:
    - mp-react/src/components/admin/DetalheOSModal.jsx

key-decisions:
  - "mo_seguradora/valor_deslocamento NÃO são sobrescritos ao salvar códigos — preservam o valor da OS para permitir a divergência do Plano 04 (FAT-05)"
  - "Handler marcarLancado e estado savingLancado removidos do modal — o checklist de lançamento passa a viver exclusivamente na fila da AbaFaturamento (Plano 04), eliminando fonte dupla de verdade"
  - "Deslocamento vazio grava string vazia / valor 0 e não conta como pendência"

patterns-established:
  - "Seção condicional por seguradora: temCodigo = SEGS_COM_CODIGO.includes(seg) decide entre formulário de dois códigos ou aviso de fila automática"

requirements-completed: [FAT-01]

# Metrics
duration: 5min
completed: 2026-07-02
---

# Phase 7 Plan 2: Códigos de Faturamento MO + Deslocamento no DetalheOSModal Summary

**DetalheOSModal.jsx passa a registrar DOIS códigos de faturamento por OS (mão de obra obrigatório + deslocamento opcional, cada um com valor), migra o campo único legado `fat_codigo`/`fat_valor_aprovado` e converte o antigo botão "marcar como lançado" em status somente-leitura apontando para o checklist da fila de Faturamento.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-02T23:20:34Z
- **Completed:** 2026-07-02T23:25:08Z
- **Tasks:** 2/2
- **Files modified:** 1

## Accomplishments
- Estado do formulário de código duplicado em `codigoMoForm`/`codigoDeslocForm`, substituindo o antigo `codigoForm` único
- `saveCodigos` grava os quatro campos (`fat_codigo_mo`, `fat_valor_mo`, `fat_codigo_desloc`, `fat_valor_desloc`) sem sobrescrever `mo_seguradora`/`valor_deslocamento` (preserva a base para a divergência do Plano 04 — FAT-05)
- Leitura migra o legado `fat_codigo`/`fat_valor_aprovado` para o par de mão de obra via fallback `??`, incluindo o resumo verde de código já salvo
- Bug de dígitos corrigido: `digitosCodigo(seg)` importado de `utils/faturamento.js` substitui a regra local errada (`seg === 'Tempo' ? 2 : 8`)
- Mapfre/Allianz/Mondial (`temCodigo`) mostram dois pares de campo; Tempo/Maxpar mostram aviso informativo de fila automática pelo nº da assistência
- Passo 3 vira status somente-leitura por item (mão de obra / deslocamento), com migração do legado `fat_lancado_em` + código legado tratado como "mão de obra lançada", e aponta para o checklist da aba Financeiro → 📄 Faturamento como fonte de verdade única
- Handler `marcarLancado` e estado `savingLancado` completamente removidos — o modal não grava mais `fat_lancado_*`

## Task Commits

Each task was committed atomically:

1. **Task 1: Duplicar estado e handlers de código para MO + Deslocamento; remover marcarLancado** - `844c656` (feat)
2. **Task 2: Renderizar os dois campos de código só para seguradoras com código; Passo 3 vira status somente-leitura** - `5579b45` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `mp-react/src/components/admin/DetalheOSModal.jsx` - Import de `SEGS_COM_CODIGO`/`digitosCodigo`; estado `codigoMoForm`/`codigoDeslocForm`; handler `saveCodigos`; render condicional de dois campos (Mapfre/Allianz/Mondial) ou aviso (Tempo/Maxpar); Passo 3 somente-leitura com status por item

## Decisions Made
- `mo_seguradora`/`valor_deslocamento` preservados como "valor da OS" — não são sobrescritos pelo valor liberado no código, para que a fila (Plano 04) possa comparar e destacar divergência
- Fonte de verdade única do checklist de lançamento: apenas a `AbaFaturamento` (Plano 04) grava `fat_lancado_*`; o modal apenas lê e exibe

## Deviations from Plan

None - plan executado exatamente como escrito.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Campos `fat_codigo_mo`/`fat_valor_mo`/`fat_codigo_desloc`/`fat_valor_desloc` prontos para serem lidos pela fila de faturamento (Plano 04) como itens separados do checklist
- Campos `fat_lancado_mo_em`/`fat_lancado_desloc_em` (ainda não gravados por nenhum componente) precisam ser implementados no Plano 04 — este plano só lê esses campos
- Nenhum bloqueio identificado para o Plano 04 (fila de faturamento / AbaFaturamento)

## Self-Check: PASSED

- FOUND: mp-react/src/components/admin/DetalheOSModal.jsx
- FOUND commit: 844c656
- FOUND commit: 5579b45

---
*Phase: 07-faturamento-e-contas-a-receber*
*Completed: 2026-07-02*
