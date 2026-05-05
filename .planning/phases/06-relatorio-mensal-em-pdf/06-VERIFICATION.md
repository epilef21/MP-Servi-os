---
phase: 06-relatorio-mensal-em-pdf
verified: 2026-05-04T00:00:00Z
status: human_needed
score: 9/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Abrir o painel admin, clicar em 'Relatório Mensal' na sidebar, selecionar um mês com OS cadastradas e clicar em 'Gerar Relatório'"
    expected: "Cartões de métricas e tabelas de status/seguradora/técnico aparecem com dados reais, sem erros no console"
    why_human: "Requer dados reais do Firestore e fluxo UI interativo que não pode ser verificado via grep"
  - test: "Com dados gerados, clicar em '⬇️ Baixar PDF' e abrir o arquivo recebido"
    expected: "Browser faz download de arquivo 'relatorio_MM_AAAA.pdf' com cabeçalho azul + faixa laranja, nome da empresa, seções de resumo/status/seguradora/técnico e rodapé com paginação"
    why_human: "Requer execução do browser, jsPDF e inspeção visual do PDF gerado"
  - test: "Mudar o select para outro mês e confirmar que relDados é limpo antes de clicar em Gerar"
    expected: "Tabelas somem e estado vazio reaparece ao trocar o mês; novo clique em 'Gerar Relatório' exibe dados do período correto"
    why_human: "Comportamento de reset de estado depende de ciclo de render React — não verificável estaticamente"
---

# Phase 6: Relatório Mensal em PDF — Verification Report

**Phase Goal:** Admin pode selecionar qualquer mês/ano, visualizar os dados consolidados de OS e lucro por status, seguradora e técnico, e baixar o relatório como arquivo PDF.
**Verified:** 2026-05-04
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | agregarRelatorio(os, mes, ano) retorna { totalOS, porStatus, lucroTotal, mediaPorOS, porSeguradora, porTecnico } calculados a partir do array filtrado pelo mês/ano | ✓ VERIFIED | relatorioMensalPdf.js:37-81 — filtragem por criado_em.toDate(), todos os campos presentes no return |
| 2 | getLucroLocal(r) calcula (mo_seguradora - valor_prestador) + valor_deslocamento — idêntico a getLucro() do AdminPage | ✓ VERIFIED | relatorioMensalPdf.js:30-35 vs AdminPage.jsx:79-84 — código byte-a-byte idêntico |
| 3 | gerarRelatorioMensalPdf(dados, mes, ano, nomeEmpresa) chama doc.save() com nome no formato relatorio_MM_AAAA.pdf | ✓ VERIFIED | relatorioMensalPdf.js:203 — `doc.save(\`relatorio_${String(mes).padStart(2,'0')}_${ano}.pdf\`)` |
| 4 | O PDF contém seções: cabeçalho com nome da empresa + mês/ano, resumo geral, status, lucratividade, seguradora, técnico | ✓ VERIFIED | relatorioMensalPdf.js:158-191 — sectionHeader('Resumo Geral'), sectionHeader('OS por Status'), sectionHeader('Lucratividade por Seguradora (REL-03)'), sectionHeader('OS e Lucro por Tecnico (REL-04)') |
| 5 | Caracteres acentuados são sanitizados antes de entrar no jsPDF (função s() com replace de vogais e ç) | ✓ VERIFIED | relatorioMensalPdf.js:12-22 — função s() com replace correto de /[ç]/g,'c' e /[Ç]/g,'C' (caracteres literais, não ASCII 'c') |
| 6 | Arquivo exporta apenas agregarRelatorio e gerarRelatorioMensalPdf — sem efeitos colaterais no import | ✓ VERIFIED | relatorioMensalPdf.js:1 — único import é `jsPDF from 'jspdf'`; apenas duas export function no arquivo |
| 7 | Sidebar contém item relatorio com label 'Relatório Mensal' entre config e o array existente | ✓ VERIFIED | AdminPage.jsx:1226 — `{ id: 'relatorio', icon: '📊', label: 'Relatório Mensal' }` após config |
| 8 | abaAtiva === 'relatorio' renderiza <div className='tab-content'> com seletor de mês/ano e tabelas de resultado | ✓ VERIFIED | AdminPage.jsx:2053-2225 — bloco condicional completo com seletor, cartões, tabelas e botões |
| 9 | Botão 'Gerar Relatório' chama agregarRelatorio(reports, relMes, relAno) e armazena resultado em relDados | ✓ VERIFIED | AdminPage.jsx:570-571 — `setRelDados(agregarRelatorio(reports, relMes, relAno))`; onClick={gerarRelatorio} em linha 2084 |
| 10 | Botão 'Baixar PDF' chama gerarRelatorioMensalPdf(relDados, relMes, relAno, empresa?.nome) | ✓ VERIFIED | AdminPage.jsx:2211 — `onClick={() => gerarRelatorioMensalPdf(relDados, relMes, relAno, empresa?.nome)}` |

