# Roadmap: AssistHub — Cobertura de Testes

**Milestone:** Test Coverage v1
**Created:** 2026-05-03
**Phases:** 4
**Requirements:** 37

## Overview

Quatro fases encadeadas levam a plataforma de zero testes para uma suite confiável dos fluxos críticos. A ordem respeita o grafo de dependências: infra primeiro (nada roda sem ela), utilitários puros e camada de dados em seguida (sem dependências de contexto React), autenticação e roteamento depois (depende dos mocks de firebase.js estabelecidos na fase anterior), e os fluxos de negócio por último (dependem de auth, roteamento e helpers de dados funcionando nos testes).

## Phases

- [ ] **Phase 1: Infraestrutura de Testes** - Configurar Vitest, RTL, mocks globais e smoke test passando
- [ ] **Phase 2: Camada Base** - Testar utilitários puros e funções de acesso ao Firestore em isolamento
- [ ] **Phase 3: Auth e Roteamento** - Testar AuthContext, guards de rota e hook useEmpresa
- [ ] **Phase 4: Fluxos Críticos** - Testar CRUD de OS e fluxo completo de orçamento

## Phase Details

### Phase 1: Infraestrutura de Testes
**Goal**: O ambiente de testes está completamente configurado e um smoke test confirma que a suite funciona de ponta a ponta.
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, INFRA-08
**Success Criteria** (what must be TRUE):
  1. `npm test` em `mp-react/` executa sem erros de configuração e exibe output do Vitest
  2. O smoke test `it('works')` passa e aparece verde no output
  3. Um teste que importa qualquer módulo que depende de `firebase.js` não explode com "Variáveis de ambiente do Firebase não encontradas"
  4. `renderWithProviders` e `mockFirebase` estão disponíveis para importação pelos testes das fases seguintes
**Plans**: 2 plans

Plans:
- [x] 01-01: Instalar dependências e criar vitest.config.js, .env.test e package.json scripts
- [ ] 01-02: Criar src/test-utils/ (setupTests.js, renderWithProviders.jsx, mockFirebase.js) e smoke test

**UI hint**: no
**Complexity**: low

---

### Phase 2: Camada Base
**Goal**: Desenvolvedores podem confiar nos utilitários de formatação e nas funções de acesso ao Firestore porque cada um tem testes que verificam seu comportamento observável.
**Depends on**: Phase 1
**Requirements**: UTIL-01, UTIL-02, UTIL-03, UTIL-04, DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06
**Success Criteria** (what must be TRUE):
  1. `fmtDate`, `fmtBRL`, `getLucro`, `maskPhone` e `maskCNPJ` têm testes que falham se a lógica for alterada incorretamente
  2. `criarOS` e `atualizarOS` têm testes que verificam que as funções Firestore corretas são chamadas com os argumentos corretos
  3. `getOSdaEmpresa` e `getEmpresaBySlug` têm testes para o caminho feliz e para o caso "não encontrado"
  4. `verificarLimite` tem testes para os casos true e false baseados em plano e contagem de OS
  5. Todos os testes desta fase passam sem nenhuma chamada real à rede Firebase
**Plans**: 2 plans

Plans:
- [ ] 02-01: Testes das funções utilitárias puras (UTIL-01..04)
- [ ] 02-02: Testes das funções de acesso ao Firestore em firebase.js (DATA-01..06)

**UI hint**: no
**Complexity**: medium

---

### Phase 3: Auth e Roteamento
**Goal**: Os fluxos de autenticação, proteção de rotas e resolução de empresa por slug têm testes que cobrem todos os estados observáveis pelo usuário.
**Depends on**: Phase 2
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09, AUTH-10, AUTH-11, AUTH-12, AUTH-13
**Success Criteria** (what must be TRUE):
  1. Um teste demonstra que a tela de loading aparece enquanto `onAuthStateChanged` não responde e desaparece depois
  2. Testes cobrem todos os caminhos de resolução do `AuthContext`: usuário normal via claims, fallback via Firestore, superadmin por email e logout
  3. `RotaAdmin` tem testes que verificam redirecionamento para login (sem auth, sem empresaId) e renderização para admin válido
  4. `RotaSuperAdmin` tem testes que bloqueiam usuário normal e permitem superadmin
  5. `useEmpresa` tem testes para slug válido, slug inexistente e acerto de cache na segunda consulta
**Plans**: 2 plans

Plans:
- [ ] 03-01: Testes do AuthContext (estados de loading, resolução de usuário, logout)
- [ ] 03-02: Testes de RotaAdmin, RotaSuperAdmin e useEmpresa

**UI hint**: yes
**Complexity**: high

---

### Phase 4: Fluxos Críticos
**Goal**: Os fluxos de negócio de Ordens de Serviço e Orçamento têm testes de comportamento que falhariam se qualquer etapa crítica fosse removida ou quebrada.
**Depends on**: Phase 3
**Requirements**: OS-01, OS-02, OS-03, OS-04, OS-05, OS-06, ORC-01, ORC-02, ORC-03, ORC-04, ORC-05, ORC-06
**Success Criteria** (what must be TRUE):
  1. Um teste demonstra que um admin pode criar uma OS via formulário e que `criarOS` é chamada com os dados corretos
  2. Um teste demonstra que edição e mudança de status de OS invocam `atualizarOS` com os campos esperados
  3. A lista de OS exibe "nenhuma OS" quando o mock retorna vazio e exibe itens quando o mock retorna dados
  4. Um teste demonstra o fluxo técnico-para-cliente: técnico preenche e assina → dados são salvos no Firestore
  5. Um teste demonstra que cliente visualiza orçamento e aprova com assinatura → status atualizado no Firestore
