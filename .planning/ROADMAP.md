# Roadmap: AssistHub — Cobertura de Testes + Produto Core

**Milestones:** Test Coverage v1 (Phases 1-4) · Produto Core v1.1 (Phases 5-6)
**Created:** 2026-05-03
**Updated:** 2026-05-05
**Phases:** 6
**Requirements:** 45 (37 v1.0 + 8 v1.1)

## Overview

Quatro fases encadeadas levam a plataforma de zero testes para uma suite confiável dos fluxos críticos. A ordem respeita o grafo de dependências: infra primeiro (nada roda sem ela), utilitários puros e camada de dados em seguida (sem dependências de contexto React), autenticação e roteamento depois (depende dos mocks de firebase.js estabelecidos na fase anterior), e os fluxos de negócio por último (dependem de auth, roteamento e helpers de dados funcionando nos testes).

As Phases 5 e 6 pertencem ao milestone v1.1 Produto Core e são independentes da suite de testes — entregam as duas features de produto pendentes da PRIORIDADE 2 do backlog.

## Phases

- [x] **Phase 1: Infraestrutura de Testes** - Configurar Vitest, RTL, mocks globais e smoke test passando
- [x] **Phase 2: Camada Base** - Testar utilitários puros e funções de acesso ao Firestore em isolamento
- [ ] **Phase 3: Auth e Roteamento** - Testar AuthContext, guards de rota e hook useEmpresa
- [ ] **Phase 4: Fluxos Críticos** - Testar CRUD de OS e fluxo completo de orçamento
- [x] **Phase 5: Compressão de Imagens** - Técnico pode enviar fotos comprimidas no orçamento com feedback visual
- [x] **Phase 6: Relatório Mensal em PDF** - Admin pode gerar e baixar relatório mensal com OS, lucro e breakdown

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
- [x] 01-02: Criar src/test-utils/ (setupTests.js, renderWithProviders.jsx, mockFirebase.js) e smoke test

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
- [x] 02-01: Testes das funções utilitárias puras (UTIL-01..04)
- [x] 02-02: Testes das funções de acesso ao Firestore em firebase.js (DATA-01..06)

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

### Phase 5: Compressão de Imagens
**Goal**: Técnico pode enviar fotos no orçamento com garantia de que cada arquivo respeita o limite de 400KB, com feedback visual durante o processo e mensagem clara se algo der errado.
**Depends on**: Nothing (feature independente — não depende das fases de teste)
**Requirements**: IMG-01, IMG-02, IMG-03
**Success Criteria** (what must be TRUE):
  1. Técnico seleciona uma foto grande (ex: 3MB) no formulário de orçamento e o upload enviado ao Storage nunca ultrapassa 400KB
  2. Enquanto a compressão está em andamento, o técnico vê um indicador visual (spinner, texto ou barra) que desaparece quando a compressão termina
  3. Se a compressão falhar (arquivo corrompido, formato inesperado), o técnico vê uma mensagem de erro em português — sem crash da página
**Plans**: 1 plan

Plans:
- [x] 05-01: Integrar browser-image-compression em OrcamentoTecnicoPage (compressão, feedback, tratamento de erro)

**UI hint**: yes
**Complexity**: low

---

### Phase 6: Relatório Mensal em PDF
**Goal**: Admin pode selecionar qualquer mês/ano, visualizar os dados consolidados de OS e lucro por status, seguradora e técnico, e baixar o relatório como arquivo PDF.
**Depends on**: Nothing (feature independente — lê campo lucroReal já existente em cada OS)
**Requirements**: REL-01, REL-02, REL-03, REL-04, REL-05
**Success Criteria** (what must be TRUE):
  1. Admin vê no painel um seletor de mês e ano e pode escolher qualquer período dos últimos 12 meses
  2. Após selecionar o período, os dados de OS do mês aparecem na tela: total de OS, breakdown por status, lucro total, média por OS, breakdown por seguradora e breakdown por técnico
  3. Todos os valores monetários exibidos na tela batem com o campo `lucroReal` salvo nos documentos de OS do período
  4. Admin clica em "Baixar PDF" e recebe um arquivo PDF gerado no browser via jsPDF, sem chamada a servidor externo
  5. O PDF contém as mesmas seções da tela: total OS, status, lucro, seguradora e técnico — legível e sem dados trocados
**Plans**: 2 plans

Plans:

