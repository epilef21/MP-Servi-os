---
phase: 07-faturamento-e-contas-a-receber
verified: 2026-07-03T00:34:08Z
status: passed
score: 5/5 roadmap success criteria verified; 10/10 FAT requirements satisfied
overrides_applied: 0
---

# Phase 7: Faturamento e Contas a Receber Verification Report

**Phase Goal:** Admin controla o ciclo completo de faturamento por seguradora — do código lançado na OS até a nota marcada como paga — sem nunca perder "onde parou" no lançamento no portal.
**Verified:** 2026-07-03T00:34:08Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin registra na OS finalizada os dois códigos de faturamento (MO + deslocamento opcional) com valor | ✓ VERIFIED | `DetalheOSModal.jsx:253-275` `saveCodigos()` grava `fat_codigo_mo/fat_valor_mo/fat_codigo_desloc/fat_valor_desloc`; UI em `DetalheOSModal.jsx:751-815` com dois pares de campos, deslocamento claramente opcional ("Deslocamento é opcional — deixe em branco se a OS não tiver") |
| 2 | Admin abre a fila de faturamento de uma seguradora e vê OS/códigos finalizados não lançados em nenhuma nota; Tempo/Maxpar aparecem sozinhos pelo num_assist | ✓ VERIFIED | `AbaFaturamento.jsx:57-103` monta `fila` via `useMemo` sobre `reports`, filtrando `fat_nota_*_id` vazio; ramo `SEGS_AUTO_NUM_ASSIST` usa `os.num_assist` sem exigir código (linhas 88-99) |
| 3 | Admin marca cada item como "lançado no portal" e o checklist persiste entre sessões | ✓ VERIFIED | `AbaFaturamento.jsx:127-147` `toggleLancado()` grava `fat_lancado_mo_em`/`fat_lancado_desloc_em`/`fat_lancado_em` via `atualizarOS` (Firestore) — não é apenas estado local; ao recarregar, a fila é reconstruída a partir de `reports` (dados do Firestore), preservando o estado |
| 4 | Admin edita valor na fila Tempo/Maxpar (OS como sugestão); vê divergência destacada na Mapfre/Allianz | ✓ VERIFIED | `AbaFaturamento.jsx:288-294` input editável com `onBlur → salvarValorFaturado`, texto "a OS diz {fmtBRL(item.valorSugerido)}"; linhas 280-287 usam `getDivergenciaFat` com badge verde "✓ bate" / vermelho "⚠ difere {valor}" |
| 5 | Fechar nota calcula data prevista pelo calendário, avisa período não faturável, mostra status aguardando/paga/atrasada, marcar paga quita todas as OS vinculadas | ✓ VERIFIED | `ModalFecharNota.jsx:23,60-82` usa `calcularDataPrevista`, bloqueia botão quando `naoFaturavel`, exibe preview verde; `AbaFaturamento.jsx:16-27` `statusNota()` deriva aguardando/paga/atrasada (nunca grava "atrasada"); `marcarNotaPaga` (linhas 199-211) grava `status:'paga'` + `Promise.all` quitando `fat_pago_em` em todas as OS vinculadas |

**Score:** 5/5 truths verified

### FAT-01..FAT-10 Requirements Coverage

