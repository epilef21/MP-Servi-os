---
plan: 05-01
phase: 05-compressao-imagens
status: complete
completed: 2026-05-04
requirements: [IMG-01, IMG-02, IMG-03]
commits: [866d8c0, 18c25ca]
---

## Summary

Compressão de imagens integrada ao formulário de orçamento do técnico — verificada pelo usuário com sucesso.

## What Was Built

- `browser-image-compression@2.0.2` instalado em `mp-react/package.json`
- `OrcamentoTecnicoPage.jsx` modificado com +83 linhas:
  - Import de `imageCompression` (default export) e `uploadFoto` (named export de `../firebase.js`)
  - Estados: `fotos` (array `{ file, preview }[]`), `comprimindo` (boolean), `erroFoto` (string)
  - Handler `handleFotoSelect`: adiciona arquivos com `URL.createObjectURL` ao array
  - Handler `removerFoto`: remove item e chama `URL.revokeObjectURL` para liberar memória
  - Bloco de compressão/upload no `handleSubmit`: `maxSizeMB: 0.4`, `useWebWorker: true`, catch que reseta ambos os estados antes de retornar
  - Campo `fotos: fotosUrls` adicionado ao payload do `updateDoc` (IMG-01)
  - Seção 7 no JSX: área de upload clicável, spinner "⏳ Comprimindo fotos..." (IMG-02), mensagem de erro com `var(--danger)` (IMG-03), grid de thumbnails com botão ✕

## Key Files

### Modified
- `mp-react/package.json` — browser-image-compression@2.0.2 adicionado em dependencies
- `mp-react/src/pages/OrcamentoTecnicoPage.jsx` — Seção 7 de Fotos adicionada

## Decisions

- Compressão ocorre no `handleSubmit` (não no `handleFotoSelect`) — evita bloqueio async no momento da seleção
- Estado nomeado `comprimindo` (não `uploadingFoto`) — reflete que o feedback visual corresponde à fase de compressão
- Um único catch para o batch de imagens (sem isolamento por arquivo) — mantém simplicidade
- `maxSizeMB: 0.4` exato (= 400KB) — conforme requisito IMG-01

## Requirements Met

- IMG-01: Fotos comprimidas para máx 400KB antes do upload ao Storage ✓
- IMG-02: Interface exibe feedback visual durante compressão ✓
- IMG-03: Mensagem de erro amigável exibida se compressão falhar ✓

## Self-Check: PASSED

Todos os critérios de aceitação do 05-01-PLAN.md verificados:
- browser-image-compression@2.0.2 em package.json ✓
- imageCompression importado como default + uploadFoto como named export ✓
- Três estados: fotos, comprimindo, erroFoto ✓
- handleFotoSelect com URL.createObjectURL ✓
- removerFoto com URL.revokeObjectURL ✓
- maxSizeMB: 0.4 no handleSubmit ✓
- catch reseta setComprimindo(false) E setSalvando(false) antes do return ✓
- Mensagem de erro usa var(--danger) — sem cor literal ✓
- fotos: fotosUrls no payload do updateDoc ✓
- JSX exibe ⏳ Comprimindo fotos... quando comprimindo === true ✓
- JSX exibe erroFoto em vermelho quando erroFoto !== '' ✓
- Grid renderiza thumbnails com botão de remoção ✓
- Verificação humana: APROVADA pelo usuário ✓
