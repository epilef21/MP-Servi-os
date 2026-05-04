# Requirements: AssistHub — Cobertura de Testes

**Definido:** 2026-05-03
**Core Value:** Nenhum fluxo crítico (OS, orçamentos, autenticação) deve quebrar silenciosamente quando o código muda.

## v1 Requirements

### Infraestrutura de Testes

- [ ] **INFRA-01**: Vitest 4.1.5 + jsdom + @testing-library/react 16 + @testing-library/jest-dom instalados em mp-react/
- [ ] **INFRA-02**: `mp-react/vitest.config.js` configurado com globals, ambiente jsdom e setupFiles
- [ ] **INFRA-03**: `mp-react/.env.test` com stubs de todas as variáveis VITE_FIREBASE_* para evitar o env-guard bomb
- [ ] **INFRA-04**: `src/test-utils/setupTests.js` com import do jest-dom/vitest e limpeza do RTL
- [ ] **INFRA-05**: `src/test-utils/renderWithProviders.jsx` com MemoryRouter + FakeAuthProvider combinados
- [ ] **INFRA-06**: `src/test-utils/mockFirebase.js` com fábrica de vi.fn() para os exports de ../firebase
- [ ] **INFRA-07**: Scripts `test`, `test:watch` e `test:coverage` adicionados ao package.json de mp-react/
- [ ] **INFRA-08**: Suite de smoke test (`it('works')`) passa com `npm test`

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

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01..08 | Phase 1 | Pending |
| UTIL-01..04 | Phase 2 | Pending |
| DATA-01..06 | Phase 2 | Pending |
| AUTH-01..13 | Phase 3 | Pending |
| OS-01..06 | Phase 4 | Pending |
| ORC-01..06 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 37 total
- Mapeados para fases: 37
- Não mapeados: 0 ✓

---
*Requirements definidos: 2026-05-03*
*Last updated: 2026-05-03 após inicialização*