**Plans**: 2 plans

Plans:
- [ ] 04-01: Testes de CRUD de Ordens de Serviço (OS-01..06)
- [ ] 04-02: Testes do fluxo de Orçamento técnico → cliente (ORC-01..06)

**UI hint**: yes
**Complexity**: high

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infraestrutura de Testes | 1/2 | In progress | - |
| 2. Camada Base | 0/2 | Not started | - |
| 3. Auth e Roteamento | 0/2 | Not started | - |
| 4. Fluxos Críticos | 0/2 | Not started | - |

## Requirement Traceability

| Requirement | Description | Phase | Status |
|-------------|-------------|-------|--------|
| INFRA-01 | Vitest + jsdom + RTL + jest-dom instalados | Phase 1 | Complete (01-01) |
| INFRA-02 | vitest.config.js com globals, jsdom e setupFiles | Phase 1 | Complete (01-01) |
| INFRA-03 | .env.test com stubs VITE_FIREBASE_* | Phase 1 | Complete (01-01) |
| INFRA-04 | setupTests.js com jest-dom e cleanup RTL | Phase 1 | Pending |
| INFRA-05 | renderWithProviders.jsx com MemoryRouter + FakeAuthProvider | Phase 1 | Pending |
| INFRA-06 | mockFirebase.js com vi.fn() factory | Phase 1 | Pending |
| INFRA-07 | Scripts test, test:watch, test:coverage no package.json | Phase 1 | Complete (01-01) |
| INFRA-08 | Smoke test `it('works')` passa | Phase 1 | Pending |
| UTIL-01 | fmtDate formata Firestore Timestamp corretamente | Phase 2 | Pending |
| UTIL-02 | fmtBRL formata valores monetários em pt-BR | Phase 2 | Pending |
| UTIL-03 | getLucro calcula margem de lucro corretamente | Phase 2 | Pending |
| UTIL-04 | maskPhone e maskCNPJ mascaram entradas corretamente | Phase 2 | Pending |
| DATA-01 | criarOS chama addDoc com campos corretos | Phase 2 | Pending |
| DATA-02 | atualizarOS chama updateDoc no documento certo | Phase 2 | Pending |
| DATA-03 | getOSdaEmpresa consulta subcoleção por empresaId | Phase 2 | Pending |
| DATA-04 | getEmpresaBySlug busca por slug e retorna null quando não existe | Phase 2 | Pending |
| DATA-05 | cadastrarEmpresa cria documento e retorna dados | Phase 2 | Pending |
| DATA-06 | verificarLimite retorna true/false por plano e contagem | Phase 2 | Pending |
| AUTH-01 | AuthContext exibe loading enquanto onAuthStateChanged pende | Phase 3 | Pending |
| AUTH-02 | AuthContext resolve usuário com empresaId via token claims | Phase 3 | Pending |
| AUTH-03 | AuthContext usa fallback Firestore quando claims sem empresaId | Phase 3 | Pending |
| AUTH-04 | AuthContext identifica superadmin pelo email | Phase 3 | Pending |
| AUTH-05 | AuthContext limpa estado e redireciona no logout | Phase 3 | Pending |
| AUTH-06 | RotaAdmin redireciona para login sem autenticação | Phase 3 | Pending |
| AUTH-07 | RotaAdmin redireciona para login sem empresaId | Phase 3 | Pending |
| AUTH-08 | RotaAdmin renderiza conteúdo para admin válido | Phase 3 | Pending |
| AUTH-09 | RotaSuperAdmin redireciona usuário normal para / | Phase 3 | Pending |
| AUTH-10 | RotaSuperAdmin renderiza conteúdo para superadmin | Phase 3 | Pending |
| AUTH-11 | useEmpresa resolve slug e retorna dados do Firestore | Phase 3 | Pending |
| AUTH-12 | useEmpresa redireciona para /empresa-nao-encontrada | Phase 3 | Pending |
| AUTH-13 | useEmpresa retorna cache sem nova chamada Firestore | Phase 3 | Pending |
| OS-01 | Admin pode criar OS via formulário | Phase 4 | Pending |
| OS-02 | Admin pode editar dados de OS existente | Phase 4 | Pending |
| OS-03 | Admin pode alterar status de OS | Phase 4 | Pending |
| OS-04 | Admin pode excluir OS e ela desaparece da lista | Phase 4 | Pending |
| OS-05 | Lista de OS exibe estado vazio corretamente | Phase 4 | Pending |
| OS-06 | Lista de OS exibe conjunto retornado pelo Firebase | Phase 4 | Pending |
| ORC-01 | Técnico preenche formulário de orçamento com itens | Phase 4 | Pending |
| ORC-02 | Técnico assina orçamento digitalmente antes de enviar | Phase 4 | Pending |
| ORC-03 | Orçamento é salvo no Firestore com dados corretos | Phase 4 | Pending |
| ORC-04 | Cliente visualiza orçamento na página de aprovação | Phase 4 | Pending |
| ORC-05 | Cliente aprova orçamento e assinatura é registrada | Phase 4 | Pending |
| ORC-06 | Orçamento aprovado atualiza status no Firestore | Phase 4 | Pending |

**Coverage:** 37/37 v1 requirements mapped. No orphans.
