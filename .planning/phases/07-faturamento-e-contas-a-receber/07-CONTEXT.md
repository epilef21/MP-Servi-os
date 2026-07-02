# Phase 7: Faturamento e Contas a Receber - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning
**Source:** Conversa direta com o usuário (com prints dos portais MAWDY/Mapfre, Portal Juvo/Tempo e Maxpar) — decisões todas confirmadas pelo usuário

<domain>
## Phase Boundary

Ciclo completo de faturamento por seguradora: registrar códigos de faturamento nas OS, montar a fila de faturamento (checklist com progresso salvo), fechar notas com data prevista de pagamento calculada por calendário, e acompanhar status aguardando/paga/atrasada. NÃO inclui: emissão de NF-e, integração automática com portais, fechamento de técnicos (Phase 8), contas a pagar (Phase 9).

</domain>

<decisions>
## Implementation Decisions

### Fluxo real do usuário (LOCKED — espelhar exatamente)
- O usuário NÃO recebe OS por OS. Ele junta várias OS e emite UMA nota fiscal por seguradora (faturamento em lote).
- A data de envio/emissão da NF determina a data de pagamento, com calendário próprio por seguradora.
- Depois de emitir a nota no portal da seguradora, ele digita os itens UM POR UM no portal — o sistema precisa funcionar como checklist ao lado do portal, salvando o progresso ("parei aqui").

### Identificadores por seguradora (LOCKED)
- **Mapfre**: cada OS recebe DOIS códigos de 8 dígitos ("movimento económico" no portal MAWDY br.mia-assistance.com) — um de MÃO DE OBRA e outro de DESLOCAMENTO, cada um com seu valor. Registrados manualmente pelo admin na OS quando a seguradora libera. O segundo (deslocamento) é opcional — OS sem deslocamento deixa vazio e não conta como pendente.
- **Allianz/Mondial**: mesma estrutura, mas códigos de 2 dígitos. Também dois por OS (mão de obra + deslocamento).
- **Tempo (Portal Juvo)** e **Maxpar**: NÃO têm código. O identificador é o próprio número da assistência (`num_assist`, já existente na OS via extensão Chrome). A fila monta AUTOMATICAMENTE das OS finalizadas — zero digitação de código.

### Valores (LOCKED)
- **Mapfre/Allianz**: o valor vem junto com o código (valor liberado pela seguradora). O sistema COMPARA com o valor da OS e destaca divergência (verde = bateu; vermelho = diferença com o valor da diferença explícito). Divergência NÃO bloqueia — só destaca.
- **Tempo/Maxpar**: valores mudam com frequência. O valor NÃO vem travado da OS: campo editável na hora de faturar; o valor da OS aparece apenas como sugestão (ex.: texto cinza "a OS diz R$ 244,40"). O valor digitado é o que entra na soma da nota.

### Checklist de lançamento (LOCKED)
- Cada item da fila (código ou OS) tem um checkbox "lançado no portal". Marcar/desmarcar salva imediatamente no Firestore (progresso persistente entre sessões e dispositivos).
- A fila mostra contagem de progresso: "12 lançados ✓ · 5 faltando".
- Na Mapfre/Allianz, mão de obra e deslocamento da mesma OS são itens SEPARADOS no checklist (dá para saber que lançou a MO mas falta o deslocamento).

### Notas/Faturas (LOCKED)
- "Fechar nota": admin informa número da fatura (ex.: 81) e data de emissão → todos os itens marcados como lançados são vinculados à nota; a nota guarda o total somado.
- Nota tem status: aguardando pagamento / paga / atrasada (atrasada = hoje > data prevista e não marcada como paga — derivado, não gravado).
- Marcar nota como paga quita todas as OS vinculadas de uma vez.
- Painel-resumo: total a receber por seguradora com datas previstas (ex.: "Mapfre R$ Y até 01/08, Allianz R$ Z até 13/07").

### Calendário de pagamento (LOCKED — regras confirmadas com documentos oficiais)
- **Mapfre** (MAPFRE ASSISTÊNCIA LTDA, CNPJ 68.181.221/0001-47; NF-e para tesourarianfe@mawdy.com):
  - envio dia 01–10 → paga dia 01 do mês seguinte
  - envio dia 11–25 → paga dia 16 do mês seguinte
  - envio dia 26–31 → paga dia 01 do SEGUNDO mês seguinte
