---
phase: 11-exportacao-e-fechamento-do-mes
plan: 02
subsystem: database
tags: [firestore-rules, firebase-deploy, pure-functions, vitest]

# Dependency graph
requires:
  - phase: 08-fechamento-de-tecnicos
    provides: "Padrão de regra Firestore para subcoleção mensal (fechamentosTecnicos) replicado para fechamentosMes"
provides:
  - "Regra de segurança deployada para empresas/{empresaId}/fechamentosMes/{mesRef}"
  - "Helper puro estaFechado(doc) — deriva se o mês está fechado"
  - "Helper puro formatarFechadoEm(v) — formata data de fechamento para DD/MM/AAAA"
affects: [11-03-fechar-reabrir-mes]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Regra Firestore por subcoleção idêntica ao padrão fechamentosTecnicos (isUserOfEmpresa || isSuperAdmin)", "Helper de data pura sem new Date(string)/toISOString para evitar bug de fuso"]

key-files:
  created:
    - mp-react/src/utils/fechamentoMes.js
    - mp-react/src/__tests__/fechamentoMes.test.js
  modified:
    - firestore.rules

key-decisions:
  - "Regra fechamentosMes replica exatamente o padrão de fechamentosTecnicos — isolamento multi-tenant, sem enforcement de campo"
  - "Enforcement de edição do mês fechado é client-side (risco aceito, single-admin, T-11-04) — mesmo precedente de T-08-12"
  - "formatarFechadoEm aceita Timestamp/Date/string ISO e usa split local, nunca new Date(string) nem toISOString, mesma cautela das Fases 7/9/10"

patterns-established:
  - "Deploy de regra Firestore ANTES de qualquer getDoc na coleção nova (aprendizado LOCKED das Fases 7/8) — evidência do deploy colada no SUMMARY"

requirements-completed: []

# Metrics
duration: ~8min
completed: 2026-07-06
---

# Phase 11 Plan 02: Regra Firestore fechamentosMes + helpers puros Summary

**Regra de segurança da coleção fechamentosMes deployada em produção (checklist-53795) + helpers puros estaFechado/formatarFechadoEm testados, prontos para a UI de fechar/reabrir mês do Plano 03**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-06T23:26:36Z
- **Completed:** 2026-07-06T23:33:35Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Regra `match /fechamentosMes/{mesRef}` adicionada dentro de `empresas/{empresaId}` no firestore.rules, seguindo exatamente o padrão de `fechamentosTecnicos` (isUserOfEmpresa || isSuperAdmin)
- Deploy `firestore:rules` executado com sucesso no projeto `checklist-53795` — evidência colada abaixo
- `estaFechado(doc)` e `formatarFechadoEm(v)` criados em `utils/fechamentoMes.js`, módulo 100% puro (sem Firebase/React)
- 11 testes novos cobrindo todos os casos do `<behavior>` do plano — suite total sobe de 186 para 197 testes verdes

## Task Commits

Cada task foi commitada atomicamente (Task 2 seguiu ciclo TDD RED → GREEN):

1. **Task 1: Regra fechamentosMes no firestore.rules + deploy** - `7507c84` (feat)
2. **Task 2 (RED): teste falho de fechamentoMes** - `cd93bf4` (test)
3. **Task 2 (GREEN): implementação dos helpers puros** - `39b1dcb` (feat)

**Plan metadata:** (a ser commitado junto com STATE.md/ROADMAP.md/REQUIREMENTS.md)

## Files Created/Modified
- `firestore.rules` - regra `match /fechamentosMes/{mesRef}` dentro do bloco `empresas/{empresaId}`, logo após `fechamentosTecnicos`
- `mp-react/src/utils/fechamentoMes.js` - `estaFechado(doc)` e `formatarFechadoEm(v)`, ambos puros
- `mp-react/src/__tests__/fechamentoMes.test.js` - 11 testes Vitest cobrindo os dois helpers

## Evidência do Deploy (firestore:rules)

Saída completa do comando `npx firebase deploy --only firestore:rules`:

```
=== Deploying to 'checklist-53795'...

i  deploying firestore
i  firestore: ensuring required API firestore.googleapis.com is enabled...
i  firestore: reading indexes from firestore.indexes.json...
i  cloud.firestore: checking firestore.rules for compilation errors...
+  cloud.firestore: rules file firestore.rules compiled successfully
i  firestore: uploading rules firestore.rules...
+  firestore: released rules firestore.rules to cloud.firestore

+  Deploy complete!

Project Console: https://console.firebase.google.com/project/checklist-53795/overview
```

## Decisions Made
- Regra fechamentosMes replica exatamente o padrão de fechamentosTecnicos (mesmo texto de allow read/write) — nenhuma variação necessária
- `formatarFechadoEm` normaliza os três formatos de entrada (Timestamp, Date, string ISO) para um único `Date` antes de formatar, evitando duplicar lógica de padStart em três lugares
- `estaFechado` usa `!!doc && doc.fechado === true` em vez de `doc?.fechado === true` — comportamento idêntico, escolhido por clareza de intenção (não é coincidência de truthy)

## Deviations from Plan

None - plano executado exatamente como escrito.

## Issues Encountered
None.

## User Setup Required
None - deploy da regra já executado nesta sessão (ambiente com Firebase CLI autenticado, mesmo ambiente das Fases 7/8).

## Next Phase Readiness
- Infraestrutura pronta para o Plano 03 (11-03): a coleção `fechamentosMes` já pode ser lida/escrita com segurança em produção, e os helpers `estaFechado`/`formatarFechadoEm` estão testados e prontos para o cadeado no cabeçalho + banner + guardas de escrita
- EXP-02 permanece Pending em REQUIREMENTS.md/ROADMAP.md — este plano entrega só a infraestrutura (regra + helpers puros); o comportamento observável pelo admin (fechar/reabrir mês, bloqueio de edição) é responsabilidade do Plano 03, mesmo padrão de Pending intermediário usado nas Fases 8/9/10
- Nenhum bloqueio conhecido para o Plano 03

---
*Phase: 11-exportacao-e-fechamento-do-mes*
*Completed: 2026-07-06*

## Self-Check: PASSED

- FOUND: firestore.rules
- FOUND: mp-react/src/utils/fechamentoMes.js
- FOUND: mp-react/src/__tests__/fechamentoMes.test.js
- FOUND: commit 7507c84
- FOUND: commit cd93bf4
- FOUND: commit 39b1dcb
