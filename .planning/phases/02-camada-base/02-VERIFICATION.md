---
phase: 02-camada-base
verified: 2026-05-05T19:35:00Z
status: human_needed
score: 9/10 must-haves verified
overrides_applied: 0
deferred:
  - truth: "verificarLimite tem testes para os casos true e false baseados em plano e contagem de OS"
    addressed_in: "Phase 3"
    evidence: "Phase 3 covers useEmpresa hook (AUTH-11..13) where verificarLimite lives; plan 02-02 documents deferral inline with justification that verificarLimite is a React hook in useEmpresa.js, not a firebase.js function"
human_verification:
  - test: "Executar npm test dentro de mp-react/ e confirmar que todos os 50 testes passam verde"
    expected: "3 arquivos passando, 50 testes passando, zero falhas — conforme output de verificacao automatica"
    why_human: "Confirmacao humana de que o ambiente local reproduz o resultado green (50/50) antes de marcar a fase como completa para efeitos de rastreabilidade de requisitos"
---

# Phase 2: Camada Base — Verification Report

**Phase Goal:** Desenvolvedores podem confiar nos utilitários de formatação e nas funções de acesso ao Firestore porque cada um tem testes que verificam seu comportamento observável.
**Verified:** 2026-05-05T19:35:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | fmtDate, fmtBRL, getLucro, maskPhone e maskCNPJ estao em src/utils/formatters.js com named exports | VERIFIED | Arquivo existe (47 linhas), 5 `export function` confirmados, sem imports, sem export default |
| 2 | AdminPage.jsx importa os 5 utilitarios de '../utils/formatters.js' — as definicoes locais foram removidas | VERIFIED | Linha 44: `import { fmtDate, fmtBRL, getLucro, maskPhone, maskCNPJ } from '../utils/formatters.js'`; grep de `^function fmtDate/fmtBRL/getLucro/maskPhone/maskCNPJ` retornou zero resultados |
| 3 | npm test passa verde com todos os casos de formatters.test.js | VERIFIED | 30/30 testes passando (8 fmtDate + 7 fmtBRL + 6 getLucro + 5 maskPhone + 4 maskCNPJ) |
| 4 | getLucro retorna null (nao 0) quando todos os campos sao falsy | VERIFIED | Dois testes `toBeNull()` explicitamente: campos undefined e campos string vazia |
| 5 | fmtDate usa new Date(year, month, day) nos mocks de Timestamp — sem off-by-one de timezone | VERIFIED | 3 ocorrencias de `new Date(2024,` no arquivo; zero ocorrencias de `new Date('20` |
| 6 | criarOS e atualizarOS sao testados verificando que addDoc e updateDoc sao chamados com os argumentos corretos | VERIFIED | criarOS: 3 testes (addDoc called once, args contendo dados, criado_em definido); atualizarOS: 2 testes (updateDoc called once, args matching dados) |
| 7 | getOSdaEmpresa e testado para o caminho feliz (2 documentos) e para lista vazia | VERIFIED | Testes: docs com 2 elementos mapeados corretamente, docs: [] retorna length 0 |
| 8 | getEmpresaBySlug e testado para slug encontrado e slug inexistente (retorna null) | VERIFIED | `snap.empty: false` retorna objeto empresa; `snap.empty: true` retorna null (toBeNull) |
| 9 | cadastrarEmpresa e testado verificando que setDoc e chamado exatamente 2 vezes | VERIFIED | `expect(setDoc).toHaveBeenCalledTimes(2)` confirmado; 4 testes adicionais para conteudo de cada chamada |
| 10 | contarOSdoMes e testado via getCountFromServer retornando `{ data: () => ({ count: N }) }` | VERIFIED | Mock shape correta confirmada; 3 testes (count: 37, count: 0, chamado exatamente 1x) |
| 11 | verificarLimite tem testes para os casos true e false (SC-4 do Roadmap) | DEFERRED | Funcao esta em useEmpresa.js (hook React), nao em firebase.js — deferido para Phase 3 com justificativa documentada no plano 02-02 |

