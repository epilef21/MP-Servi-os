# AssistHub — Projeto

## Current Milestone: v1.0 Test Coverage (Em andamento)

**Status:** Phase 1 completa, Phases 2-4 pendentes.

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

### Active

- [ ] Configurar Vitest + React Testing Library no projeto mp-react
- [ ] Testes do fluxo de autenticação e multi-tenancy (login, rota por slug, guards)
- [ ] Testes do fluxo de OS (criar, editar, fechar, listar)
- [ ] Testes do fluxo de orçamento (gerar, técnico preenche, cliente aprova)
- [ ] Testes de funções utilitárias críticas (geração de slug, helpers de Firestore)
- [ ] Testes passando em `npm test` com output claro de falhas

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
