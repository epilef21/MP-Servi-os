# Requirements: AssistHub

**Atualizado:** 2026-07-02
**Core Value:** Da OS finalizada até o dinheiro na conta — o admin controla faturamento, recebimento, pagamentos e caixa em um lugar só.

---

## v1.2 Requirements — Financeiro Completo

**Definido:** 2026-07-02
**Contexto:** Fluxo real de faturamento levantado com o usuário (memória: project_faturamento_seguradoras.md). Cada seguradora fatura de um jeito: Mapfre e Allianz liberam códigos por OS (2 por OS: mão de obra + deslocamento); Tempo e Maxpar usam o próprio nº da assistência. A data de envio da NF define a data de pagamento (calendário por seguradora).

### Faturamento e Contas a Receber (FAT)

- [x] **FAT-01**: Admin pode registrar em cada OS os códigos de faturamento com valor — dois por OS (mão de obra e deslocamento), sendo o segundo opcional
- [x] **FAT-02**: Admin vê a fila de faturamento por seguradora: todos os códigos/OS finalizadas que ainda não entraram em nenhuma nota
- [x] **FAT-03**: Na fila da Tempo e Maxpar, as OS finalizadas entram automaticamente pelo nº da assistência (num_assist), sem digitação de código
- [x] **FAT-04**: Admin pode marcar cada código/OS como "lançado no portal" (checklist), e o progresso fica salvo — ao voltar, vê exatamente onde parou
- [x] **FAT-05**: Na fila da Tempo e Maxpar o valor é editável na hora de faturar (valor da OS aparece só como sugestão); na Mapfre/Allianz o sistema destaca divergência entre valor do código e valor da OS
- [x] **FAT-06**: Admin pode fechar uma nota informando número da fatura e data de emissão, vinculando todos os itens marcados; a nota guarda o total somado
- [x] **FAT-07**: Sistema calcula a data prevista de pagamento da nota pelo calendário da seguradora (Mapfre e Allianz pré-cadastrados, editáveis na Config; data manual quando a seguradora não tem calendário cadastrado)
- [x] **FAT-08**: Sistema avisa quando a data de emissão cai em período sem faturamento (Allianz dia 26–31: nota não é paga)
- [x] **FAT-09**: Admin vê as notas com status aguardando pagamento / paga / atrasada, e o total a receber por seguradora com datas previstas
- [x] **FAT-10**: Admin pode marcar uma nota como paga, quitando todas as OS vinculadas de uma vez

### Fechamento de Técnicos (TEC)

- [x] **TEC-01**: Admin pode cadastrar chave PIX e forma de pagamento no cadastro do técnico
- [x] **TEC-02**: Admin vê o fechamento mensal por técnico: lista das OS do mês com valor do prestador e total a pagar
- [x] **TEC-03**: Admin pode marcar o fechamento do técnico como pago (com data), mantendo histórico consultável de pagamentos

### Contas a Pagar (PAG)

- [x] **PAG-01**: Despesas mensais têm data de vencimento e status pendente / pago / atrasado
- [x] **PAG-02**: Admin vê alerta de contas a vencer nos próximos 7 dias e contas atrasadas
- [x] **PAG-03**: Despesas recorrentes fixas entram no mês já com dia de vencimento preenchido automaticamente

### Fluxo de Caixa e Evolução (CAIXA)

- [x] **CAIXA-01**: Admin vê o fluxo de caixa do mês: entradas reais (notas pagas, particulares) e saídas reais (despesas pagas, técnicos pagos)
- [x] **CAIXA-02**: Admin vê gráfico de evolução dos últimos 12 meses com receita, lucro líquido e margem

### Exportação e Fechamento (EXP)

- [x] **EXP-01**: Admin pode baixar o DRE do mês em PDF gerado no browser (jsPDF, padrão existente)
- [ ] **EXP-02**: Admin pode fechar o mês, travando os lançamentos financeiros do período contra alteração acidental

## Future Requirements (v1.3+)

- **FAT-11**: Calendários de pagamento da Tempo e Maxpar cadastrados (aguardando usuário levantar as regras)
- **CHK-01**: Checklists digitais personalizados por tipo de serviço (Fase 2 do comparativo AutEM)
- **GPS-01**: Rastreamento do técnico em tempo real + link de acompanhamento para o cliente (Fase 3 do comparativo AutEM)

## Out of Scope

| Feature | Motivo |
|---------|--------|
| Emissão de NF-e pelo sistema | Usuário emite a NF no emissor da prefeitura/portal; o AssistHub só controla o lote e o pagamento |
| Integração automática com portais das seguradoras (faturar via API/scraping) | Alto risco e manutenção; o checklist manual resolve a dor real (perder o "onde parei") |
| Controle de estoque/peças | Prioridade baixa no comparativo AutEM; operação atual não exige |
| Gestão de frota e chat interno | Menor retorno para o tamanho da operação; WhatsApp resolve hoje |
| Conciliação bancária (importar extrato OFX) | Complexidade alta; marcar nota como paga manualmente é suficiente nesta versão |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FAT-01 | Phase 7 | Complete |
| FAT-02 | Phase 7 | Complete |
| FAT-03 | Phase 7 | Complete |
| FAT-04 | Phase 7 | Complete |
| FAT-05 | Phase 7 | Complete |
| FAT-06 | Phase 7 | Complete |
| FAT-07 | Phase 7 | Complete |
| FAT-08 | Phase 7 | Complete |
| FAT-09 | Phase 7 | Complete |
| FAT-10 | Phase 7 | Complete |
| TEC-01 | Phase 8 | Complete |
| TEC-02 | Phase 8 | Complete |
| TEC-03 | Phase 8 | Complete |
| PAG-01 | Phase 9 | Complete |
| PAG-02 | Phase 9 | Complete |
| PAG-03 | Phase 9 | Complete |
| CAIXA-01 | Phase 10 | Complete |
| CAIXA-02 | Phase 10 | Complete |
| EXP-01 | Phase 11 | Complete |
| EXP-02 | Phase 11 | Pending |

**Coverage:**
- v1.2 requirements: 20 total
- Mapped to phases: 20/20
- Unmapped: 0

---
*Requirements defined: 2026-07-02*
*Last updated: 2026-07-02 após criação do roadmap v1.2 (Phases 7-11)*