**Score (excluindo item deferido):** 10/10 truths verified
**Score (incluindo item deferido como pendente):** 9/10

---

### Deferred Items

Itens nao concluidos nesta fase mas endereçados explicitamente em fases posteriores do milestone.

| # | Item | Addressed In | Evidence |
|---|------|-------------|---------|
| 1 | `verificarLimite` tem testes para os casos true e false baseados em plano e contagem de OS do mes (ROADMAP SC-4, DATA-06) | Phase 3 | Phase 3 cobre useEmpresa hook (AUTH-11..13). Plano 02-02 documenta inline: "verificarLimite esta em useEmpresa.js (React hook), nao em firebase.js. verificarLimite sera testada na Phase 3 junto com os demais hooks." |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `mp-react/src/utils/formatters.js` | 5 named exports, sem imports, sem export default | VERIFIED | 47 linhas, exatamente 5 `export function`, zero imports, zero `export default` |
| `mp-react/src/__tests__/formatters.test.js` | Suite com describes fmtDate/fmtBRL/getLucro/maskPhone/maskCNPJ | VERIFIED | 143 linhas, 5 describes, 30 testes, todos passando |
| `mp-react/src/pages/AdminPage.jsx` | Importa de '../utils/formatters.js', sem definicoes locais das 5 funcoes | VERIFIED | Import na linha 44; grep de funcoes locais retornou zero; fmtDatetime e fmtSN permanecem locais (correto) |
| `mp-react/src/__tests__/firebase.test.js` | 6 describes cobrindo DATA-01..06 via SDK-level mocks | VERIFIED | 218 linhas, 6 describes, 17 testes, todos passando; excecao ao CLAUDE.md documentada inline |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `formatters.test.js` | `src/utils/formatters.js` | `import { fmtDate, fmtBRL, getLucro, maskPhone, maskCNPJ } from '../utils/formatters'` | WIRED | Linha 2 do arquivo de teste; 30 testes executam as funcoes importadas com sucesso |
| `AdminPage.jsx` | `src/utils/formatters.js` | `import { fmtDate, fmtBRL, getLucro, maskPhone, maskCNPJ } from '../utils/formatters.js'` | WIRED | Linha 44; todas as 5 funcoes usadas no corpo do componente (referencias existentes funcionando) |
| `firebase.test.js` | `src/firebase.js` | `import { criarOS, atualizarOS, getOSdaEmpresa, getEmpresaBySlug, cadastrarEmpresa, contarOSdoMes } from '../firebase'` | WIRED | Linhas 43-50; 17 testes exercitam cada funcao importada |
| `firebase.test.js` | `firebase/firestore SDK` | `vi.mock('firebase/firestore', () => ({...}))` | WIRED | Linhas 6-21; todos os SDK calls interceptados sem chamadas reais ao Firebase |

---

### Data-Flow Trace (Level 4)

