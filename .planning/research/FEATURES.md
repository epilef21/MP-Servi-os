# Research: Test Coverage Features

**Project:** AssistHub — milestone cobertura de testes
**Domain:** React 19 + Firebase SaaS, zero testes existentes, meta: confiança para refatorar
**Researched:** 2026-05-03

---

## Table Stakes

Estas categorias devem existir antes de qualquer refatoração. Sem elas, mudanças em código crítico são cegas.

### 1. Helpers de Firestore em `firebase.js`

**Rationale:** Toda lógica de negócio passa por essas funções. São puras o suficiente para testar com mocks simples do SDK. Um bug aqui afeta todos os fluxos.

| Função | O que testar |
|--------|-------------|
| `getEmpresaBySlug(slug)` | Retorna empresa ativa; retorna `null` quando inexistente ou inativa |
| `criarOS(empresaId, dados)` | Chama `addDoc` com `criado_em: serverTimestamp()` nos dados |
| `atualizarOS(empresaId, osId, dados)` | Chama `updateDoc` com o caminho correto de subcoleção |
| `contarOSdoMes(empresaId)` | Filtra por `criado_em >= início do mês`; respeita resultado de `getCountFromServer` |
| `verificarLimite` (via `useEmpresa`) | `limiteOS === -1` nunca bloqueia; `total >= limite` bloqueia; `>= 80%` emite aviso |
| `cadastrarEmpresa` | Grava documento de empresa E documento `config/geral` na mesma operação |

**Estratégia de mock:** `vi.mock('../firebase.js')` — substituir `addDoc`, `updateDoc`, `getDocs`, `getDoc`, `getCountFromServer` por `vi.fn()` que retornam valores controlados.

---

### 2. Fluxo de autenticação — `AuthContext`

**Rationale:** `estaLogado` e `isSuperAdmin` controlam guardas de rota. Uma regressão aqui expõe páginas protegidas ou bloqueia acesso legítimo.

| Cenário | O que verificar |
|---------|----------------|
| Usuário nulo (deslogado) | `estaLogado === false`, `empresaId === null` |
| Login com e-mail normal | `estaLogado === true`, `empresaId` resolvido via `empresas/{uid}` |
| Login com e-mail superadmin | `isSuperAdmin === true`, `empresaId === null` |
| Fallback `usuarios/{uid}` | Se `empresas/{uid}` não existe, lê `usuarios/{uid}.empresaId` |
| `onAuthStateChanged` com erro no Firestore | `empresaId === null`, sem crash |
| `loadingAuth` durante resolução | Renderiza spinner, não conteúdo protegido |

**Estratégia de mock:** `vi.mock('../firebase')` para `onAuthStateChanged` — invocar o callback manualmente com o user desejado. Mock de `getDoc` para controlar retorno de `empresas/{uid}`.

---

### 3. Guardas de rota — `RotaAdmin` e `RotaSuperAdmin` em `App.jsx`

**Rationale:** São os gatekeepers de segurança client-side. Precisam ser verificados isoladamente do componente destino.

| Cenário | Expectativa |
|---------|------------|
| `RotaAdmin` — não autenticado | Redireciona para `/login` |
| `RotaAdmin` — autenticado | Renderiza children |
| `RotaSuperAdmin` — não autenticado | Redireciona para `/login` |
| `RotaSuperAdmin` — autenticado mas não superadmin | Redireciona para `/` |
| `RotaSuperAdmin` — autenticado e superadmin | Renderiza children |

**Estratégia:** Renderizar `<MemoryRouter>` com o estado de auth mockado via `AuthContext.Provider` com valor injetado diretamente.

---

### 4. Hook `useEmpresa` — resolução de tenant por slug

**Rationale:** É o ponto de entrada de multi-tenancy para FormPage, AdminPage, OrcamentoTecnicoPage e AprovarOrcamentoPage. Se falhar, todos os fluxos desses pages param.