**Wave 1**
- [x] 06-01: Criar utils/relatorioMensalPdf.js (agregarRelatorio + gerarRelatorioMensalPdf via jsPDF)

**Wave 2** *(bloqueado pelo Wave 1)*
- [x] 06-02: Criar UI na AdminPage — seletor de mês/ano, tabelas de resultado e botão de download

**Cross-cutting constraints:**
- getLucroLocal deve replicar exatamente getLucro() do AdminPage: (mo_seguradora - valor_prestador) + valor_deslocamento
- Filtro de OS por período usa criado_em.toDate() — consistente com padrão já usado em stats/chartData do AdminPage

**UI hint**: yes
**Complexity**: medium

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infraestrutura de Testes | 2/2 | Complete | 2026-05-03 |
| 2. Camada Base | 2/2 | Complete | 2026-05-05 |
| 3. Auth e Roteamento | 0/2 | Not started | - |
| 4. Fluxos Críticos | 0/2 | Not started | - |
| 5. Compressão de Imagens | 1/1 | Complete | 2026-05-04 |
| 6. Relatório Mensal em PDF | 2/2 | Complete | 2026-05-05 |

## Requirement Traceability

| Requirement | Description | Phase | Status |
|-------------|-------------|-------|--------|
| INFRA-01 | Vitest + jsdom + RTL + jest-dom instalados | Phase 1 | Complete (01-01) |
| INFRA-02 | vitest.config.js com globals, jsdom e setupFiles | Phase 1 | Complete (01-01) |
| INFRA-03 | .env.test com stubs VITE_FIREBASE_* | Phase 1 | Complete (01-01) |
| INFRA-04 | setupTests.js com jest-dom e cleanup RTL | Phase 1 | Complete (01-02) |
| INFRA-05 | renderWithProviders.jsx com MemoryRouter + FakeAuthProvider | Phase 1 | Complete (01-02) |
| INFRA-06 | mockFirebase.js com vi.fn() factory | Phase 1 | Complete (01-02) |
| INFRA-07 | Scripts test, test:watch, test:coverage no package.json | Phase 1 | Complete (01-01) |
| INFRA-08 | Smoke test `it('works')` passa | Phase 1 | Complete (01-02) |
| UTIL-01 | fmtDate formata Firestore Timestamp corretamente | Phase 2 | Complete (02-01) |
| UTIL-02 | fmtBRL formata valores monetários em pt-BR | Phase 2 | Complete (02-01) |
| UTIL-03 | getLucro calcula margem de lucro corretamente | Phase 2 | Complete (02-01) |
| UTIL-04 | maskPhone e maskCNPJ mascaram entradas corretamente | Phase 2 | Complete (02-01) |
| DATA-01 | criarOS chama addDoc com campos corretos | Phase 2 | Complete (02-02) |
| DATA-02 | atualizarOS chama updateDoc no documento certo | Phase 2 | Complete (02-02) |
| DATA-03 | getOSdaEmpresa consulta subcoleção por empresaId | Phase 2 | Complete (02-02) |
| DATA-04 | getEmpresaBySlug busca por slug e retorna null quando não existe | Phase 2 | Complete (02-02) |
| DATA-05 | cadastrarEmpresa cria documento e retorna dados | Phase 2 | Complete (02-02) |
| DATA-06 | verificarLimite retorna true/false por plano e contagem | Phase 2 | Complete (02-02) |
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
| IMG-01 | Fotos comprimidas para máx 400KB antes do upload ao Storage | Phase 5 | Complete (05-01) |
| IMG-02 | Interface exibe feedback visual durante compressão | Phase 5 | Complete (05-01) |
| IMG-03 | Mensagem de erro amigável exibida se compressão falhar | Phase 5 | Complete (05-01) |
| REL-01 | Admin seleciona mês e ano para gerar relatório mensal | Phase 6 | Complete (06-02) |
| REL-02 | Relatório exibe total de OS e breakdown por status | Phase 6 | Complete (06-01, 06-02) |
| REL-03 | Relatório exibe lucro total, média por OS e breakdown por seguradora | Phase 6 | Complete (06-01, 06-02) |
| REL-04 | Relatório exibe OS e lucro por técnico no período | Phase 6 | Complete (06-01, 06-02) |
| REL-05 | Admin baixa relatório como PDF gerado via jsPDF | Phase 6 | Complete (06-01, 06-02) |

**Coverage:** 45/45 requirements mapped. No orphans.
