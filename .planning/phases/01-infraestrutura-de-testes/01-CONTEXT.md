# Phase 1: Infraestrutura de Testes - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Instalar e configurar o ambiente completo de testes do AssistHub: Vitest 4.1.5 + jsdom + React Testing Library 16, criar os helpers compartilhados de `test-utils/`, resolver o env-guard bomb do `firebase.js` via `.env.test`, e garantir que `npm test` passa com um smoke test. Esta fase entrega apenas a infraestrutura — nenhum teste de negócio é escrito aqui.

</domain>

<decisions>
## Implementation Decisions

### Vitest Config Strategy
- **D-01:** `vitest.config.js` standalone — arquivo independente com o plugin React declarado diretamente. Não extende nem importa `vite_config.js`.
- **D-02:** `vite_config.js` permanece com nome não-padrão e sem alterações — Vitest usará o `vitest.config.js` explicitamente sem tentar auto-detectar o config do Vite.
- **D-03:** O `vitest.config.js` usa `clearMocks: true` — nunca `resetMocks: true` ou `restoreMocks: true`.

### Dependências de Teste
- **D-04:** Instalar via `npm install -D` dentro de `mp-react/`:
  - `vitest@^4.1.5`
  - `jsdom@^25.0.0`
  - `@testing-library/react@^16.3.2`
  - `@testing-library/dom@^10.4.0`
  - `@testing-library/user-event@^14.6.1`
  - `@testing-library/jest-dom@^6.9.1`
- **D-05:** Não instalar: Jest, MSW, Cypress, Playwright, `firestore-vitest-mock`, `firebase-mock`.

### Scripts npm
- **D-06:** Scripts a adicionar em `mp-react/package.json`:
  - `"test": "vitest run"` — single-run (compatível com CI)
  - `"test:watch": "vitest"` — watch mode para desenvolvimento
  - `"test:coverage": "vitest run --coverage"`

### .env.test (env-guard bomb)
- **D-07:** Criar `mp-react/.env.test` com stubs de todas as variáveis `VITE_FIREBASE_*`. Valores são strings não-vazias arbitrárias (não precisam ser credenciais reais). Este arquivo deve ser commitado no repositório.
- **D-08:** O `.env.test` deve incluir: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, e `VITE_SUPERADMIN_EMAIL` (para evitar que o fallback hardcoded seja exposto em testes).

### test-utils/ helpers
- **D-09:** Localização: `mp-react/src/test-utils/` (não `__tests__/` — diretório de utilitários, não de testes).
- **D-10:** `setupTests.js` — importa `@testing-library/jest-dom/vitest` (não o barrel genérico) e chama `afterEach(cleanup)` do RTL.
- **D-11:** `renderWithProviders.jsx` — combina `MemoryRouter` com `FakeAuthProvider`. Aceita `{ route, authOverrides }` como opções. `FakeAuthProvider` sempre inclui `loadingAuth: false` por padrão.
- **D-12:** `mockFirebase.js` — exporta uma **factory function** `createFirebaseMocks()` que retorna um objeto com `vi.fn()` frescos. Chamada no `beforeEach` de cada teste para garantir isolamento completo. Não é um objeto estático global.

### Claude's Discretion
- Estrutura interna do `vitest.config.js` (providers, globals, environment options para locale pt-BR).
- Exato conteúdo do smoke test (`it('works', () => expect(1+1).toBe(2))` ou similar).
- Se adicionar `@vitest/ui` ou não — decisão de conveniência, não impacta a suite.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos da fase
- `.planning/REQUIREMENTS.md` §INFRA-01..08 — 8 requisitos de infraestrutura desta fase
- `.planning/ROADMAP.md` §Phase 1 — goal, planos 01-01 e 01-02, critérios de sucesso

### Pesquisa de domínio (leitura obrigatória para o planner)
- `.planning/research/SUMMARY.md` — síntese completa: stack, install command, pitfalls top-5, build order
- `.planning/research/STACK.md` — decisões de stack com versões exatas e rationale
- `.planning/research/PITFALLS.md` — armadilhas específicas do codebase (env-guard bomb, mock boundary, etc.)

### Código existente relevante
- `mp-react/vite_config.js` — config do Vite (plugin React) — vitest.config.js deve replicar o plugin
- `mp-react/src/firebase.js` (linhas 45-60) — env-guard bomb: `if (!firebaseConfig.apiKey) throw` — motivo do `.env.test`
- `mp-react/package.json` — scripts existentes e dependências atuais

### Decisões de projeto
- `CLAUDE.md` §"Decisões de teste (não reverter)" — regras de ouro do projeto para testes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mp-react/vite_config.js` — o plugin `@vitejs/plugin-react` declarado aqui precisa ser replicado no `vitest.config.js` standalone.
- `mp-react/src/contexts/AuthContext.jsx` — exporta `AuthContext` (o próprio context object) + `useAuth` hook. O `FakeAuthProvider` em `renderWithProviders` vai usar `<AuthContext.Provider value={...}>` diretamente.

### Established Patterns
- Projeto usa `"type": "module"` em `package.json` — Vitest com ESM é compatível nativamente.
- Sem TypeScript — todos os arquivos de teste serão `.js` e `.jsx` (não `.ts`/`.tsx`).
- Sem Prettier — não introduzir regras de formatação na config do Vitest.
- Convenção: 2 espaços de indentação, aspas simples, sem ponto-e-vírgula.

### Integration Points
- `mp-react/package.json` — scripts `test`, `test:watch`, `test:coverage` serão adicionados aqui.
- `mp-react/.env.test` — arquivo novo na raiz de `mp-react/`, paralelo ao `.env` existente.
- `mp-react/src/test-utils/` — diretório novo dentro de `src/`; não criar `__tests__/` na raiz.

</code_context>

<specifics>
## Specific Ideas

- Smoke test pode ser criado em `mp-react/src/test-utils/smoke.test.js` (ou qualquer nome) — apenas precisa existir e passar.
- O arquivo `.env.test` deve ser commitado no repo (contém apenas stubs, não credenciais reais).

</specifics>

<deferred>
## Deferred Ideas

- `@vitest/ui` para interface visual dos testes — conveniência para fases futuras, não necessário agora.
- Configuração de coverage provider (v8 vs istanbul) — relevante quando `test:coverage` for usado seriamente em fase futura.
- CI/CD (GitHub Actions) com `npm test` — explicitamente fora do escopo de v1 (ver REQUIREMENTS.md Out of Scope).
- Watch mode como default do `npm test` — usuário não expressou preferência; deixar como `vitest run` (single-run) para CI-compatibility.

</deferred>
