---
phase: 04-fluxos-criticos
plan: "04-02"
subsystem: tests
tags: [vitest, componentes-reais, firebase-mock, orcamento-fluxo, signature-canvas]
dependency_graph:
  requires: []
  provides: [ORC-01, ORC-02, ORC-03, ORC-04, ORC-05, ORC-06]
  affects: [mp-react/src/__tests__/orcamentoFluxo.test.jsx]
tech_stack:
  added: []
  patterns: [Padrão C vi.mock inline, Componentes Reais, MemoryRouter Routes parametrizado]
key_files:
  created:
    - mp-react/src/__tests__/orcamentoFluxo.test.jsx
  modified: []
decisions:
  - D-06/D-07: OrcamentoTecnicoPage e AprovarOrcamentoPage renderizados diretamente (componentes reais ~250 linhas)
  - D-08: vi.mock('../firebase') com Padrão C — antes de todos os imports
  - D-09: vi.mock('react-signature-canvas') com forwardRef + useImperativeHandle expondo toDataURL/isEmpty/clear
  - D-10: canvas mock chama props.onEnd?.() no onClick para setHasSig(true)
  - D-11: vi.mock('browser-image-compression') retorna Blob falso
  - D-12: vi.mock('../utils/validarUpload') e vi.mock('../utils/comprimirImagem')
  - D-13: _clearCacheForTest() no beforeEach global (evita cache useEmpresa entre testes)
  - D-14: getDoc mockado com shape { exists, id, data } — nunca objeto simples
  - D-15: getEmpresaBySlug retorna objeto válido { id, nome, slug, ativo } — nunca null
  - D-16: Wrapper MemoryRouter initialEntries > Routes > Route path="/:slug/:orcamentoId"
  - Fix ORC-01: nome_cliente em input readOnly — usar getByDisplayValue em vez de getByText
metrics:
  duration: "4 min"
  completed: "2026-05-20"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 4 Plan 02: Orçamento Fluxo Tests Summary

**One-liner:** 6 testes com componentes reais cobrindo o fluxo técnico→cliente do orçamento — preencher, submeter, visualizar e aprovar com assinatura digital.

## What Was Built

Arquivo `mp-react/src/__tests__/orcamentoFluxo.test.jsx` com 6 testes cobrindo ORC-01..ORC-06. Os componentes reais `OrcamentoTecnicoPage` e `AprovarOrcamentoPage` são renderizados com MemoryRouter parametrizado. Todos os módulos externos problemáticos são mockados via Padrão C.

## Tests Created

| Test ID | Describe | Assertion |
|---------|----------|-----------|
| ORC-01 | técnico visualiza formulário | OrcamentoTecnicoPage renderiza sem crash; nome_cliente visível em input readOnly |
| ORC-02 | técnico preenche diagnóstico | campo de diagnóstico aceita input após dupla resolução assíncrona |
| ORC-03 | orçamento salvo em_revisao | updateDoc chamado com { status: 'em_revisao' } ao submeter o formulário |
| ORC-04 | cliente visualiza orçamento | AprovarOrcamentoPage renderiza dados do orçamento enviado_cliente |
| ORC-05 | cliente preenche nome e assina | input de nome preenchível + canvas clicável (hasSig=true via onEnd) |
| ORC-06 | aprovação atualiza Firestore | updateDoc com { status: 'aprovado', aprovado_por: 'Maria Santos', assinatura_cliente: 'data:image/png;base64,ASSINATURA' } |

## Test Results

```
Test Files  1 passed (1)
     Tests  6 passed (6)
  Duration  3.09s
```

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 5a24fef | test | criar orcamentoFluxo.test.jsx com 6 testes ORC-01..ORC-06 |

## Deviations from Plan

- **ORC-01 assertion ajustada**: o plano sugeria `getByText(/João Silva/i)`, mas `nome_cliente` é renderizado em `<input readOnly>`. Fix: usar `getByDisplayValue('João Silva')`. Comportamento testado é equivalente — dados do cliente visíveis após carregamento.
- **ORC-02 adaptado**: OrcamentoTecnicoPage não possui SignatureCanvas — testa preenchimento do campo de diagnóstico (principal input do técnico) em vez de canvas.

## Pitfalls Avoided

- P1: getDoc mockado com `{ exists: () => true, id, data: () => ({...}) }` — nunca objeto simples
- P2: getEmpresaBySlug retorna objeto válido — nunca null (causa TypeError em useEmpresa)
- P3: canvas mock chama `props.onEnd?.()` no onClick → hasSig=true → botão de aprovação desbloqueado
- P6: _clearCacheForTest() no beforeEach global → useEmpresa cache limpo entre testes

## Threat Flags

Nenhum — somente arquivo de teste criado; nenhum código de produção modificado.

## Self-Check: PASSED

- [x] mp-react/src/__tests__/orcamentoFluxo.test.jsx existe
- [x] Todos os 6 testes passam verde (ORC-01..ORC-06)
- [x] vi.mock('../firebase') antes de qualquer import (Padrão C)
- [x] vi.mock('react-signature-canvas') com forwardRef + onEnd via onClick
- [x] vi.mock('browser-image-compression'), validarUpload, comprimirImagem
- [x] _clearCacheForTest() em beforeEach global
- [x] getDoc shape correto: { exists, id, data }
- [x] updateDoc chamado com status: 'em_revisao' (ORC-03)
- [x] updateDoc chamado com status: 'aprovado' + aprovado_por + assinatura_cliente (ORC-06)
- [x] AdminPage.jsx nunca importado
