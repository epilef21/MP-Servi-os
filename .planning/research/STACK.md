# Research: Testing Stack

**Project:** AssistHub — Milestone: Cobertura de Testes
**Researched:** 2026-05-03

---

## Recommendation

**Vitest 4.1.5 + jsdom 25 + @testing-library/react 16 + @testing-library/user-event 14 + vi.mock() para Firebase**

Stack completa e prescritiva:

| Package | Version | Role |
|---------|---------|------|
| `vitest` | `^4.1.5` | Framework de testes — nativo no Vite, zero configuração de transpile |
| `jsdom` | `^25.0.0` | Ambiente de DOM simulado para componentes React |
| `@testing-library/react` | `^16.3.2` | Utilitários de teste de componente centrados no comportamento |
| `@testing-library/dom` | `^10.x` | Peer dependency obrigatório do RTL 16 |
| `@testing-library/user-event` | `^14.6.1` | Simulação realista de eventos de usuário (v14: async + setup()) |
| `@testing-library/jest-dom` | `^6.9.1` | Matchers customizados (`toBeInTheDocument`, `toHaveValue`, etc.) |

---

## Package List

```bash
# Instalar na pasta mp-react/
cd mp-react

npm install -D \
  vitest@^4.1.5 \
  jsdom@^25.0.0 \
  @testing-library/react@^16.3.2 \
  @testing-library/dom@^10.4.0 \
  @testing-library/user-event@^14.6.1 \
  @testing-library/jest-dom@^6.9.1
```

Nenhum pacote adicional é necessário. MSW, Firebase Emulator e firestore-vitest-mock
estao explicitamente fora do escopo — ver seção Rationale.

---

## Rationale

### Vitest 4.1.5 — uso obrigatório (nao usar Jest)

**Por que Vitest:** O projeto usa Vite 8.0.4. Vitest é o único framework que roda
dentro do mesmo pipeline do Vite — mesmo config, mesmo sistema de módulos ESM, mesmo
plugin `@vitejs/plugin-react`. Jest requer `babel-jest` ou `ts-jest` para transpilar
JSX e ESM, o que duplica configuração e cria discrepâncias de comportamento entre
testes e build.

**Por que 4.1.5 (nao 2.x ou 3.x):**
- Vitest 4.1 é a primeira versão com suporte nativo a Vite 8 (lançado junto com o beta)
- Vitest 4.0 exige Vite >= 6.0.0 e Node >= 20 — ambos satisfeitos (Vite 8.0.4, Node 22)
- Vitest 3 tem incompatibilidade documentada com Vite 6.3+ que causava falhas silenciosas
  em Custom render functions do React Testing Library

**Nao usar Jest porque:**
- Requer configuração de transpile separada para ESM/JSX
- Sem integração nativa com Vite — testes e build rodam em ambientes diferentes
- PROJECT.md explicita: "Manter Vitest (Vite já instalado) — não adicionar Jest"

### jsdom 25 vs happy-dom — usar jsdom

**Por que jsdom:**
- Mais completo e battle-tested: 10+ anos de maturidade, cobre edge cases de DOM/CSS
- happy-dom é 2-4x mais rápido, mas a diferença só importa em suites com 500+ testes
- Para uma suite nova partindo do zero com foco em fluxos críticos (OS CRUD, auth,
  orçamentos), a velocidade nao é o gargalo — confiabilidade é
- happy-dom tem gaps documentados em APIs de DOM menos comuns; jsdom nunca surpreende
- Projetos que migraram de jsdom para happy-dom relatam 15 min de setup, mas também
  precisam de overrides `@vitest-environment jsdom` em testes que usam APIs ausentes

**Quando reconsiderar happy-dom:** se a suite crescer para 300+ testes e `npm test`
demorar mais de 30s — nesse momento a migração vale.

### @testing-library/react 16.3.2 — compatível com React 19.2.4

- RTL 16 tem suporte oficial ao React 19 — sem flags `--legacy-peer-deps`
- Desde RTL 16, `@testing-library/dom` é peer dependency obrigatório — incluir na
  instalação
- RTL 16 resolve a regressão de Suspense do RTL 16.1.0 (componentes suspensos nunca
  resolviam no React 19)

### @testing-library/user-event 14.6.1

- v14 introduz `userEvent.setup()` que retorna uma instância com estado de teclado/mouse
  persistido entre ações — essencial para testar fluxos sequenciais (login → navegar →
  preencher formulário)
- Nunca usar `fireEvent` diretamente do RTL para interações do usuário — é baixo nível
  e nao dispara eventos de acessibilidade; user-event é a forma correta

### @testing-library/jest-dom 6.9.1

- Fornece matchers legíveis: `toBeInTheDocument()`, `toHaveValue()`, `toBeDisabled()`
- Importar via `'@testing-library/jest-dom/vitest'` no setupFile (nao o barrel antigo
  `'@testing-library/jest-dom'`) — o subpath `/vitest` registra os matchers no `expect`
  do Vitest corretamente

### vi.mock() para Firebase — nao usar Firebase Emulator Suite para esta milestone

**Por que vi.mock() e nao Emulator:**

O Firebase JS SDK v12 usa WebSockets e gRPC internamente — MSW nao intercepta sockets,
portanto MSW está fora da equação para Firebase.

A escolha é entre vi.mock() e Firebase Emulator Suite:

