# Requirements: AssistHub

**Atualizado:** 2026-05-04
**Core Value:** Produto confiável e completo — fluxos críticos cobertos por testes e features core entregues.

---

## v1.1 Requirements — Produto Core

**Definido:** 2026-05-04

### Compressão de Imagens no Orçamento (IMG)

- [ ] **IMG-01**: Técnico pode enviar fotos no orçamento comprimidas para máx 400KB antes do upload ao Storage
- [ ] **IMG-02**: Interface exibe feedback visual enquanto a compressão está em andamento
- [ ] **IMG-03**: Mensagem de erro amigável é exibida se a compressão falhar

### Relatório Mensal em PDF (REL)

- [ ] **REL-01**: Admin pode selecionar mês e ano para gerar o relatório mensal
- [ ] **REL-02**: Relatório exibe total de OS e breakdown por status (pendente/processado/enviado) no período
- [ ] **REL-03**: Relatório exibe lucro total, média por OS e breakdown por seguradora no período
- [ ] **REL-04**: Relatório exibe OS e lucro por técnico no período
- [ ] **REL-05**: Admin pode baixar o relatório como PDF gerado via jsPDF

---

## v1.1 Out of Scope

| Feature | Motivo |
|---------|--------|
| Bugs críticos (PRIORIDADE 1) | Milestone separado (BUG-001..005) |
| Monetização / legal (PRIORIDADE 3) | Milestone futuro — produto primeiro |
| Portal do técnico / WhatsApp / Ranking (PRIORIDADE 4) | Diferencial competitivo — milestone futuro |
| Escala / PWA / Sentry (PRIORIDADE 5) | Infraestrutura — milestone futuro |
| TCC / FastAPI / Plotly (PRIORIDADE 6) | Contexto acadêmico — milestone separado |

---

## v1.0 Requirements — Cobertura de Testes

**Definido:** 2026-05-03
**Core Value:** Nenhum fluxo crítico (OS, orçamentos, autenticação) deve quebrar silenciosamente quando o código muda.

## v1 Requirements

### Infraestrutura de Testes

- [x] **INFRA-01**: Vitest 4.1.5 + jsdom + @testing-library/react 16 + @testing-library/jest-dom instalados em mp-react/
- [x] **INFRA-02**: `mp-react/vitest.config.js` configurado com globals, ambiente jsdom e setupFiles
- [x] **INFRA-03**: `mp-react/.env.test` com stubs de todas as variáveis VITE_FIREBASE_* para evitar o env-guard bomb
- [x] **INFRA-04**: `src/test-utils/setupTests.js` com import do jest-dom/vitest e limpeza do RTL
- [x] **INFRA-05**: `src/test-utils/renderWithProviders.jsx` com MemoryRouter + FakeAuthProvider combinados
- [x] **INFRA-06**: `src/test-utils/mockFirebase.js` com fábrica de vi.fn() para os exports de ../firebase
- [x] **INFRA-07**: Scripts `test`, `test:watch` e `test:coverage` adicionados ao package.json de mp-react/
- [x] **INFRA-08**: Suite de smoke test (`it('works')`) passa com `npm test`

### Utilitários Puros

- [ ] **UTIL-01**: Usuário pode confiar que `fmtDate` formata datas Firestore Timestamp corretamente (toDate() + locale pt-BR)
- [ ] **UTIL-02**: Usuário pode confiar que `fmtBRL` formata valores monetários no padrão brasileiro
- [ ] **UTIL-03**: Usuário pode confiar que `getLucro` calcula margem de lucro corretamente
- [ ] **UTIL-04**: Usuário pode confiar que `maskPhone` e `maskCNPJ` mascaram entradas conforme esperado

### Camada de Dados (firebase.js)

- [ ] **DATA-01**: `criarOS` chama addDoc com os campos corretos e retorna o ID do documento
- [ ] **DATA-02**: `atualizarOS` chama updateDoc no documento certo com os campos fornecidos
- [ ] **DATA-03**: `getOSdaEmpresa` consulta a subcoleção correta filtrando por empresaId
- [ ] **DATA-04**: `getEmpresaBySlug` busca empresa por slug e retorna null quando não encontrada
- [ ] **DATA-05**: `cadastrarEmpresa` cria documento na coleção correta e retorna os dados da empresa
- [ ] **DATA-06**: `verificarLimite` retorna true/false corretamente baseado no plano e contagem de OS do mês

