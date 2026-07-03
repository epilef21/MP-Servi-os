# Phase 8: Fechamento de Técnicos - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning
**Source:** Planejamento do milestone v1.2 confirmado com o usuário (conversa de 2026-07-02)

<domain>
## Phase Boundary

Fechamento mensal de pagamento dos técnicos: quanto devo a cada técnico no mês, quais OS compõem esse valor, marcar como pago com data e manter histórico consultável. Inclui chave PIX e forma de pagamento no cadastro do técnico. NÃO inclui: contas a pagar gerais (Phase 9), fluxo de caixa (Phase 10), comissão percentual automática (não existe no modelo do usuário — o valor do técnico já é definido por OS no campo `valor_prestador`).

</domain>

<decisions>
## Implementation Decisions

### O que o usuário pediu (LOCKED)
- **TEC-01**: cadastro do técnico ganha **chave PIX** e **forma de pagamento** (ex.: PIX, dinheiro, transferência). Campos simples no TecnicosTab existente.
- **TEC-02**: fechamento mensal por técnico — para o mês selecionado, ver por técnico: lista das OS dele com `valor_prestador` de cada uma e o **total a pagar**.
- **TEC-03**: marcar o fechamento do técnico como **pago** (com data), mantendo **histórico consultável** — protege o usuário em discussões de "você não me pagou aquela OS".
- Motivação (da conversa): hoje não existe fechamento nenhum; o pagamento é de cabeça/WhatsApp.

### Modelo de negócio relevante (da conversa e do código)
- O valor devido ao técnico por OS já existe: campo `valor_prestador` na OS (`empresas/{id}/checklist/{osId}`).
- O técnico da OS está nos campos `tecnico_nome` (nome, texto livre) e `tecnico_id` (id do cadastro, quando selecionado) — confirmado em DetalheOSModal.jsx/NovaOSModal.jsx. NÃO existe campo `tecnico` na OS. Técnicos cadastrados vivem em `empresas/{id}/tecnicos`. Casar por `tecnico_id` primeiro, com fallback por nome normalizado.
- Mês de referência: mesmo padrão `mesRef` (YYYY-MM) do FinanceiroEmpresaTab, navegável ◄ ►.

### Onde vive na UI (LOCKED)
- Nova aba interna "👷 Técnicos" no FinanceiroEmpresaTab (padrão das abas internas: dre / despesas / particulares / impostos / faturamento).
- Campos PIX/forma de pagamento: no modal/formulário de técnico existente no TecnicosTab (aba de administração já existente).

### Claude's Discretion
- Modelagem do fechamento no Firestore (sugestão: `empresas/{id}/fechamentosTecnicos` com um doc por técnico+mês: tecnico, mes_referencia, os_ids snapshot, total, status pago/pendente, pago_em; status "pendente" pode ser derivado — só gravar quando pagar, como as notas da Fase 7).
- Como casar OS ↔ técnico (campo `tecnico` é nome livre; normalizar comparação como normSeguradora fez na Fase 7).
- OS do mês: usar `criado_em` (mesmo critério do DRE em calcularDRE) — manter consistência com o DRE.
- Se uma OS mudar de valor depois de um fechamento pago: o fechamento guarda snapshot (os_ids + total na época) — histórico imutável.
- Detalhes visuais: seguir padrão das abas existentes (fin-tabs, empty-state, btn-sm etc.).
- Firestore rules: adicionar regra para a nova coleção (mesma linha das outras coleções financeiras) — APRENDIZADO da Fase 7: coleção nova sem regra = "Missing or insufficient permissions". Incluir deploy das rules como tarefa.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Código existente (padrões a seguir)
- `mp-react/src/components/admin/FinanceiroEmpresaTab.jsx` — abas internas + mesRef + CRUD por subcoleção + calcularDRE (critério de "OS do mês" via criado_em).
- `mp-react/src/components/admin/faturamento/AbaFaturamento.jsx` — aba criada na Fase 7: derivação em memória de reports, status derivado, marcar pago com update em lote, normSeguradora.
- `mp-react/src/components/admin/TecnicosTab.jsx` — cadastro de técnicos (onde entram PIX e forma de pagamento).
- `mp-react/src/utils/faturamento.js` — helpers puros da Fase 7 (normSeguradora).
- `firestore.rules` — regras por subcoleção; nova coleção precisa de regra + `npx firebase deploy --only firestore:rules`.
- `.planning/phases/07-faturamento-e-contas-a-receber/07-PATTERNS.md` — excertos de código dos padrões (ainda válidos).
- `CLAUDE.md` — decisões de teste.

</canonical_refs>

<specifics>
## Specific Ideas

- Usuário é não técnico; UI em português simples. Padrão de comunicação: totais grandes e claros ("João: R$ 1.240,00 — 8 OS — PENDENTE/PAGO").
- Copiar chave PIX com um clique ao lado do total facilita o pagamento real.

</specifics>

<deferred>
## Deferred Ideas

- Comissão percentual automática por técnico — não é o modelo do usuário (valor é por OS).
- Recibo/comprovante em PDF do fechamento — possível na Phase 11 (exportação), se pedido.

</deferred>

---

*Phase: 08-fechamento-de-tecnicos*
*Context gathered: 2026-07-03*
