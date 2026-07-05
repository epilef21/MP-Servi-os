---
phase: 08-fechamento-de-tecnicos
plan: 03
subsystem: financeiro
tags: [react, firestore, firestore-rules, tecnicos, pix, pagamento]

# Dependency graph
requires:
  - phase: 08-fechamento-de-tecnicos
    provides: "Plano 01 — utils/fechamentoTecnicos.js (agrupamento por técnico e status derivado)"
  - phase: 08-fechamento-de-tecnicos
    provides: "Plano 02 — chave_pix/forma_pagamento no cadastro de técnico"
provides:
  - "Regra Firestore fechamentosTecnicos (deployada em produção)"
  - "Aba interna '👷 Técnicos' no Financeiro da empresa — visão do fechamento mensal por técnico"
  - "Wiring AbaFechamentoTecnicos + mesRef no FinanceiroEmpresaTab"
affects: [08-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Join grupo↔cadastro por tecnico_id primeiro, fallback por nome normalizado (mesmo shape de agruparPorTecnico)"
    - "Placeholder de comentário '{/* marcar pago + histórico: plano 08-04 */}' marca os pontos de inserção do próximo plano"

key-files:
  created:
    - mp-react/src/components/admin/fechamento/AbaFechamentoTecnicos.jsx
  modified:
    - firestore.rules
    - mp-react/src/components/admin/FinanceiroEmpresaTab.jsx

key-decisions:
  - "Regra fechamentosTecnicos copiada do padrão notasFiscais (isUserOfEmpresa || isSuperAdmin) e deployada ANTES de qualquer getDocs na aba, seguindo o aprendizado LOCKED da Fase 7 (coleção sem regra derruba a aba em produção)"
  - "Total exibido usa fech?.total ?? g.total — snapshot do fechamento quando pago, total ao vivo (útil ao filtrar/ajustar) quando pendente"

patterns-established:
  - "Aba de fechamento mensal por entidade (técnico) consumindo util puro de agrupamento + coleção de snapshots já gravados para derivar status — reaplicável em Fase 9/10"

requirements-completed: [TEC-02, TEC-03]

# Metrics
duration: ~6min
completed: 2026-07-05
---

# Phase 08 Plan 03: Regra fechamentosTecnicos + Aba Técnicos (visão mensal) Summary

**Coleção `fechamentosTecnicos` habilitada no Firestore (regra + deploy) e nova aba "👷 Técnicos" no Financeiro mostrando, por mês selecionado, o total a pagar de cada técnico, a lista de OS com valor_prestador, a chave PIX copiável com um clique e o selo PAGO/PENDENTE derivado dos fechamentos já gravados.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-05T18:23:30Z
- **Completed:** 2026-07-05T18:28:58Z
- **Tasks:** 3/3
- **Files modified:** 3 (1 criado, 2 modificados)

## Accomplishments
- Regra `match /fechamentosTecnicos/{id}` adicionada ao `firestore.rules` (mesmo padrão de `notasFiscais`) e deployada com `npx firebase deploy --only firestore:rules` — "Deploy complete!" confirmado antes de qualquer leitura da coleção na UI
- Novo componente `AbaFechamentoTecnicos.jsx`: agrupa as OS do mês por técnico via `agruparPorTecnico`, cruza com o cadastro de técnicos casando por `tecnicoId` primeiro (fallback `normNome(t.nome)`), deriva o selo PAGO/PENDENTE via `acharFechamento`/`statusFechamento`, e mostra a chave PIX com botão "📋 Copiar PIX"
- Empty-state com diagnóstico explicando o critério de mês ("As OS entram pelo mês de criação — navegue com ◄ ► para outro mês")
- Aba "👷 Técnicos" registrada no `FinanceiroEmpresaTab.jsx`, recebendo `mesRef` do estado já existente — a aba respeita a navegação ◄ ► sem alterar o comportamento das demais abas
- Placeholders `{/* marcar pago + histórico: plano 08-04 */}` preservados literalmente (dois pontos de inserção: fim de cada card e fim do componente) para o próximo plano localizar onde inserir o botão de marcar pago e a seção de histórico

## Task Commits

Each task was committed atomically:

1. **Task 1: Regra da coleção fechamentosTecnicos + deploy das rules** - `e074b51` (feat)
2. **Task 2: Criar AbaFechamentoTecnicos.jsx — visão do fechamento mensal por técnico** - `0fe3f2d` (feat)
3. **Task 3: Registrar a aba "👷 Técnicos" no FinanceiroEmpresaTab.jsx** - `92deb4f` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `firestore.rules` - Nova regra `fechamentosTecnicos` no bloco `empresas/{empresaId}`, mesmo padrão de `isUserOfEmpresa(empresaId) || isSuperAdmin()`; deployada em produção (projeto `checklist-53795`)
- `mp-react/src/components/admin/fechamento/AbaFechamentoTecnicos.jsx` - Componente novo: agrupamento por técnico, join por ID com fallback por nome, selo de status, PIX copiável, lista de OS
- `mp-react/src/components/admin/FinanceiroEmpresaTab.jsx` - Import de `AbaFechamentoTecnicos`, entrada `{ id: 'tecnicos', label: '👷 Técnicos' }` na barra de abas, render condicional passando `mesRef`

## Decisions Made
- Regra deployada como Task 1, antes de qualquer código que leia a coleção — aprendizado LOCKED da Fase 7 (coleção nova sem regra = "Missing or insufficient permissions" em produção)
- Total do card usa o snapshot do fechamento (`fech.total`) quando já pago, e o total ao vivo (`g.total`) quando pendente, mantendo o padrão de imutabilidade histórica já usado em `notasFiscais` (Fase 7)

## Deviations from Plan

None - plan executado exatamente como escrito. Estrutura do componente, imports, joins e placeholders seguem literalmente a seção `<action>` do plano.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. O deploy das rules foi executado via CLI pelo próprio agente (`npx firebase deploy --only firestore:rules`), sem necessidade de ação manual do usuário.

## Next Phase Readiness

- `AbaFechamentoTecnicos.jsx` pronto para o plano 04 adicionar o botão "marcar como pago" (grava em `fechamentosTecnicos`) e a seção de histórico — os dois pontos de inserção estão marcados com o comentário `{/* marcar pago + histórico: plano 08-04 */}` (fim de cada card de técnico e fim do componente)
- Regra `fechamentosTecnicos` já deployada — plano 04 pode gravar/ler a coleção sem risco de "permission denied"
- `npm run build` compila; `npx eslint` sem erros no arquivo novo; suite Vitest permanece verde (129/129) — nenhum teste novo foi necessário para este plano (visão de leitura sem lógica pura nova além da já testada no plano 01)
- Nenhum bloqueio identificado para o plano 08-04

## Self-Check: PASSED

- FOUND: mp-react/src/components/admin/fechamento/AbaFechamentoTecnicos.jsx
- FOUND: firestore.rules contains match /fechamentosTecnicos/{id}
- FOUND commit: e074b51
- FOUND commit: 0fe3f2d
- FOUND commit: 92deb4f

---
*Phase: 08-fechamento-de-tecnicos*
*Completed: 2026-07-05*