- **Allianz/Mondial**:
  - NF recebida dia 01–03 → paga dia 13 do mesmo mês
  - dia 04–10 → paga dia 25 do mesmo mês
  - dia 11–20 → paga dia 03 do mês seguinte
  - dia 21–25 → paga dia 13 do mês seguinte
  - dia 26–31 → **NÃO É FATURADA NEM PAGA** — o sistema deve AVISAR para não emitir nesse período (FAT-08)
  - se a data de pagamento cair em fim de semana/feriado, paga no próximo dia útil (basta ajustar para o próximo dia útil considerando sáb/dom; feriados podem ser ignorados nesta versão)
- **Tempo e Maxpar**: calendário ainda não levantado pelo usuário → data prevista MANUAL na nota. Estrutura deve permitir cadastrar as regras depois sem código novo (config editável).
- As regras ficam EDITÁVEIS na aba Config da empresa (se a seguradora mudar o calendário, o admin ajusta sem programador).
- Bônus desejado: ao fechar a nota, mostrar quando ela será paga conforme a data de emissão escolhida (ajuda a escolher o melhor dia de envio).

### Onde vive na UI (LOCKED)
- Nova aba interna no FinanceiroEmpresaTab (padrão das abas existentes: dre / despesas / particulares / impostos) — ex.: "📄 Faturamento".
- Campo(s) de código de faturamento no detalhe da OS (DetalheOSModal, seção financeira existente).
- Configuração de calendários na ConfigTab existente.

### Claude's Discretion
- Modelagem exata das coleções Firestore (sugestão: `empresas/{empresaId}/notasFiscais` para notas; códigos de faturamento como campos no documento da OS existente em `checklist/{osId}` — decidir o que for mais simples e consistente com o padrão atual).
- Como identificar a seguradora da OS (campo `seguradora` existente; normalizar variações de grafia se necessário).
- Detalhes visuais (cores, ícones) — seguir o padrão do FinanceiroEmpresaTab atual (classes fin-*, dre-*, btn-sm etc.).
- Botão "copiar todos os códigos" na fila (nice-to-have, incluir se trivial).
- Como tratar OS "Cancelado Sem Custo" (não devem aparecer na fila de faturamento, ou aparecer com R$ 0 — decidir pelo mais seguro).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Código existente (padrões a seguir)
- `mp-react/src/components/admin/FinanceiroEmpresaTab.jsx` — módulo financeiro atual: abas internas, modais, CRUD Firestore por subcoleção, cálculo DRE. A nova aba Faturamento vive aqui e segue esses padrões.
- `mp-react/src/components/admin/DetalheOSModal.jsx` — modal de detalhe da OS com seção financeira (finForm) — onde entram os campos de código de faturamento.
- `mp-react/src/components/admin/ConfigTab.jsx` — aba de configuração da empresa — onde entra a edição dos calendários de pagamento.
- `mp-react/src/contexts/AdminContext.jsx` — contexto com empresaId, reports (OS), showToast.
- `mp-react/src/utils/formatters.js` — fmtBRL e utilitários de formatação.
- `CLAUDE.md` — decisões de teste (Vitest, vi.mock('../firebase'), .env.test) e armadilhas.

### Dados existentes relevantes
- OS vivem em `empresas/{empresaId}/checklist/{osId}` com campos: `seguradora`, `num_assist`, `status`, `mo_seguradora`, `valor_deslocamento`, `material_cobrado_seguradora`, `valor_prestador`, `nome_segurado`.

</canonical_refs>

<specifics>
## Specific Ideas

- Print do portal Mapfre (MAWDY "Accionamiento" → Criar Fatura): lista de "Movimento económico" (8 dígitos) + "Valor" com checkbox por linha e total — a fila do AssistHub deve espelhar esse formato para facilitar a digitação lado a lado.
- Exemplo real: nota nº 81, emissão 29/06/2026, total R$ 3.557,80, 7 códigos (19860547/130,00; 19860745/150,00; 19876983/45,00; 19881453/45,00; 19881588/226,80; 19889681/240,00; 19890354/150,00).
- Usuário é NÃO técnico: toda a UI e mensagens em português simples, sem jargão contábil além do que já existe no DRE.

</specifics>

<deferred>
## Deferred Ideas

- FAT-11 (v1.3+): calendários de pagamento da Tempo e Maxpar — aguardando usuário levantar as regras.
- Integração automática com os portais (API/scraping) — out of scope permanente por decisão.
- Feriados nacionais no cálculo do próximo dia útil — só fim de semana nesta versão.

</deferred>

---

*Phase: 07-faturamento-e-contas-a-receber*
*Context gathered: 2026-07-02 via conversa direta com o usuário*