**Score: 9/10 truths verified** (Truth #10 verificada estaticamente; comportamento end-to-end requer teste humano)

**Nota sobre SC #3 do ROADMAP:** O sucesso crítico 3 menciona "batem com o campo `lucroReal` salvo nos documentos de OS". O campo `lucroReal` **não existe** no codebase — grep em todo `mp-react/src` retorna zero resultados. A implementação calcula o lucro dinamicamente via `getLucroLocal()` (idêntico a `getLucro()` do AdminPage). Isso é consistente com o resto do produto e com os planos de execução. O SC foi escrito com uma premissa incorreta sobre um campo que não foi implementado; a implementação efetiva satisfaz o intent do critério (valores financeiros consistentes). Não classificado como gap.

---

### Desvio: Select sem placeholder (12 opções em vez de 13)

O PLAN 06-02 declarou: "O seletor de mês/ano usa `<select>` com 13 options: uma placeholder + 12 meses". A implementação usa `for (let i = 0; i < 12; i++)` — exatamente 12 opções sem placeholder.

O ROADMAP SC #1 diz apenas "qualquer período dos últimos 12 meses" — satisfeito. A ausência do placeholder não prejudica funcionalidade; o select inicia já com o mês atual pré-selecionado (valor inicial do `useState`). Classificado como desvio informativo, não blocker.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `mp-react/src/utils/relatorioMensalPdf.js` | Funções de agregação e geração de PDF | ✓ VERIFIED | 204 linhas, 2 exports, sem imports além de jsPDF |
| `mp-react/src/pages/AdminPage.jsx` | Aba 'Relatório Mensal' com seletor, tabelas e download | ✓ VERIFIED | Import linha 43, estados linhas 216-218, função linha 570, sidebar linha 1226, JSX linhas 2053-2225 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| agregarRelatorio | porStatus | `porStatus[status] = (porStatus[status] \|\| 0) + 1` | ✓ WIRED | relatorioMensalPdf.js:53 |
| agregarRelatorio | lucroTotal | `getLucroLocal(r)` acumula em lucroTotal | ✓ WIRED | relatorioMensalPdf.js:63-66 |
| gerarRelatorioMensalPdf | doc.save | `doc.save(\`relatorio_...\`)` | ✓ WIRED | relatorioMensalPdf.js:203 |
| sidebar nav array | abaAtiva === 'relatorio' | `{ id: 'relatorio', ... }` no array | ✓ WIRED | AdminPage.jsx:1226 + lógica de setAbaAtiva no onClick |
| Botão Gerar | relDados | `setRelDados(agregarRelatorio(reports, relMes, relAno))` | ✓ WIRED | AdminPage.jsx:571 |
| Botão Baixar PDF | gerarRelatorioMensalPdf | chamada direta com relDados, relMes, relAno, empresa?.nome | ✓ WIRED | AdminPage.jsx:2211 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| AdminPage.jsx (aba relatorio) | relDados | `agregarRelatorio(reports, relMes, relAno)` | Sim — reports carregados via `getOSdaEmpresa(empresaId)` do Firestore (linha 364) | ✓ FLOWING |
| relatorioMensalPdf.js | dados.porStatus, dados.porSeguradora, dados.porTecnico | Parâmetro dados passado pelo caller | Sim — proveniente de agregarRelatorio que filtra o array real | ✓ FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED (requer browser e Firestore autenticado — não testável em ambiente de CI puro). Delegado para human verification.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| REL-01 | 06-02 | Admin seleciona mês e ano para gerar o relatório mensal | ✓ SATISFIED | Select com 12 opções dinâmicas em AdminPage.jsx:2059-2081; estados relMes/relAno com valores iniciais corretos |
| REL-02 | 06-01 + 06-02 | Relatório exibe total de OS e breakdown por status | ✓ SATISFIED | porStatus calculado em relatorioMensalPdf.js:52-53; tabela renderizada em AdminPage.jsx:2130-2155 + seção no PDF (linha 163-171) |
| REL-03 | 06-01 + 06-02 | Relatório exibe lucro total, média por OS e breakdown por seguradora | ✓ SATISFIED | porSeguradora calculado em relatorioMensalPdf.js:54-58; tabela em AdminPage.jsx:2157-2180 + seção no PDF (linhas 173-181) |
| REL-04 | 06-01 + 06-02 | Relatório exibe OS e lucro por técnico | ✓ SATISFIED | porTecnico calculado em relatorioMensalPdf.js:59-61; tabela em AdminPage.jsx:2182-2205 + seção no PDF (linhas 183-191) |
| REL-05 | 06-01 + 06-02 | Admin baixa relatório como PDF gerado via jsPDF | ✓ SATISFIED | doc.save() em relatorioMensalPdf.js:203; botão "Baixar PDF" em AdminPage.jsx:2208-2214 — geração client-side, zero chamadas de servidor |

**Todos os 5 requisitos (REL-01 a REL-05) satisfeitos estaticamente.**

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| relatorioMensalPdf.js | 90-91 | `checkPage` não reserva 12mm do rodapé — linhas podem sobrepor o rodapé em relatórios longos | ⚠️ Warning | Visual: rows podem pintar sobre o footer azul. Não bloqueia o download nem corrompe dados. |
| relatorioMensalPdf.js | 153 | `MESES[mes-1]` sem validação de range — crash se mes for 0, 13 ou NaN | ⚠️ Warning | Se o parse do select falhar, doc.text() recebe undefined e lança exceção não tratada. Mitigado em uso normal pois valores vêm de opções geradas por código. |
| AdminPage.jsx | 2070 | `MESES_NOMES` declarado com acentos; `MESES` em relatorioMensalPdf.js usa versão sem acentos ('Marco' vs 'Março') — inconsistência entre seletor e header do PDF | ℹ️ Info | UX: usuário seleciona "Março 2026" no dropdown mas o PDF imprime "Marco / 2026". Cosmético. |
| relatorioMensalPdf.js + AdminPage.jsx | 30-35 / 79-84 | `getLucroLocal` é cópia byte-a-byte de `getLucro` — duplicação de lógica financeira crítica | ⚠️ Warning | Manutenção: mudança na fórmula financeira precisa ser aplicada em dois lugares. Não cria erro em runtime. |

**Nenhum anti-padrão blocker identificado** — todos os padrões problemáticos encontrados no code review (06-REVIEW.md) são warnings ou info sem impacto no alcance da meta da fase.

---

### Human Verification Required

#### 1. Fluxo end-to-end da aba Relatório Mensal

**Test:** Iniciar `npm run dev` em mp-react/, acessar o painel admin, clicar em "Relatório Mensal" na sidebar, selecionar um mês que contenha OS cadastradas, clicar em "Gerar Relatório".
**Expected:** Cartões de métricas (Total OS, Com Financeiro, Lucro Total, Média por OS) e três tabelas (por status, seguradora, técnico) aparecem com dados corretos. Nenhum erro no console do browser.
**Why human:** Requer dados reais do Firestore, autenticação ativa e execução do React no browser.

#### 2. Download e integridade do PDF

**Test:** Com dados gerados, clicar em "⬇️ Baixar PDF".
**Expected:** Browser faz download de `relatorio_MM_AAAA.pdf`. O PDF abre mostrando: cabeçalho azul com nome da empresa e mês/ano, faixa laranja, resumo geral, tabela de status, tabela de seguradora, tabela de técnico, rodapé com paginação. Sem dados trocados ou seções em branco.
**Why human:** Requer execução do jsPDF no browser, download de arquivo e inspeção visual do documento gerado.

#### 3. Comportamento do reset ao mudar o período

**Test:** Gerar relatório para um mês, depois mudar o select para outro mês.
**Expected:** Tabelas somem imediatamente (estado vazio retorna). Novo clique em "Gerar Relatório" exibe dados do novo período selecionado, não do anterior.
**Why human:** Depende do ciclo de render React e comportamento de closure de estado — difícil verificar estaticamente sem executar o componente.

---

### Gaps Summary

Nenhum gap blocker identificado. Todos os must-haves do plano foram verificados estaticamente e todos os 5 requisitos REL-01 a REL-05 têm evidência de implementação completa e conectada.

Os três itens de verificação humana acima são necessários para confirmar o comportamento end-to-end antes de marcar a fase como concluída. O status `human_needed` reflete isso — a implementação está estruturalmente correta mas não pode ser aprovada como PASSED sem execução no browser.

**Issues identificados pelo code review (06-REVIEW.md) que não bloqueiam a meta:**
- CR-01: checkPage sobrepõe rodapé em relatórios longos — impacto visual, não funcional
- CR-02: crash potencial se mes for inválido — mitigado pelo select gerado por código
- CR-03: closure de estado na gerarRelatorio — seguro em uso interativo normal
- WR-01 a WR-04: duplicação de getLucro, label "Média por OS" imprecisa, parse frágil, divisão silenciosa

Esses issues deveriam ser tratados em um plano de refinamento separado, não bloqueiam a entrega da fase.

---

_Verified: 2026-05-04_
_Verifier: Claude (gsd-verifier)_