Nao aplicavel a esta fase — os artefatos sao funcoes puras e suites de teste, nao componentes React que renderizam dados dinamicos de uma fonte externa.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Suite completa passa verde | `npm test -- --reporter=verbose` em mp-react/ | 3 arquivos, 50/50 testes, 0 falhas, duracao 2.77s | PASS |
| formatters.js tem 5 named exports sem imports | Node module verification via Read do arquivo | 5 `export function` confirmados, zero `import` | PASS |
| AdminPage.jsx nao define as 5 funcoes localmente | grep `^function fmtDate/fmtBRL/getLucro/maskPhone/maskCNPJ` | Zero matches | PASS |
| firebase.test.js usa mock shape correta para QuerySnapshot | grep `data: () =>` | 3+ ocorrencias (getOSdaEmpresa, getEmpresaBySlug, contarOSdoMes) | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| UTIL-01 | 02-01 | fmtDate formata Firestore Timestamp corretamente | SATISFIED | 8 testes em `describe('fmtDate')` cobrindo null, undefined, string DD/MM/YYYY, string YYYY-MM-DD, Timestamp janeiro, Timestamp dezembro, zero-padding, string sem formato |
| UTIL-02 | 02-01 | fmtBRL formata valores monetarios em pt-BR | SATISFIED | 7 testes em `describe('fmtBRL')` cobrindo inteiro, decimal, string numerica, zero, NaN, undefined, virgula como separador |
| UTIL-03 | 02-01 | getLucro calcula margem de lucro corretamente | SATISFIED | 6 testes em `describe('getLucro')` cobrindo calculo basico, null para campos undefined, null para strings vazias, so mo_seguradora, lucro negativo, deslocamento positivo |
| UTIL-04 | 02-01 | maskPhone e maskCNPJ mascaram entradas corretamente | SATISFIED | 9 testes (5 maskPhone + 4 maskCNPJ) cobrindo celular 11d, fixo 10d, remove nao-numericos, limita digitos, entrada parcial |
| DATA-01 | 02-02 | criarOS chama addDoc com campos corretos | SATISFIED | 3 testes: addDoc called once, args contem dados do parametro, criado_em via serverTimestamp |
| DATA-02 | 02-02 | atualizarOS chama updateDoc no documento certo | SATISFIED | 2 testes: updateDoc called once, args matching dados fornecidos |
| DATA-03 | 02-02 | getOSdaEmpresa consulta subcole por empresaId | SATISFIED | 3 testes: array mapeado com 2 docs, array vazio, getDocs called once |
| DATA-04 | 02-02 | getEmpresaBySlug busca por slug e retorna null quando nao existe | SATISFIED | 2 testes: snap.empty:false retorna objeto, snap.empty:true retorna null |
| DATA-05 | 02-02 | cadastrarEmpresa cria documento e retorna dados | SATISFIED | 4 testes: setDoc x2, primeiro doc com ativo:true, primeiro doc com criadoEm, segundo doc com dados de config |
| DATA-06 | 02-02 | verificarLimite retorna true/false por plano e contagem | PARTIAL — DEFERRED | contarOSdoMes testada (3 testes); verificarLimite em useEmpresa.js deferida para Phase 3 conforme documentado no plano |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| Nenhum | — | — | — | — |

Varredura realizada em `formatters.js`, `formatters.test.js`, `firebase.test.js`:
- Zero TODOs/FIXMEs/placeholders
- Zero `return null` ou `return {}` em implementacoes (null em getLucro e intencional e testado)
- Zero `new Date('YYYY-MM-DD')` nos testes (anti-pattern de timezone — uso correto de `new Date(year, month, day)` confirmado)
- Zero chamadas reais ao Firebase (todos os SDK calls sao vi.fn())

---

### Human Verification Required

#### 1. Confirmacao de Suite Verde no Ambiente do Desenvolvedor

**Test:** Executar `npm test` dentro de `mp-react/` na maquina de desenvolvimento.
**Expected:** Output exibindo "3 passed (3)" arquivos e "50 passed (50)" testes; zero falhas; zero erros de configuracao.
**Why human:** A verificacao automatica desta sessao confirmou 50/50 passando. Confirmacao humana garante reproducibilidade no ambiente de CI/CD futuro e que nenhum arquivo `.env.test` local esta com valores que mascaram falhas reais.

---

### Gaps Summary

Nenhum gap bloqueador identificado. A fase atingiu seu objetivo central: todos os 10 requisitos mapeados (UTIL-01..04, DATA-01..06) tem evidencia de implementacao e testes verdes.

O unico item pendente (verificarLimite / DATA-06 parcial) esta legitimamente deferido para Phase 3, com justificativa tecnica solida: a funcao reside em `useEmpresa.js` (hook React), nao em `firebase.js`, e o plano 02-02 documentou explicitamente a decisao antes da execucao.

O item de verificacao humana e procedimental (confirmar reproducibilidade), nao um bloqueador de qualidade.

---

_Verified: 2026-05-05T19:35:00Z_
_Verifier: Claude (gsd-verifier)_