| Cenário | Expectativa |
|---------|------------|
| Slug válido, empresa ativa | `empresa`, `config` e `empresaId` preenchidos; `loading` falso |
| Slug não encontrado | `navigate('/empresa-nao-encontrada')` chamado |
| Cache hit (segunda chamada com mesmo slug) | `getEmpresaBySlug` não chamado novamente |
| Slug ausente na URL | `erro` preenchido, `loading` falso |
| Plano `basico`, `totalOSdoMes >= limiteOS` | `verificarLimite` retorna `bloqueado: true` |
| Plano `pro` (`limiteOS === -1`) | `verificarLimite` retorna `bloqueado: false` sempre |

**Nota:** O cache é module-level (`const cache = {}`). Limpar entre testes com `beforeEach(() => { /* reset module */ })` ou via `vi.resetModules()`.

---

### 5. Fluxo de OS — comportamento observável

**Rationale:** É o CRUD central da plataforma. Testa a sequência de ações do admin no painel, não a implementação interna do AdminPage.

Dado que AdminPage tem 3.264 linhas e ~50 `useState`, testar o arquivo inteiro não é viável. A estratégia é testar os **comportamentos observáveis** que dependem das funções de `firebase.js` já mockadas.

| Comportamento | Como testar |
|--------------|------------|
| Criar OS — chama `criarOS` com dados corretos | Simular submit do formulário de criação; verificar que `criarOS` foi chamado com `empresaId` e os campos certos |
| Criar OS bloqueado por limite de plano | Mock `contarOSdoMes` retornando valor igual ao limite; verificar que botão de criar está desabilitado ou mensagem de bloqueio aparece |
| Editar OS — chama `atualizarOS` | Simular edição de campo e save; verificar chamada de `atualizarOS` com os dados alterados |
| Mudança de status (ex: "em andamento" → "concluída") | Simular seleção de status e confirmação; verificar `atualizarOS` com `{ status: 'concluída' }` |
| Fechar/excluir OS — chama `deleteDoc` | Simular ação de exclusão e confirmação; verificar `deleteDoc` com o path correto |
| Lista de OS renderiza dados carregados | Mock `getOSdaEmpresa` retornando array com 2 OS; verificar que 2 itens aparecem na UI |

**Estratégia:** Renderizar `<AdminPage>` com todos os providers necessários (`AuthProvider` mockado, `MemoryRouter` com `/:slug/admin`). Não testar detalhes de estilo ou estado intermediário.

---

### 6. Fluxo de orçamento — sequência em 3 etapas

**Rationale:** O fluxo atravessa 3 páginas independentes e 2 atores (técnico e cliente). Uma quebra silenciosa aqui impacta diretamente o fechamento de serviços.

#### 6a. `OrcamentoTecnicoPage` — técnico preenche

| Cenário | Expectativa |
|---------|------------|
| Página carrega com dados do orçamento via `useEmpresa` + `getDoc` | Campos preenchidos com dados existentes |
| Técnico preenche itens e submete | `updateDoc` chamado com items, diagnóstico e status |
| Campos obrigatórios não preenchidos | Formulário não submete, feedback visível |

#### 6b. `AprovarOrcamentoPage` — cliente aprova

| Cenário | Expectativa |
|---------|------------|
| Página carrega resumo do orçamento | Itens e valores do orçamento visíveis |
| Cliente assina e clica em aprovar | `updateDoc` chamado com `status: 'aprovado'` e dados de assinatura |
| Orçamento já aprovado | UI indica aprovação prévia, botão desabilitado ou ausente |

#### 6c. Geração de PDF (utilitários)

Testar apenas as funções puras de formatação que alimentam os PDFs — não testar a saída de `jsPDF`/`html2canvas` (isso seria testar uma biblioteca de terceiro).

---

### 7. Helpers de formatação — funções puras

**Rationale:** `fmtDate`, `fmtBRL`, `getLucro` estão duplicadas em múltiplos arquivos. Testes unitários dessas funções são os mais baratos de escrever e os mais valiosos para habilitar a centralização posterior em `utils/format.js`.