| Critério | vi.mock() | Firebase Emulator |
|----------|-----------|-------------------|
| Velocidade de execução | Instantâneo | +3-10s de startup |
| Isolamento | Total — sem estado compartilhado | Compartilha estado entre testes se nao resetar |
| Setup inicial | ~10 linhas de config | Instalar Firebase CLI, JSON de configuração, processo externo |
| Determinismo | 100% — você controla o que a função retorna | Depende do estado do emulador |
| Cobertura | Testa a lógica que usa Firebase, nao o Firebase em si | Testa integração real com regras do Firestore |
| CI/CD | Zero dependências externas | Requer Java + Firebase CLI no runner |
| Adequado para | Unit tests e component tests | Integration tests de Firestore Security Rules |

Para esta milestone — component tests de OS CRUD, auth, orçamentos — vi.mock() é a
escolha correta. O objetivo é testar a lógica da UI, nao as regras do Firestore.

**Padrão canônico de vi.mock() para Firebase:**

```js
// Mock de módulos Firebase — padrão module factory
vi.mock('firebase/firestore', () => ({
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
  getFirestore: vi.fn(),
  Timestamp: { now: vi.fn(() => ({ toDate: () => new Date() })) },
}))

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
}))

// Dentro do teste: configurar retorno
import { getDoc } from 'firebase/firestore'
getDoc.mockResolvedValue({ exists: () => true, data: () => ({ nome: 'OS-001' }) })
```

**IMPORTANTE:** `vi.mock()` é hoisted automaticamente para o topo do arquivo — nao
colocar dentro de `beforeEach` ou funções.

**Nao usar `firestore-vitest-mock`:** biblioteca com 0 stars, aviso de bloqueador nao
resolvido no repositório, sem suporte documentado ao Firebase SDK v12.

---

## Configuration

### 1. Criar arquivo de configuração separado (nao misturar com vite_config.js)

O projeto usa `mp-react/vite_config.js` (nome nao-padrão). Vitest pode ter seu próprio
arquivo de config ou ser inlineado:

```js
// mp-react/vitest.config.js  (arquivo novo, separado do vite_config.js)
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,              // permite describe/it/expect sem import
    environment: 'jsdom',       // DOM simulado para componentes React
    setupFiles: './src/setupTests.js',
    css: false,                 // ignora imports de CSS nos componentes
  },
})
```

### 2. Setup file

```js
// mp-react/src/setupTests.js
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Limpa o DOM após cada teste — evita vazamento de estado entre testes
afterEach(() => {
  cleanup()
})
```

### 3. Script npm

```json
// mp-react/package.json — adicionar em "scripts"
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

`vitest run` executa uma vez e sai (adequado para CI). `vitest` sozinho entra em modo
watch. `--ui` abre interface visual no browser.

### 4. Onde colocar os testes

```
mp-react/src/
  __tests__/
    auth.test.jsx          # login, guards, multi-tenancy por slug
    os-crud.test.jsx       # criar, editar, fechar, listar OS
    budget-flow.test.jsx   # técnico preenche → cliente aprova
  utils/
    slug.test.js           # funções utilitárias puras
    firestore-helpers.test.js
```

Co-localizar testes com utilitários puros, usar `__tests__/` para testes de componente.
Ambas as convenções são suportadas por Vitest.

---

## O que NAO instalar

| Pacote | Motivo |
|--------|--------|
| `jest` | Conflito com Vitest, requer configuração de transpile para ESM |
| `babel-jest` | Desnecessário com Vitest + Vite |
| `ts-jest` | Projeto é JavaScript puro, sem TypeScript |
| `firestore-vitest-mock` | 0 stars, bloqueador nao resolvido, sem suporte Firebase v12 |
| `firebase-mock` | Desenvolvido para Firebase SDK v7-8, desatualizado |
| `msw` (Mock Service Worker) | MSW nao intercepta sockets WebSocket/gRPC do Firebase SDK |
| `@firebase/rules-unit-testing` | Para testar Firestore Security Rules, fora do escopo desta milestone |
| `cypress` / `playwright` | Testes E2E, escopo explicitamente fora desta milestone |
| `happy-dom` | Substituir jsdom apenas se a suite crescer muito e a velocidade virar gargalo |

---

## Confidence

| Area | Confidence | Notes |
|------|------------|-------|
| Vitest 4.1.5 + Vite 8 | HIGH | Confirmado nas release notes do Vitest 4.1 — suporte a Vite 8 explícito |
| RTL 16 + React 19 | HIGH | Compatibilidade confirmada em múltiplas fontes (npm, RTL releases, relatos) |
| jsdom sobre happy-dom | MEDIUM | Baseado em comparações de comunidade; happy-dom ainda em desenvolvimento ativo |
| vi.mock() sobre Firebase Emulator | HIGH | Alinhado com o escopo declarado no PROJECT.md; limitação de MSW/sockets confirmada |
| Padrão de vi.mock() para Firebase v12 | MEDIUM | Padrão genérico de Vitest confirmado; sintaxe específica do Firebase v12 baseada em documentação de versões anteriores + padrão de module factory — precisa ser validada no primeiro teste real |

---

## Sources

- Vitest releases: https://github.com/vitest-dev/vitest/releases
- Vite 8 announcement: https://vite.dev/blog/announcing-vite8
- RTL 16 + React 19: https://depfixer.com/compatibility/react-19-testing-library-react-16
- Vitest 3 + Vite 6 + React 19 upgrade guide: https://www.thecandidstartup.org/2025/03/31/vitest-3-vite-6-react-19.html
- jsdom vs happy-dom 2026: https://www.pkgpulse.com/blog/happy-dom-vs-jsdom-2026
- MSW e Firebase sockets: https://courses.cs.northwestern.edu/394/guides/mocking-services.php
- Vitest mocking guide: https://vitest.dev/guide/mocking
- firestore-vitest-mock (descartado): https://github.com/Firfi/firestore-vitest-mock
- @testing-library/jest-dom + Vitest: https://markus.oberlehner.net/blog/using-testing-library-jest-dom-with-vitest
