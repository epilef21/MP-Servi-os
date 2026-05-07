---
phase: 06-relatorio-mensal-em-pdf
plan: "02"
subsystem: frontend-admin
tags: [relatorio, pdf, admin, sidebar, ui]
dependency_graph:
  requires: [06-01]
  provides: [REL-01, REL-02, REL-03, REL-04, REL-05]
  affects: [mp-react/src/pages/AdminPage.jsx]
tech_stack:
  added: []
  patterns:
    - Aba condicional {abaAtiva === 'relatorio'} seguindo padrão existente das outras abas
    - Agregação client-side via agregarRelatorio (sem nova query Firestore)
    - Geração de PDF client-side via jsPDF (sem servidor)
    - Seletor de período com valores fixos gerados por loop (sem input livre)
key_files:
  created: []
  modified:
    - mp-react/src/pages/AdminPage.jsx
decisions:
  - "Seletor de período com 12 opções geradas por loop (for i < 12) — sem input livre para evitar valores inválidos"
  - "agregarRelatorio filtra client-side nos reports já carregados — sem nova query Firestore"
  - "Tabelas inline com style props — sem adicionar novas classes CSS conforme orientação do CLAUDE.md"
  - "Mudar o select limpa relDados para forçar nova geração (evita dados desatualizados)"
  - "gerarRelatorio() inserida antes de buildLink() como função helper simples"
  - "Item relatorio adicionado ao final do array da sidebar após config"
metrics:
  duration: "~8 min"
  completed: "2026-05-04"
  tasks_completed: 4
  files_modified: 1
---

# Phase 6 Plan 02: Aba Relatório Mensal no AdminPage Summary

Aba "Relatório Mensal" adicionada ao AdminPage com seletor de período, tabelas agregadas por status/seguradora/técnico e download PDF client-side via jsPDF.

## Tasks Executadas

| Task | Nome | Commit | Arquivos |
|------|------|--------|----------|
| 1 | Import de relatorioMensalPdf.js | b6c3c0b | AdminPage.jsx |
| 2 | Estados relMes, relAno, relDados | 7c5d6ab | AdminPage.jsx |
| 3 | Função gerarRelatorio + item sidebar | 630173b | AdminPage.jsx |
| 4 | Seção JSX {abaAtiva === 'relatorio'} | 326a99c | AdminPage.jsx |

## O que foi entregue

- **REL-01 (seletor mês/ano):** Select com 12 opções dinâmicas (mês atual até 11 meses atrás), resetando relDados ao mudar
- **REL-02 (por status):** Tabela Status | Quantidade | Percentual com labels em português
- **REL-03 (seguradora + lucro):** Tabela Seguradora | OS | Lucro Total, ordenada por lucro decrescente
- **REL-04 (por técnico):** Tabela Técnico | OS | Lucro Total, ordenada por lucro decrescente
- **REL-05 (download PDF):** Botão "Baixar PDF" chama gerarRelatorioMensalPdf(relDados, relMes, relAno, empresa?.nome)
- **UX adicional:** 4 cartões de métricas (Total OS, Com Financeiro, Lucro Total, Média por OS), estado vazio antes de gerar, botão Limpar

## Deviations from Plan

None - plano executado exatamente como escrito.

## Verificações

```
grep "from '../utils/relatorioMensalPdf" mp-react/src/pages/AdminPage.jsx  → FOUND (linha 43)
grep "relMes|relAno|relDados" mp-react/src/pages/AdminPage.jsx             → FOUND (linhas 216-218)
grep "id: 'relatorio'" mp-react/src/pages/AdminPage.jsx                   → FOUND (linha 1226)
grep "abaAtiva === 'relatorio'" mp-react/src/pages/AdminPage.jsx           → FOUND
grep "Baixar PDF" mp-react/src/pages/AdminPage.jsx                        → FOUND
npm run build                                                              → ✓ built in 981ms (sem erros)
```

## Known Stubs

None — todas as tabelas usam dados reais de relDados (retorno de agregarRelatorio sobre reports do Firestore).

## Threat Flags

Nenhum — sem nova superfície de rede, auth ou schema. PDF gerado e salvo localmente pelo admin autenticado (T-06-02 aceito no plano).

## Self-Check: PASSED

- Arquivo AdminPage.jsx modificado: FOUND
- Commits existem: b6c3c0b, 7c5d6ab, 630173b, 326a99c — FOUND
- Build sem erros: PASSED