| Requirement | Description | Status | Evidence |
|---|---|---|---|
| FAT-01 | Dois códigos por OS (MO + deslocamento opcional) com valor | ✓ SATISFIED | `DetalheOSModal.jsx` `saveCodigos()`, campos `fat_codigo_mo/fat_valor_mo/fat_codigo_desloc/fat_valor_desloc` |
| FAT-02 | Fila por seguradora dos códigos/OS finalizados não lançados em nenhuma nota | ✓ SATISFIED | `AbaFaturamento.jsx` `fila` useMemo, filtro `!os.fat_nota_*_id` |
| FAT-03 | Tempo/Maxpar entram automaticamente pelo num_assist | ✓ SATISFIED | `AbaFaturamento.jsx:88-99`, `SEGS_AUTO_NUM_ASSIST` de `utils/faturamento.js` |
| FAT-04 | Checklist "lançado no portal" com progresso persistente | ✓ SATISFIED | `toggleLancado()` grava no Firestore via `atualizarOS`; contagem "X lançados ✓ · Y faltando" (`AbaFaturamento.jsx:242`) |
| FAT-05 | Valor editável Tempo/Maxpar (sugestão da OS); divergência destacada Mapfre/Allianz | ✓ SATISFIED | `salvarValorFaturado`, `getDivergenciaFat` badges |
| FAT-06 | Fechar nota com número + data de emissão, vinculando itens lançados, total somado | ✓ SATISFIED | `ModalFecharNota.jsx` + `confirmarNota()` em `AbaFaturamento.jsx:167-196`, grava em `notasFiscais` |
| FAT-07 | Data prevista calculada pelo calendário da seguradora (Mapfre/Allianz pré-cadastrados, editável em Config; manual quando não há calendário) | ✓ SATISFIED | `utils/faturamento.js` `calcularDataPrevista`/`getRegrasFaturamento`; `ConfigTab.jsx` seção "Calendário de pagamento por seguradora" com `saveCalendario` gravando em `config.calendarioFaturamento`; `ModalFecharNota.jsx` campo manual quando `semCalendario` |
| FAT-08 | Aviso quando emissão cai em período não faturável (Allianz 26–31) | ✓ SATISFIED | `REGRAS_FATURAMENTO_PADRAO.Allianz` faixa `{26,31,naoFaturavel:true}`; testado em `faturamento.test.js`; `ModalFecharNota.jsx` bloqueia o botão de confirmar |
| FAT-09 | Notas com status aguardando/paga/atrasada + painel total a receber por seguradora | ✓ SATISFIED | `statusNota()` + `STATUS_NOTA_META`; painel `aReceber` (`AbaFaturamento.jsx:113-123,215-229`) |
| FAT-10 | Marcar paga quita todas as OS vinculadas de uma vez | ✓ SATISFIED | `marcarNotaPaga()` `Promise.all` sobre `nota.itens` gravando `fat_pago_em` |