| Função | Casos de borda a cobrir |
|--------|------------------------|
| `fmtDate` | String `DD/MM/AAAA`, string `YYYY-MM-DD`, Firestore Timestamp, `null`/`undefined` |
| `fmtBRL` | Número válido, string numérica, `NaN`, valor zero |
| `getLucro` | Todos os campos presentes, campo nulo, tudo nulo |
| `maskPhone` | 10 dígitos (fixo), 11 dígitos (celular), entrada com caracteres não-numéricos |
| `maskCNPJ` | 14 dígitos, entrada parcial |

---

## Differentiators

Alta valor, urgência menor — adicionar após os Table Stakes estarem verdes.

### D1. Fluxo completo de login/logout via `LoginPage`

Testar o componente de login renderizado com formulário, erro de credenciais inválidas exibido, e redirecionamento pós-login para `/:slug/admin`. Exige mock de `signInWithEmailAndPassword`.

**Por que não é Table Stake:** Os guardas de rota e o `AuthContext` já garantem a correção do fluxo de auth. O teste do formulário de login agrega valor marginal menor comparado ao custo de renderizar uma página com muitos estados.

### D2. `FormPage` — técnico preenche OS (fluxo público)

Renderizar o formulário público, preencher campos e verificar que `criarOS` é chamado. Também verificar que campos financeiros são bloqueados para usuários não autenticados (regra de negócio expressa no Firestore rules, mas a UI também deve refletir).

**Por que não é Table Stake:** É um formulário de criação simples; a lógica crítica está em `criarOS` (já coberto nos helpers) e nas Firestore rules (fora do escopo deste milestone).

### D3. `AvaliacaoPage` — pesquisa de satisfação

Testar que nota e comentário são submetidos via `updateDoc` com os campos `avaliacao_nota`, `avaliacao_comentario`, `avaliacao_em`. Verificar que submit duplo (avaliação já feita) é bloqueado.

**Por que não é Table Stake:** É um fluxo de pós-venda; não bloqueia operação central.

### D4. `SuperAdminPage` — visão global

Testar que `listarTodasEmpresas` é chamado e que empresas retornadas aparecem na lista. Testar que acesso sem `isSuperAdmin === true` não chega a renderizar (já coberto pelos guardas em Table Stake 3).

### D5. `useEmpresa` — integração com AdminPage (snapshot de estado)

Testar que AdminPage exibe o nome da empresa carregado pelo `useEmpresa` e que a mensagem de limite de plano aparece quando `verificarLimite` retorna `bloqueado: true`.

---

## Anti-Features

O que deliberadamente NÃO testar — essas abordagens criam testes frágeis que quebram em refatorações legítimas.

### A1. Estado interno de `AdminPage` via `useState`

**Por que evitar:** AdminPage tem ~50 `useState`. Testar qual estado muda internamente acopla o teste à implementação. A refatoração futura (extrair modais em componentes separados) vai quebrar todos esses testes sem mudar comportamento observável.

**Em vez disso:** Testar o que o usuário vê e o que o Firebase recebe.

### A2. Ordem de renderização de elementos ou classes CSS

**Por que evitar:** Mudanças de layout e estilo são frequentes. Testes que verificam `className` ou posição de elementos no DOM falham constantemente sem sinalizar regressão real de comportamento.

**Em vez disso:** Usar queries semânticas de RTL (`getByRole`, `getByLabelText`, `getByText`) em vez de `querySelector('.modal-body')`.

### A3. Implementação interna do cache de `useEmpresa`

**Por que evitar:** O cache é um detalhe de performance. Testar que `cache[slug]` foi populado acopla ao formato interno do objeto. A correção é testar o comportamento: segunda chamada não dispara nova query ao Firestore.

### A4. Snapshots de componentes inteiros

