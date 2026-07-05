# Phase 11: Exportação e Fechamento do Mês - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning
**Source:** Planejamento do milestone v1.2 confirmado com o usuário (2026-07-02)

<domain>
## Phase Boundary

Baixar o DRE do mês em PDF (client-side, jsPDF) e "fechar o mês": travar os lançamentos financeiros do período contra alteração acidental. NÃO inclui: exportação em planilha/Excel, fechamento com aprovação de contador, assinatura no PDF.

</domain>

<decisions>
## Implementation Decisions

### O que o usuário pediu (LOCKED)
- **EXP-01**: botão "⬇ Baixar DRE em PDF" na aba DRE do FinanceiroEmpresaTab. PDF gerado no browser via **jsPDF** (lib já instalada), reaproveitando o padrão de `utils/relatorioMensalPdf.js`. O PDF contém as mesmas seções da tela: receita bruta (OS + particulares + margem material), deduções, receita líquida, custos variáveis, lucro bruto, resultado financeiro, despesas fixas por grupo, lucro líquido + margem. Cabeçalho com nome da empresa e mês.
- **EXP-02**: "🔒 Fechar o mês" — trava os lançamentos financeiros do mês fechado contra alteração acidental:
  - Doc por mês em `empresas/{empresaId}/fechamentosMes/{mesRef}` (id = YYYY-MM): `{ fechado: true, fechado_em, fechado_por? }`.
  - Com o mês fechado, as abas do Financeiro (despesas, particulares, impostos, faturamento, técnicos) **escondem/desabilitam** botões de criar/editar/excluir/pagar daquele mês e mostram banner "Mês fechado em DD/MM — reabra para alterar".
  - **Reabrir mês** é possível (botão no mesmo lugar, com confirmação) — o objetivo é evitar alteração ACIDENTAL, não impedir correção.
  - Enforcement client-side (mesmo padrão de risco aceito das Fases 7-8, single-admin). Registrar como risco aceito no threat model.

### Decisões técnicas (LOCKED)
- **NOVA COLEÇÃO `fechamentosMes` ⇒ OBRIGATÓRIO adicionar regra no firestore.rules E rodar `npx firebase deploy --only firestore:rules` como tarefa do plano** (aprendizado da Fase 7 — sem isso: "Missing or insufficient permissions").
- PDF: lazy-load do jsPDF (import dinâmico) como já é feito no relatório mensal — não aumentar o bundle inicial.
- Estado "mês fechado" carregado no FinanceiroEmpresaTab (uma leitura por mês selecionado) e distribuído às abas via props — decidir mecanismo simples (prop `mesFechado`).
- Lógica pura (ex.: montagem das linhas do PDF a partir do objeto dre) pode ser testada; a geração do PDF em si não precisa de teste automatizado (padrão do relatório mensal existente).

### Onde vive na UI (LOCKED)
- Botão do PDF: aba DRE, junto ao título/topo.
- Fechar/reabrir mês: no cabeçalho do Financeiro (perto do seletor de mês), com cadeado indicando o estado.

### Claude's Discretion
- Nome/ordem exata das seções no PDF (seguir a tela).
- Quais botões exatamente desabilitar por aba (regra geral: qualquer ação que grave lançamento do mês fechado; ações de leitura e navegação continuam).
- Se o botão "✓ Pagar" de despesa de mês fechado fica oculto ou desabilitado com tooltip — escolher o mais claro.
- Detalhe: fechar o mês NÃO impede fechar nota de faturamento cuja fila tem OS de meses variados — faturamento é por seguradora, não por mês; travar apenas ações claramente mensais (despesas, particulares, impostos, fechamento de técnicos do mês, marcar nota como paga pode continuar — decidir e documentar).

</decisions>

<canonical_refs>
## Canonical References

- `mp-react/src/components/admin/FinanceiroEmpresaTab.jsx` — aba DRE (AbaDRE, objeto dre de calcularDRE), cabeçalho com seletor de mês, todas as abas internas.
- `mp-react/src/utils/relatorioMensalPdf.js` — padrão jsPDF existente (lazy import, tableRow, checkPage).
- `mp-react/src/components/admin/RelatorioTab.jsx` — como o botão de download chama o gerador.
- `firestore.rules` — padrão de regra por subcoleção (fechamentosTecnicos é o exemplo mais recente).
- `CLAUDE.md` — decisões de teste e deploy.

</canonical_refs>

<specifics>
## Specific Ideas

- PDF vai para o contador no fim do mês — legível e simples, sem enfeite.
- Usuário não técnico: cadeado 🔒/🔓 e texto claro ("Mês fechado — os lançamentos de Junho estão protegidos").

</specifics>

<deferred>
## Deferred Ideas

- Exportação em Excel/CSV — não pedido.
- Recibo PDF do fechamento de técnico — se o usuário pedir depois.
- Enforcement server-side do mês fechado (rules com lookup) — aceito client-side nesta versão.

</deferred>

---

*Phase: 11-exportacao-e-fechamento-do-mes*
*Context gathered: 2026-07-05*