**Requirements score:** 10/10 satisfied. No orphaned requirements found (all FAT-01..FAT-10 declared in plan frontmatter and present in REQUIREMENTS.md).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `mp-react/src/utils/faturamento.js` | Regras de calendário + cálculo puro | ✓ VERIFIED | 98 linhas, todos os 9 exports presentes (`REGRAS_FATURAMENTO_PADRAO`, `SEGS_COM_CODIGO`, `SEGS_AUTO_NUM_ASSIST`, `STATUS_FATURAVEIS`, `getRegrasFaturamento`, `calcularDataPrevista`, `proximoDiaUtil`, `getDivergenciaFat`, `digitosCodigo`); zero import de firebase/React |
| `mp-react/src/__tests__/faturamento.test.js` | Testes Vitest das funções puras | ✓ VERIFIED | 27 testes, todos verdes, cobre FAT-07/FAT-08 |
| `mp-react/src/components/admin/DetalheOSModal.jsx` | Dois códigos + migração legado + status somente-leitura | ✓ VERIFIED | 1031 linhas; `saveCodigos`, migração `?? selected.fat_codigo ??`, sem `marcarLancado`/`savingLancado`, Passo 3 somente leitura apontando para a fila |
| `mp-react/src/components/admin/ConfigTab.jsx` | Calendários editáveis Mapfre/Allianz | ✓ VERIFIED | 710 linhas; `saveCalendario`, `setFaixa`, `normalizarFaixa`, mescla em `config.calendarioFaturamento`, espelho Mondial=Allianz, sub-aba `calendario` (Google Calendar) preservada intacta |
| `mp-react/src/components/admin/faturamento/AbaFaturamento.jsx` | Fila + checklist persistente + notas + status + painel | ✓ VERIFIED | 338 linhas; fila derivada, toggleLancado, salvarValorFaturado, copiarCodigos, confirmarNota, marcarNotaPaga, painel aReceber |
| `mp-react/src/components/admin/faturamento/ModalFecharNota.jsx` | Modal fechar nota com preview de data prevista | ✓ VERIFIED | 103 linhas; usa `calcularDataPrevista`, bloqueia não-faturável, campo manual sem calendário |
| `mp-react/src/components/admin/FinanceiroEmpresaTab.jsx` | Nova aba "📄 Faturamento" | ✓ VERIFIED | import + entrada `{ id: 'faturamento', ... }` + render condicional `abaFin === 'faturamento'` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `utils/faturamento.js` | `config.calendarioFaturamento` | `getRegrasFaturamento(config, seguradora)` com fallback | ✓ WIRED | Pattern `config?.calendarioFaturamento` confirmado na linha 46 |
| `DetalheOSModal.jsx` | `checklist/{osId}` | `atualizarOS(empresaId, selected.id, {fat_codigo_mo,...})` | ✓ WIRED | `saveCodigos()` linha 268 |
| `DetalheOSModal.jsx` | `utils/faturamento.js` | `import { SEGS_COM_CODIGO, digitosCodigo }` | ✓ WIRED | Import real na linha 20, sem definição local duplicada |
| `ConfigTab.jsx` | config doc via updateDoc | `updateDoc(refConfig(empresaId), { calendarioFaturamento })` | ✓ WIRED | Linha 283 |
| `AbaFaturamento.jsx` | `checklist/{osId}` | `atualizarOS(...)` para toggle/valor/vínculo/quitação | ✓ WIRED | 4 pontos de escrita distintos (`toggleLancado`, `salvarValorFaturado`, `confirmarNota`, `marcarNotaPaga`) |
| `AbaFaturamento.jsx` | `utils/faturamento.js` | import de constantes + `getDivergenciaFat` | ✓ WIRED | Linha 12 |
| `FinanceiroEmpresaTab.jsx` | `AbaFaturamento.jsx` | import + render condicional | ✓ WIRED | Linhas 21, 476, 542 |
| `ModalFecharNota.jsx` | `empresas/{empresaId}/notasFiscais` | `addDoc` (em AbaFaturamento, que orquestra) | ✓ WIRED | `confirmarNota()` em `AbaFaturamento.jsx:174` |
| `ModalFecharNota.jsx` | `utils/faturamento.js` | `import { calcularDataPrevista }` | ✓ WIRED | Linha 9 |

### Single Source of Truth do "Lançado" (Critério Crítico)

Verificado explicitamente: nenhum handler de gravação de `fat_lancado_*` resta em `DetalheOSModal.jsx`.
- `grep -c "marcarLancado"` → 0
- `grep -c "savingLancado"` → 0
- `grep -c "fat_lancado_em: serverTimestamp"` → 0
- O modal só LÊ (`moLancadoEm`, `deslocLancadoEm`, `selected.fat_lancado_em`) e aponta para a fila ("Para marcar como lançado, use o checklist da fila em Financeiro → 📄 Faturamento.")
- A única gravação de `fat_lancado_*` no código-fonte está em `AbaFaturamento.jsx` (`toggleLancado`)

### LOCKED Decisions from CONTEXT.md — Checklist

