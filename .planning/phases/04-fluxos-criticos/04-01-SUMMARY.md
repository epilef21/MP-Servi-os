---
phase: 04-fluxos-criticos
plan: "04-01"
subsystem: tests
tags: [vitest, stub-components, firebase-mock, os-crud]
dependency_graph:
  requires: []
  provides: [OS-01, OS-02, OS-03, OS-04, OS-05, OS-06]
  affects: [mp-react/src/__tests__/osFluxo.test.jsx]
tech_stack:
  added: []
  patterns: [Padrão C vi.mock inline, Stub Components mínimos]
key_files:
  created:
    - mp-react/src/__tests__/osFluxo.test.jsx
  modified: []
decisions:
  - D-01 aplicado: AdminPage.jsx nunca importado — stub components replicam só o handler mínimo
  - D-02 aplicado: stub components inline no arquivo de teste (OSFormStub, OSEditStub, OSStatusStub, OSExcluirStub, OSListaStub)
  - D-03 aplicado: OSListaStub chama getOSdaEmpresa no mount via useEffect
  - D-04 aplicado: vi.spyOn(window, 'confirm') no beforeEach do describe OS-04, restaurado com vi.restoreAllMocks() no afterEach
  - D-05 aplicado: deleteDoc importado via vi.mock('../firebase') — não do SDK diretamente
  - D-15 aplicado: mock inline inclui deleteDoc, uploadFoto, serverTimestamp, updateDoc, getDoc
metrics:
  duration: "2 min"
  completed: "2026-05-20"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 4 Plan 01: OS Fluxo Tests Summary

**One-liner:** 6 stub-component tests cobrindo CRUD completo de OS (criar, editar, mudar status, excluir, lista vazia, lista com dados) via vi.mock inline sem renderizar AdminPage.jsx.

## What Was Built

Arquivo `mp-react/src/__tests__/osFluxo.test.jsx` com 6 testes cobrindo OS-01..OS-06. A estratégia adota Stub Components mínimos — cada stub replica apenas o handler relevante do AdminPage.jsx, chamando as funções Firebase mockadas. O Padrão C (vi.mock antes dos imports) é seguido rigorosamente.

## Tests Created

| Test ID | Describe | Assertion |
|---------|----------|-----------|
| OS-01 | criar OS via formulário | criarOS chamada com status: 'aguardando_tecnico' e id retornado exibido |
| OS-02 | editar dados de OS existente | atualizarOS chamada com campos de atendimento (nome_tecnico, data_atend) |
| OS-03 | alterar status de OS | atualizarOS chamada com { status: 'concluido' } |
| OS-04 | excluir OS e remover da lista | deleteDoc com caminho mock-ref:empresas/emp-test-1/checklist/os-del-1 |
| OS-05 | lista de OS exibe estado vazio | texto 'Nenhuma OS encontrada' visível quando array vazio |
| OS-06 | lista de OS exibe itens retornados | 2 li[data-testid="item-os"] quando getOSdaEmpresa retorna 2 objetos |

## Test Results

```
Test Files  1 passed (1)
     Tests  6 passed (6)
  Duration  2.36s
```

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 5076668 | test | criar osFluxo.test.jsx com 6 testes OS-01..OS-06 |

## Deviations from Plan

None — plan executed exactly as written. The file content matches the exact specification in the `<action>` block of 04-01-PLAN.md.

## Known Stubs

None — all mock data flows correctly to assertions. No hardcoded empty values that would prevent the plan's goal from being achieved.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. Test file only; no production code modified.

## Self-Check: PASSED

- [x] mp-react/src/__tests__/osFluxo.test.jsx exists (created in worktree, committed at 5076668)
- [x] All 6 tests pass green (verified by npm test output)
- [x] Commit 5076668 exists in git log
- [x] AdminPage.jsx never imported in test file
- [x] vi.mock('../firebase') comes before any import of '../firebase' (Padrão C)
- [x] window.confirm spy restored with vi.restoreAllMocks() in OS-04 afterEach
- [x] criarOS called with status: 'aguardando_tecnico' (OS-01)
- [x] atualizarOS called with atend fields (OS-02) and { status: 'concluido' } (OS-03)
- [x] deleteDoc called with 'mock-ref:empresas/emp-test-1/checklist/os-del-1' (OS-04)
- [x] 'Nenhuma OS encontrada' visible when list empty (OS-05)
- [x] 2 items rendered when mock returns 2 objects (OS-06)