**Por que evitar:** Snapshots de componentes grandes (como AdminPage) quebram em qualquer mudança de markup, mesmo trivial. Geram ruído e treino para fazer desenvolvedores atualizarem snapshots sem revisão.

**Em vez disso:** Snapshot apenas de componentes pequenos e estáveis (ex: um badge de status isolado), nunca de páginas inteiras.

### A5. Saída de `jsPDF`, `html2canvas`, `SignatureCanvas`

**Por que evitar:** São bibliotecas de terceiros. Testar que o PDF gerado tem determinado conteúdo binário é frágil, lento e não testa código da aplicação. Testar que as funções de geração são chamadas com os dados corretos (mock de `generatePDF`) é suficiente.

### A6. Regras do Firestore

**Por que evitar:** Firestore security rules requerem o Firebase Emulator Suite para teste adequado — fora do escopo deste milestone (declarado em `PROJECT.md`).

### A7. Cloud Function `criarOSFromExtension`

**Por que evitar:** Também fora do escopo deste milestone. Requer emulador ou chamada real de rede.

---

## Coverage Targets

O objetivo não é 100% de cobertura — é cobertura dos caminhos críticos que habilita refatoração com confiança.

| Arquivo / Módulo | Meta | Justificativa |
|-----------------|------|--------------|
| `firebase.js` (funções exportadas) | 90%+ de branches | É a camada de dados; toda lógica multi-tenant passa aqui |
| `contexts/AuthContext.jsx` | 85%+ de branches | Controla acesso a toda área protegida |
| `hooks/useEmpresa.js` | 85%+ de branches | Ponto de entrada do multi-tenancy em 4 páginas |
| `App.jsx` (RotaAdmin, RotaSuperAdmin) | 100% dos branches (5 cenários) | São os guardas de rota — poucos branches, alto impacto |
| Helpers de formatação (`fmtDate`, `fmtBRL`, etc.) | 100% de statements | São funções puras, triviais de cobrir completamente |
| `AdminPage.jsx` (fluxos de OS) | 60%+ de statements | Arquivo monolítico — cobrir os fluxos críticos, não o arquivo todo |
| `OrcamentoTecnicoPage.jsx` | 70%+ de branches | Fluxo de orçamento do técnico |
| `AprovarOrcamentoPage.jsx` | 70%+ de branches | Fluxo de aprovação do cliente |

**Sinal de "suficiente":** Todos os caminhos listados em Table Stakes cobertos, suite passa em `npm test` sem flaky tests, e qualquer novo desenvolvedor pode rodar os testes e entender o que cada fluxo faz pelos nomes dos `describe`/`it`.

**Sinal de excesso:** Cobertura de linha acima de 80% em `AdminPage.jsx` sem extração de componentes — isso indicaria testes acoplados à implementação monolítica.

---

## Dependências entre fluxos para priorização

```
firebase.js helpers
  └─→ AuthContext (depende de getDoc, onAuthStateChanged)
        └─→ RotaAdmin / RotaSuperAdmin (dependem de estaLogado, isSuperAdmin)
              └─→ AdminPage (depende de auth + helpers de OS)

firebase.js helpers
  └─→ useEmpresa (depende de getEmpresaBySlug, getConfigEmpresa)
        └─→ OrcamentoTecnicoPage (depende de useEmpresa + updateDoc)
        └─→ AprovarOrcamentoPage (depende de useEmpresa + updateDoc)

fmtDate / fmtBRL / getLucro (sem dependências — testar primeiro)
```

**Ordem recomendada de implementação:**
1. Helpers de formatação (zero deps, feedback imediato que a infra de testes funciona)
2. Mocks de `firebase.js` e testes das funções exportadas
3. `AuthContext` usando os mocks de firebase
4. Guardas de rota `RotaAdmin` / `RotaSuperAdmin`
5. `useEmpresa` com mock de `getEmpresaBySlug`
6. Fluxo de OS em `AdminPage` (submit de formulário, mudança de status)
7. `OrcamentoTecnicoPage` e `AprovarOrcamentoPage`