| Decisão LOCKED | Status | Evidência |
|---|---|---|
| Mapfre/Allianz/Mondial: dois códigos por OS (MO + deslocamento opcional) | ✓ | `DetalheOSModal.jsx` |
| Tempo/Maxpar: sem código, fila automática por num_assist | ✓ | `AbaFaturamento.jsx:88-99` |
| Valor editável Tempo/Maxpar com sugestão da OS | ✓ | `AbaFaturamento.jsx:288-294` |
| Divergência destacada (não bloqueia) Mapfre/Allianz | ✓ | `getDivergenciaFat` + badges verde/vermelho, sem disable de nenhum botão |
| Checklist persistente com contagem de progresso | ✓ | `toggleLancado` + "X lançados ✓ · Y faltando" |
| MO e deslocamento como itens SEPARADOS no checklist | ✓ | `fila` gera itens `tipo:'mo'` e `tipo:'desloc'` distintos |
| Migração legado `fat_codigo`/`fat_valor_aprovado`/`fat_lancado_em` na leitura e gravação | ✓ | Leitura: `os.fat_codigo_mo \|\| os.fat_codigo`; Gravação: `toggleLancado` zera `fat_lancado_em` ao gravar `fat_lancado_mo_em` |
| Calendários Mapfre/Allianz com as faixas exatas do CONTEXT.md | ✓ | `REGRAS_FATURAMENTO_PADRAO` reproduz exatamente as faixas (01-10→+1m dia1; 11-25→+1m dia16; 26-31→+2m dia1; Allianz 01-03→dia13; 04-10→dia25; 11-20→+1m dia3; 21-25→+1m dia13; 26-31→naoFaturavel) — testado em `faturamento.test.js` |
| Aviso/bloqueio Allianz 26-31 | ✓ | `ModalFecharNota.jsx` desabilita o botão de confirmar quando `prev.naoFaturavel` |
| Data manual quando sem calendário (Tempo/Maxpar) | ✓ | `ModalFecharNota.jsx` campo `dataManual` obrigatório quando `semCalendario` |
| Status atrasada derivado, nunca gravado | ✓ | `statusNota()` calcula na leitura; nenhum grep de "status: 'atrasada'" persistido |
| Marcar paga quita OS via `fat_nota_*_id` / `fat_pago_em` | ✓ | `marcarNotaPaga()` |
| Fim de semana empurra para próximo dia útil | ✓ | `proximoDiaUtil` + testes |
| Calendário editável na Config sem apagar outras chaves | ✓ | `saveCalendario` mescla explicitamente só `calendarioFaturamento` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Suite de testes Vitest completa (113 testes, incluindo os 27 de faturamento) | `cd mp-react && npx vitest run` | `Test Files 9 passed (9)` / `Tests 113 passed (113)` | ✓ PASS |
| Build de produção sem erro | `cd mp-react && npx vite build` | `✓ built in 839ms` (apenas warning de chunk size, não erro) | ✓ PASS |
| Cálculo de data prevista (Mapfre 26-31 e Allianz 26-31) | Testes unitários dedicados | Ambos passam conforme tabela do CONTEXT.md | ✓ PASS |

### Anti-Patterns Found

Nenhum bloqueador encontrado. Nenhum `TODO`/`FIXME`/`placeholder` nos arquivos-chave da fase. Nenhum handler stub (`onClick={() => {}}`) nos componentes de faturamento. Nenhum retorno estático vazio nas funções de leitura/gravação Firestore.

### Human Verification Required

Nenhum item requer verificação humana obrigatória para aprovar esta fase — toda a lógica crítica (cálculo de calendário, migração de legado, checklist persistente, fechamento/quitação de nota) é verificável via grep/teste automatizado e foi confirmada. Itens abaixo são sugestões de checagem visual opcional (não bloqueiam o status `passed`):

1. **Aparência da fila e do modal de fechar nota**
   **Test:** Abrir a aba Financeiro → 📄 Faturamento com dados reais de OS Mapfre e Tempo.
   **Expected:** Layout legível, cores de divergência (verde/vermelho) e badge de status de nota corretos visualmente.
   **Why human:** Aparência visual não é verificável por grep/build.

### Gaps Summary

Nenhum gap encontrado. Todos os 5 critérios de sucesso do ROADMAP.md, todas as 10 requirements FAT-01..FAT-10, e todas as decisões LOCKED do CONTEXT.md foram verificadas diretamente no código-fonte (não apenas nas SUMMARY.md). A suite de 113 testes passa e o build de produção conclui sem erro. A fonte única de verdade do checklist "lançado no portal" foi confirmada — o `DetalheOSModal.jsx` não contém mais nenhum handler de gravação de `fat_lancado_*`.

---

_Verified: 2026-07-03T00:34:08Z_
_Verifier: Claude (gsd-verifier)_
