# Roadmap: AssistHub

## Milestones

- ✅ **v1.0 Test Coverage** - Phases 1-4 (concluído 2026-05-20)
- ✅ **v1.1 Produto Core** - Phases 5-6 (concluído 2026-05-05)
- 🚧 **v1.2 Financeiro Completo** - Phases 7-11 (em planejamento)

## Phases

<details>
<summary>✅ v1.0 Test Coverage (Phases 1-4) - CONCLUÍDO 2026-05-20</summary>

### Phase 1: Infraestrutura de Testes
**Goal**: O ambiente de testes está completamente configurado e um smoke test confirma que a suite funciona de ponta a ponta.
**Requirements**: INFRA-01..08
**Plans**: 2/2 completos

### Phase 2: Camada Base
**Goal**: Utilitários de formatação e funções de acesso ao Firestore têm testes que verificam seu comportamento observável.
**Requirements**: UTIL-01..04, DATA-01..06
**Plans**: 2/2 completos

### Phase 3: Auth e Roteamento
**Goal**: Fluxos de autenticação, proteção de rotas e resolução de empresa por slug têm testes que cobrem todos os estados observáveis pelo usuário.
**Requirements**: AUTH-01..13
**Plans**: 2/2 completos

### Phase 4: Fluxos Críticos
**Goal**: Fluxos de negócio de Ordens de Serviço e Orçamento têm testes de comportamento que falhariam se qualquer etapa crítica fosse removida ou quebrada.
**Requirements**: OS-01..06, ORC-01..06
**Plans**: 2/2 completos

**Milestone v1.0 completo:** 75 testes passando em 7 arquivos de teste. Detalhes completos (success criteria, plans, cross-cutting constraints) preservados no histórico do git.

</details>

<details>
<summary>✅ v1.1 Produto Core (Phases 5-6) - CONCLUÍDO 2026-05-05</summary>

### Phase 5: Compressão de Imagens
**Goal**: Técnico pode enviar fotos no orçamento com garantia de que cada arquivo respeita o limite de 400KB, com feedback visual durante o processo.
**Requirements**: IMG-01, IMG-02, IMG-03
**Plans**: 1/1 completo

### Phase 6: Relatório Mensal em PDF
**Goal**: Admin pode selecionar qualquer mês/ano, visualizar os dados consolidados de OS e lucro, e baixar o relatório como PDF.
**Requirements**: REL-01..05
**Plans**: 2/2 completos

**Milestone v1.1 completo.** Detalhes completos preservados no histórico do git.

</details>

### 🚧 v1.2 Financeiro Completo (Em planejamento)

**Milestone Goal:** Transformar o módulo Financeiro em controle completo: da OS finalizada até o dinheiro na conta — faturamento por seguradora, pagamento de técnicos, contas a pagar, fluxo de caixa e exportação/fechamento do mês.

#### Phase 7: Faturamento e Contas a Receber
**Goal**: Admin controla o ciclo completo de faturamento por seguradora — do código lançado na OS até a nota marcada como paga — sem nunca perder "onde parou" no lançamento no portal.
**Depends on**: Nothing (usa dados de OS finalizadas já existentes)
**Requirements**: FAT-01, FAT-02, FAT-03, FAT-04, FAT-05, FAT-06, FAT-07, FAT-08, FAT-09, FAT-10
**Success Criteria** (what must be TRUE):
  1. Admin registra na OS finalizada os dois códigos de faturamento (mão de obra e deslocamento, este último opcional) com valor
  2. Admin abre a fila de faturamento de uma seguradora e vê todas as OS/códigos finalizados ainda não lançados em nenhuma nota — na Tempo e na Maxpar a OS já aparece sozinha na fila pelo nº da assistência, sem digitar nada
  3. Admin marca cada item da fila como "lançado no portal" e, ao sair e voltar depois, encontra o checklist exatamente como deixou
  4. Admin edita o valor na hora de faturar na fila da Tempo/Maxpar (valor da OS aparece só como sugestão), e vê destaque de divergência entre valor do código e valor da OS na Mapfre/Allianz
  5. Admin fecha uma nota informando número e data de emissão vinculando os itens marcados; o sistema calcula sozinho a data prevista de pagamento pelo calendário da seguradora (avisando quando a data cai em período sem faturamento), mostra status aguardando/paga/atrasada por seguradora, e marcar como paga quita de uma vez todas as OS vinculadas
**Plans**: 5 plans (3 waves)
Plans:
- [ ] 07-01-PLAN.md — utils/faturamento.js: regras de calendário, data prevista, dia útil, divergência + testes Vitest (FAT-07, FAT-08)
- [ ] 07-02-PLAN.md — DetalheOSModal: dois códigos por OS (MO + deslocamento), migração do legado (FAT-01)
- [ ] 07-03-PLAN.md — ConfigTab: calendários de pagamento editáveis por seguradora (FAT-07)
- [ ] 07-04-PLAN.md — AbaFaturamento: fila por seguradora + checklist persistente + valor editável/divergência (FAT-02, FAT-03, FAT-04, FAT-05)
- [ ] 07-05-PLAN.md — Fechar Nota + status/painel a receber + marcar paga (FAT-06, FAT-07, FAT-08, FAT-09, FAT-10)
**UI hint**: yes

---

