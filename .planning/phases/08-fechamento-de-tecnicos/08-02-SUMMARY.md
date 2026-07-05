---
phase: 08-fechamento-de-tecnicos
plan: 02
subsystem: ui
tags: [react, firestore, tecnicos, pix, pagamento]

# Dependency graph
requires:
  - phase: 08-fechamento-de-tecnicos
    provides: "Plano 01 — utils/fechamentoTecnicos.js (agrupamento de OS por técnico e total a pagar)"
provides:
  - "Campos chave_pix e forma_pagamento no cadastro/edição de técnico (TecnicosTab.jsx)"
  - "Persistência de chave_pix e forma_pagamento em empresas/{id}/tecnicos/{id}"
affects: [08-03, 08-04]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Campo opcional com default fixo salvo sempre no payload (forma_pagamento default 'pix')"]

key-files:
  created: []
  modified: ["mp-react/src/components/admin/TecnicosTab.jsx"]

key-decisions:
  - "forma_pagamento usa select fixo com 3 opções (pix/dinheiro/transferencia) para evitar valor arbitrário (mitigação T-08-04 do threat model)"
  - "chave_pix e forma_pagamento não entram na validação de campos obrigatórios (errs) — opcionais por design"

patterns-established: []

requirements-completed: [TEC-01]

# Metrics
duration: 6min
completed: 2026-07-05
---

# Phase 08 Plan 02: Chave PIX e Forma de Pagamento do Técnico Summary

**Cadastro de técnico ganha chave PIX e forma de pagamento (select pix/dinheiro/transferência), persistidos em `empresas/{id}/tecnicos/{id}` para uso no fechamento mensal (plano 04).**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-05T18:15:39Z
- **Completed:** 2026-07-05T18:21:07Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- `TECNICO_FORM_INITIAL`, `openModal` e o `payload` de `salvar()` em `TecnicosTab.jsx` agora incluem `chave_pix` (string livre) e `forma_pagamento` (default `'pix'`)
- Modal de técnico renderiza input de chave PIX (largura total, placeholder com exemplos de tipo de chave) e select de forma de pagamento com as 3 opções fixas
- Editar um técnico existente reabre o modal com os dois campos preenchidos a partir do documento Firestore

## Task Commits

Each task was committed atomically:

1. **Task 1: Adicionar chave_pix e forma_pagamento ao estado, openModal e payload** - `bb899d2` (feat)
2. **Task 2: Renderizar os campos chave PIX e forma de pagamento no modal** - `6ba56f3` (feat)

**Plan metadata:** (see final commit)

## Files Created/Modified
- `mp-react/src/components/admin/TecnicosTab.jsx` - Estado inicial, openModal, payload de salvar() e render do modal ganham chave_pix e forma_pagamento

## Decisions Made
- forma_pagamento restrita a um `<select>` com 3 opções fixas (pix/dinheiro/transferencia) em vez de input livre, conforme mitigação T-08-04 do threat model do plano (evita valor arbitrário gravado no Firestore)
- chave_pix e forma_pagamento tratados como opcionais — não entram no bloco de validação `errs` existente

## Deviations from Plan

None - plan executado exatamente como escrito.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `chave_pix` e `forma_pagamento` agora disponíveis no documento do técnico para o plano 04 (fechamento mensal) copiar a chave com um clique e exibir a forma de pagamento
- Suite de testes Vitest permanece verde (129/129) — nenhum teste dedicado a TecnicosTab.jsx existia antes ou foi necessário para este plano
- `npm run build` compila sem erros; `npx eslint` sem erros no arquivo modificado

---
*Phase: 08-fechamento-de-tecnicos*
*Completed: 2026-07-05*
