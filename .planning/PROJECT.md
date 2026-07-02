# AssistHub — Projeto

## Current Milestone: v1.2 Financeiro Completo

**Goal:** Transformar o módulo Financeiro (DRE) em controle financeiro completo: da OS finalizada até o dinheiro na conta — faturamento por seguradora, pagamento de técnicos, contas a pagar, fluxo de caixa e exportação.

**Target features:**
- Faturamento e contas a receber por seguradora: códigos de faturamento por OS (mão de obra + deslocamento na Mapfre/Allianz; nº da assistência na Tempo/Maxpar), fila de faturamento tipo checklist com progresso salvo ("parei aqui"), notas/faturas com data prevista de pagamento calculada pelo calendário de cada seguradora e status aguardando/paga/atrasada
- Fechamento mensal de técnicos: total a pagar por técnico com OS listadas, chave PIX no cadastro, marcar como pago com histórico
- Contas a pagar: vencimento e status nas despesas, alerta de contas a vencer
- Fluxo de caixa (entradas/saídas reais) e gráfico de evolução de 12 meses
- Exportar DRE em PDF e fechamento do mês (travar lançamentos)

**Key context:** Fluxo real de faturamento levantado com o usuário em 2026-07-02 (calendários Mapfre/Allianz documentados; Tempo/Maxpar pendentes — data prevista manual até lá). Valores na Tempo/Maxpar mudam com frequência: valor é confirmado na hora de faturar, não travado da OS. Detalhes em memória do projeto (project_faturamento_seguradoras.md).

## Previous Milestone: v1.0 Test Coverage — COMPLETO (2026-05-20)

**Status:** Todas as 4 fases completas. 75 testes passando (INFRA + UTIL + DATA + AUTH + OS + ORC).

---

## Previous Milestone: v1.1 Produto Core — COMPLETO (2026-05-05)

**Goal:** Completar o produto core implementando as 2 features pendentes da PRIORIDADE 2 do backlog.

**Validated in Phase 5 (Compressão de Imagens):** IMG-01, IMG-02, IMG-03
**Validated in Phase 6 (Relatório Mensal em PDF):** REL-01, REL-02, REL-03, REL-04, REL-05

---

## What This Is

AssistHub é uma plataforma SaaS multi-tenant para gestão de ordens de serviço de assistência técnica residencial. Atende prestadores que operam para seguradoras (Mapfre, Tempo, Maxpar, Allianz), substituindo papel, WhatsApp e planilhas por um fluxo 100% digital: extração automática de OS via extensão Chrome, gestão de serviços e orçamentos, assinatura digital do cliente e geração de PDF.

Este milestone trata exclusivamente de adicionar cobertura de testes aos fluxos críticos da plataforma, para que mudanças no código possam ser feitas com confiança.

## Core Value

Nenhum fluxo crítico (OS, orçamentos, autenticação) deve quebrar silenciosamente quando o código muda.

## Requirements

### Validated

(Funcionalidades já existentes na plataforma — baseline confirmado pelo codebase map)

- ✓ Autenticação email/password com Firebase Auth, roles admin / superadmin — existing
- ✓ Multi-tenancy por slug de URL (`/:slug` e `/:slug/admin`) — existing
- ✓ CRUD de Ordens de Serviço com upload de fotos, status e histórico — existing
- ✓ Fluxo de orçamento: técnico preenche → cliente aprova com assinatura digital — existing
- ✓ Geração de PDF/PNG de OS e orçamentos — existing
- ✓ Extensão Chrome para extração de OS de portais de seguradoras — existing
- ✓ Painel SuperAdmin para visão global da plataforma — existing
- ✓ Pesquisa de satisfação pós-OS — existing

### Validated in Phase 1 (Infraestrutura de Testes)

INFRA-01..08 — Vitest 4.1.5 + RTL + jsdom configurados, smoke test verde, renderWithProviders/mockFirebase disponíveis.

### Validated in Phase 2 (Camada Base)

UTIL-01..04 — fmtDate/fmtBRL/getLucro/maskPhone/maskCNPJ extraídos para formatters.js, 30 testes verdes.
DATA-01..06 — criarOS/atualizarOS/getOSdaEmpresa/getEmpresaBySlug/cadastrarEmpresa/contarOSdoMes testados, 17 testes verdes.

### Validated in Phase 3 (Auth e Roteamento)

AUTH-01..13 — AuthContext (loading, empresaId, superadmin, logout), RotaAdmin/RotaSuperAdmin guards, useEmpresa com cache — 13 testes verdes. RotaAdmin corrigido para verificar empresaId (correção de segurança AUTH-07).

### Validated in Phase 4 (Fluxos Críticos)

OS-01..06 — CRUD de OS via stub components: criarOS, atualizarOS, deleteDoc, getOSdaEmpresa — 6 testes verdes. AdminPage.jsx não renderizado.
ORC-01..06 — Fluxo técnico→cliente de orçamento: OrcamentoTecnicoPage e AprovarOrcamentoPage com SignatureCanvas mock — 6 testes verdes.

**Milestone v1.0 Test Coverage completo:** 75 testes passando em 7 arquivos de teste.

### Active

(v1.2 Financeiro Completo — ver REQUIREMENTS.md: FAT-01..10, TEC-01..03, PAG-01..03, CAIXA-01..02, EXP-01..02)

### Out of Scope

- Refatoração do AdminPage — motivação futura, mas não é pré-requisito para testes
- Correções de segurança (Firestore rules, uploads públicos) — milestone separado
- Cobertura 100% — objetivo é cobertura dos caminhos críticos, não completude
- CI/CD (GitHub Actions) — pode ser adicionado depois que a suite estiver estável
- Testes da extensão Chrome — escopo diferente, sem framework óbvio no momento
- Testes das Cloud Functions — requer Firebase Emulator Suite separado

## Context

- Stack: React 19 + Vite 8 (logo, Vitest é a escolha natural — integração nativa)
- Firebase JS SDK v12 é central em quase toda lógica de negócio — testes precisam de mocks ou emuladores
- AdminPage.jsx tem 3.264 linhas e ~50 `useState` — prioridade de teste não é o arquivo todo, mas os fluxos de negócio que ele orquestra
- Zero testes hoje: nenhum arquivo `*.test.*` ou `*.spec.*` existe no projeto
- Sem Prettier configurado — não introduzir regras de formatação nos testes

## Constraints

- **Tech stack**: Manter Vitest (Vite já instalado) — não adicionar Jest
- **Escopo**: Testes de componente/integração com mocks de Firebase, não testes e2e com Cypress/Playwright
- **Sem mocks de banco real**: Firebase calls devem ser mockadas via `vi.mock()` para isolar a lógica da UI dos dados reais
- **Linguagem**: JavaScript (sem TypeScript) — alinhar com o projeto existente

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vitest como framework de testes | Integração nativa com Vite, sem configuração extra de transpile | — Pending |
| React Testing Library para componentes | Testa comportamento observável (não implementação), reduz fragilidade | — Pending |
| Mocks de Firebase via vi.mock() | Isola lógica de UI de chamadas de rede reais, testes rápidos e determinísticos | — Pending |

## Evolution

Este documento evolui a cada transição de fase.

**Após cada fase** (via `/gsd-transition`):
1. Requisitos invalidados? → Mover para Out of Scope com motivo
2. Requisitos validados? → Mover para Validated com referência de fase
3. Novos requisitos emergiram? → Adicionar em Active
4. Decisões a registrar? → Adicionar em Key Decisions

---
*Last updated: 2026-05-03 após inicialização*