### Autenticação e Roteamento

- [ ] **AUTH-01**: AuthContext exibe loading enquanto onAuthStateChanged não respondeu
- [ ] **AUTH-02**: AuthContext resolve usuário normal com empresaId via token claims
- [ ] **AUTH-03**: AuthContext usa fallback de leitura no Firestore quando claims não têm empresaId
- [ ] **AUTH-04**: AuthContext identifica superadmin pelo email SUPERADMIN_EMAIL
- [ ] **AUTH-05**: AuthContext limpa estado e redireciona no logout
- [ ] **AUTH-06**: RotaAdmin redireciona para login quando usuário não está autenticado
- [ ] **AUTH-07**: RotaAdmin redireciona para login quando usuário está autenticado mas sem empresaId
- [ ] **AUTH-08**: RotaAdmin renderiza conteúdo quando usuário admin válido está autenticado
- [ ] **AUTH-09**: RotaSuperAdmin redireciona usuário normal (não superadmin) para /
- [ ] **AUTH-10**: RotaSuperAdmin renderiza conteúdo para superadmin autenticado
- [ ] **AUTH-11**: useEmpresa resolve slug da URL e retorna dados da empresa do Firestore
- [ ] **AUTH-12**: useEmpresa redireciona para /empresa-nao-encontrada quando slug não existe
- [ ] **AUTH-13**: useEmpresa retorna dados do cache sem nova chamada ao Firestore na segunda consulta

### Fluxo de Ordens de Serviço

- [ ] **OS-01**: Usuário admin pode criar uma nova OS preenchendo o formulário e confirmando
- [ ] **OS-02**: Usuário admin pode editar dados de uma OS existente
- [ ] **OS-03**: Usuário admin pode alterar o status de uma OS (ex: Aberta → Em andamento → Finalizada)
- [ ] **OS-04**: Usuário admin pode excluir uma OS e ela desaparece da lista
- [ ] **OS-05**: Lista de OS exibe corretamente quando não há nenhuma OS cadastrada
- [ ] **OS-06**: Lista de OS exibe o conjunto de OS retornado pelo Firebase

### Fluxo de Orçamento

- [ ] **ORC-01**: Técnico pode preencher o formulário de orçamento com itens e valores
- [ ] **ORC-02**: Técnico pode assinar o orçamento digitalmente antes de enviar
- [ ] **ORC-03**: Orçamento preenchido é salvo no Firestore com os dados corretos
- [ ] **ORC-04**: Cliente pode visualizar o orçamento na página de aprovação
- [ ] **ORC-05**: Cliente pode aprovar o orçamento e a assinatura é registrada
- [ ] **ORC-06**: Orçamento aprovado atualiza o status no Firestore corretamente

## v2 Requirements

Adiados para milestone futuro.

- **CI-01**: GitHub Actions rodando `npm test` em cada push/PR
- **E2E-01**: Testes end-to-end com Playwright cobrindo fluxo completo de OS
- **EXT-01**: Testes da extensão Chrome (popup, scraper, service worker)
- **FUNC-01**: Testes da Cloud Function `criarOSFromExtension` via Firebase Emulator Suite
- **SEC-01**: Testes de Firestore Security Rules via Firebase Emulator Suite
- **PAGES-01**: Testes de LoginPage, FormPage, AvaliacaoPage, SuperAdminPage
- **REFACTOR-01**: Quebrar AdminPage.jsx em subcomponentes menores (habilitado pelos testes de v1)

## Out of Scope

| Feature | Motivo |
|---------|--------|
| Cobertura 100% | Objetivo é confiança nos caminhos críticos, não completude métrica |
| Jest | Projeto usa Vite — Vitest é o framework correto; Jest requer configuração de transpile |
| MSW (Mock Service Worker) | Firebase usa WebSocket/gRPC internamente; MSW não intercepta. vi.mock() é a solução correta |
| Firebase Emulator Suite | Certo para testar Security Rules (v2), não para testes de UI/componente |
| TypeScript | Projeto existente é JavaScript puro — não introduzir TypeScript nos testes |
| Refatoração do AdminPage | Consequência natural dos testes de v1, mas não é pré-requisito |
| Correções de segurança | Milestone separado (Firestore rules, uploads públicos, emails hardcoded) |

