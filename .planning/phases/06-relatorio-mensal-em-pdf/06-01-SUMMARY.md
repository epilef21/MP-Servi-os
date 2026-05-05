---
phase: 06-relatorio-mensal-em-pdf
plan: "01"
subsystem: pdf-generation
tags: [pdf, relatorio, jspdf, financeiro, agregacao]
dependency_graph:
  requires: [jsPDF (ja instalado)]
  provides: [agregarRelatorio, gerarRelatorioMensalPdf]
  affects: [AdminPage (consumidor — plan 06-02)]
tech_stack:
  added: []
  patterns: [jsPDF A4 com cabecalho azul + faixa laranja + rodape paginado, tableRow helper para dados estruturados]
key_files:
  created:
    - mp-react/src/utils/relatorioMensalPdf.js
  modified: []
decisions:
  - getLucroLocal copiado do AdminPage para manter consistência sem criar dependência circular
  - agregarRelatorio filtra client-side (in-memory) — dados ja carregados pelo AdminPage, sem nova query Firestore
  - tableRow helper em vez de textBlock para tabelas de breakdown — melhor visualizacao de dados estruturados
  - funcao s() com replace correto de /[ç]/g,'c' e /[Ç]/g,'C' (caracteres literais, nao 'c' ASCII)
metrics:
  duration: ~5min
  completed: 2026-05-04
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 6 Plan 01: relatorioMensalPdf.js — Agregacao e PDF Mensal Summary

**One-liner:** Utilitario pure-JS com agregarRelatorio (filtro por mes/ano + breakdowns) e gerarRelatorioMensalPdf (PDF A4 jsPDF com cabecalho azul, status, seguradora e tecnico).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Criar relatorioMensalPdf.js | 4b073a3 | mp-react/src/utils/relatorioMensalPdf.js |

## Artifacts Produced

- **mp-react/src/utils/relatorioMensalPdf.js** — 204 linhas; exporta `agregarRelatorio` e `gerarRelatorioMensalPdf`

## Requirements Covered

| Req | Description | Status |
|-----|-------------|--------|
| REL-02 | Contagem de OS por status no relatorio | Atendido — porStatus com percentual na tabela |
| REL-03 | Lucratividade por seguradora | Atendido — porSeguradora ordenado por lucro desc |
| REL-04 | OS e lucro por tecnico | Atendido — porTecnico ordenado por lucro desc |
| REL-05 | Geracao de PDF via jsPDF com download automatico | Atendido — doc.save com nome relatorio_MM_AAAA.pdf |

## Decisions Made

1. **getLucroLocal copiado do AdminPage** — Replicar `(mos - vpt) + vds` internamente evita dependencia circular (utils importando pages). Mantém consistência total com a lógica financeira existente.

2. **Filtragem client-side** — `agregarRelatorio` filtra o array já carregado pelo AdminPage via `criado_em.toDate()`. Não emite nova query ao Firestore — sem custo adicional de leitura.

3. **tableRow helper** — Tabelas de breakdown (status, seguradora, tecnico) usam helper proprio `tableRow` em vez de `textBlock`. Melhor visualização para dados estruturados com 3 colunas.

4. **Sanitizacao correta do ç** — O plan template tinha `.replace(/[c]/g,'c')` (no-op com ASCII 'c'). Corrigido para usar o caractere literal `/[ç]/g,'c'` e `/[Ç]/g,'C'` conforme padrao de pdfGenerator.js e orcamentoPdfGenerator.js.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Substituicao de ç na funcao s() estava incorreta no template do plano**
- **Found during:** Task 1 — revisao do template vs. arquivos existentes
- **Issue:** O template do plano continha `.replace(/[c]/g,'c').replace(/[C]/g,'C')` usando ASCII 'c' e 'C' (no-op). Os arquivos pdfGenerator.js e orcamentoPdfGenerator.js usam os caracteres literais ç e Ç.
- **Fix:** Usados os caracteres literais `/[ç]/g,'c'` e `/[Ç]/g,'C'` consistentes com o padrao do projeto.
- **Files modified:** mp-react/src/utils/relatorioMensalPdf.js
- **Commit:** 4b073a3

## Known Stubs

None — o arquivo e um utilitario puro sem estados ou dados mocados.

## Verification Results

```
ALL CHECKS PASSED (node verify script)
vite build: built in 1.07s — sem erros de parse
```

## Self-Check: PASSED

- [x] mp-react/src/utils/relatorioMensalPdf.js criado e existe em disco
- [x] Commit 4b073a3 presente no log do git
- [x] export function agregarRelatorio — presente
- [x] export function gerarRelatorioMensalPdf — presente
- [x] getLucroLocal — definida e usada (3+ ocorrencias)
- [x] porStatus, porSeguradora, porTecnico — cada uma com 3+ ocorrencias
- [x] doc.save com relatorio_ no nome do arquivo
- [x] Apenas import jsPDF — sem firebase, sem react
- [x] Build Vite sem erros