#### Phase 8: Fechamento de Técnicos
**Goal**: Admin fecha o pagamento mensal de cada técnico com poucos cliques, sempre com a chave PIX à mão e histórico consultável.
**Depends on**: Nothing (usa dados de OS e cadastro de técnicos já existentes)
**Requirements**: TEC-01, TEC-02, TEC-03
**Success Criteria** (what must be TRUE):
  1. Admin cadastra chave PIX e forma de pagamento no cadastro do técnico
  2. Admin vê o fechamento mensal por técnico: lista das OS do mês com valor do prestador e total a pagar
  3. Admin marca o fechamento do técnico como pago (com data) e consulta depois o histórico de pagamentos daquele técnico
**Plans**: TBD
**UI hint**: yes

---

#### Phase 9: Contas a Pagar
**Goal**: Admin nunca é pego de surpresa por uma despesa vencida — o sistema avisa antes e organiza tudo por status.
**Depends on**: Nothing (usa despesas já cadastradas no módulo Financeiro)
**Requirements**: PAG-01, PAG-02, PAG-03
**Success Criteria** (what must be TRUE):
  1. Toda despesa mensal tem data de vencimento e status pendente / pago / atrasado visível
  2. Admin vê alerta de contas a vencer nos próximos 7 dias e das contas já atrasadas
  3. Despesas recorrentes fixas entram automaticamente no mês novo já com o dia de vencimento preenchido
**Plans**: TBD
**UI hint**: yes

---

#### Phase 10: Fluxo de Caixa e Evolução
**Goal**: Admin enxerga o dinheiro que de fato entrou e saiu no mês, e como o negócio evoluiu nos últimos 12 meses.
**Depends on**: Phase 7, Phase 8, Phase 9 (fluxo de caixa soma notas pagas, técnicos pagos e despesas pagas dessas fases)
**Requirements**: CAIXA-01, CAIXA-02
**Success Criteria** (what must be TRUE):
  1. Admin vê o fluxo de caixa do mês com entradas reais (notas pagas + particulares) e saídas reais (despesas pagas + técnicos pagos)
  2. Admin vê um gráfico de evolução dos últimos 12 meses com receita, lucro líquido e margem
**Plans**: TBD
**UI hint**: yes

---

#### Phase 11: Exportação e Fechamento do Mês
**Goal**: Admin encerra o mês com um clique — PDF do DRE em mãos e lançamentos financeiros travados contra edição acidental.
**Depends on**: Phase 7, Phase 8, Phase 9, Phase 10 (fechamento do mês trava lançamentos de todas as áreas financeiras)
**Requirements**: EXP-01, EXP-02
**Success Criteria** (what must be TRUE):
  1. Admin baixa o DRE do mês em PDF gerado direto no navegador (jsPDF, mesmo padrão já usado no relatório mensal)
  2. Admin fecha o mês e, a partir daí, qualquer tentativa de editar um lançamento financeiro daquele período é bloqueada
**Plans**: TBD
**UI hint**: yes

---

## Progress

**Execution Order:**
Phases execute in numeric order: 7 → 8 → 9 → 10 → 11

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Infraestrutura de Testes | v1.0 | 2/2 | Complete | 2026-05-03 |
| 2. Camada Base | v1.0 | 2/2 | Complete | 2026-05-05 |
| 3. Auth e Roteamento | v1.0 | 2/2 | Complete | 2026-05-19 |
| 4. Fluxos Críticos | v1.0 | 2/2 | Complete | 2026-05-20 |
| 5. Compressão de Imagens | v1.1 | 1/1 | Complete | 2026-05-04 |
| 6. Relatório Mensal em PDF | v1.1 | 2/2 | Complete | 2026-05-05 |
| 7. Faturamento e Contas a Receber | v1.2 | 0/5 | Planned | - |
| 8. Fechamento de Técnicos | v1.2 | 0/TBD | Not started | - |
| 9. Contas a Pagar | v1.2 | 0/TBD | Not started | - |
| 10. Fluxo de Caixa e Evolução | v1.2 | 0/TBD | Not started | - |
| 11. Exportação e Fechamento do Mês | v1.2 | 0/TBD | Not started | - |

## Requirement Traceability (v1.2)

| Requirement | Phase | Status |
|-------------|-------|--------|
| FAT-01 | Phase 7 | Pending |
| FAT-02 | Phase 7 | Pending |
| FAT-03 | Phase 7 | Pending |
| FAT-04 | Phase 7 | Pending |
| FAT-05 | Phase 7 | Pending |
| FAT-06 | Phase 7 | Pending |
| FAT-07 | Phase 7 | Pending |
| FAT-08 | Phase 7 | Pending |
| FAT-09 | Phase 7 | Pending |
| FAT-10 | Phase 7 | Pending |
| TEC-01 | Phase 8 | Pending |
| TEC-02 | Phase 8 | Pending |
| TEC-03 | Phase 8 | Pending |
| PAG-01 | Phase 9 | Pending |
| PAG-02 | Phase 9 | Pending |
| PAG-03 | Phase 9 | Pending |
| CAIXA-01 | Phase 10 | Pending |
| CAIXA-02 | Phase 10 | Pending |
| EXP-01 | Phase 11 | Pending |
| EXP-02 | Phase 11 | Pending |

**Coverage:** 20/20 v1.2 requirements mapped. No orphans.

Para a tabela de traceability completa de v1.0/v1.1 (45 requisitos), ver histórico do git deste arquivo.