## Traceability

| Requirement | Phase | Plan | Status |
|-------------|-------|------|--------|
| INFRA-01 | Phase 1 | 01-01 | Complete |
| INFRA-02 | Phase 1 | 01-01 | Complete |
| INFRA-03 | Phase 1 | 01-01 | Complete |
| INFRA-04 | Phase 1 | 01-02 | Complete |
| INFRA-05 | Phase 1 | 01-02 | Complete |
| INFRA-06 | Phase 1 | 01-02 | Complete |
| INFRA-07 | Phase 1 | 01-01 | Complete |
| INFRA-08 | Phase 1 | 01-02 | Complete |
| UTIL-01 | Phase 2 | 02-01 | Pending |
| UTIL-02 | Phase 2 | 02-01 | Pending |
| UTIL-03 | Phase 2 | 02-01 | Pending |
| UTIL-04 | Phase 2 | 02-01 | Pending |
| DATA-01 | Phase 2 | 02-02 | Pending |
| DATA-02 | Phase 2 | 02-02 | Pending |
| DATA-03 | Phase 2 | 02-02 | Pending |
| DATA-04 | Phase 2 | 02-02 | Pending |
| DATA-05 | Phase 2 | 02-02 | Pending |
| DATA-06 | Phase 2 | 02-02 | Pending |
| AUTH-01 | Phase 3 | 03-01 | Pending |
| AUTH-02 | Phase 3 | 03-01 | Pending |
| AUTH-03 | Phase 3 | 03-01 | Pending |
| AUTH-04 | Phase 3 | 03-01 | Pending |
| AUTH-05 | Phase 3 | 03-01 | Pending |
| AUTH-06 | Phase 3 | 03-02 | Pending |
| AUTH-07 | Phase 3 | 03-02 | Pending |
| AUTH-08 | Phase 3 | 03-02 | Pending |
| AUTH-09 | Phase 3 | 03-02 | Pending |
| AUTH-10 | Phase 3 | 03-02 | Pending |
| AUTH-11 | Phase 3 | 03-02 | Pending |
| AUTH-12 | Phase 3 | 03-02 | Pending |
| AUTH-13 | Phase 3 | 03-02 | Pending |
| OS-01 | Phase 4 | 04-01 | Pending |
| OS-02 | Phase 4 | 04-01 | Pending |
| OS-03 | Phase 4 | 04-01 | Pending |
| OS-04 | Phase 4 | 04-01 | Pending |
| OS-05 | Phase 4 | 04-01 | Pending |
| OS-06 | Phase 4 | 04-01 | Pending |
| ORC-01 | Phase 4 | 04-02 | Pending |
| ORC-02 | Phase 4 | 04-02 | Pending |
| ORC-03 | Phase 4 | 04-02 | Pending |
| ORC-04 | Phase 4 | 04-02 | Pending |
| ORC-05 | Phase 4 | 04-02 | Pending |
| ORC-06 | Phase 4 | 04-02 | Pending |
| IMG-01 | Phase 5 | 05-01 | Pending |
| IMG-02 | Phase 5 | 05-01 | Pending |
| IMG-03 | Phase 5 | 05-01 | Pending |
| REL-01 | Phase 6 | 06-02 | Pending |
| REL-02 | Phase 6 | 06-02 | Pending |
| REL-03 | Phase 6 | 06-01 | Pending |
| REL-04 | Phase 6 | 06-01 | Pending |
| REL-05 | Phase 6 | 06-02 | Pending |

**Coverage:**
- v1.0 requirements: 37 total — 37 mapped
- v1.1 requirements: 8 total — 8 mapped
- Total: 45/45 mapped. No orphans.

---
*Requirements definidos: 2026-05-03*
*Last updated: 2026-05-04 — v1.1 requirements adicionados (IMG-01..03, REL-01..05); traceability expandida para Phases 5-6*
