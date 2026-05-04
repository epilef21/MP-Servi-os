# AssistHub — CLAUDE.md

## Projeto

AssistHub é uma plataforma SaaS multi-tenant para gestão de ordens de serviço de assistência técnica residencial, atendendo prestadores que operam para seguradoras (Mapfre, Tempo, Maxpar, Allianz).

**Milestone atual:** Test Coverage v1 — adicionar cobertura de testes aos fluxos críticos (OS, orçamentos, auth).

**Documentação de planejamento:** `.planning/`

## Stack

- **Frontend:** React 19 + Vite 8 (`mp-react/`)
- **Backend:** Firebase (Firestore, Auth, Storage, Cloud Functions Gen 2)
- **Extension:** Chrome Extension Manifest V3 (`assisthub-extension/`)
- **Testes:** Vitest 4.1.5 + jsdom + React Testing Library 16 + vi.mock()

## Estrutura do monorepo

```
mp-react/          # Web app React (principal)
functions/         # Cloud Functions Node.js
assisthub-extension/ # Extensão Chrome
.planning/         # Documentação GSD
```

## Workflow GSD

Este projeto usa o workflow GSD (Get Shit Done). Siga estas regras:

1. **Antes de começar qualquer fase:** execute `/gsd-plan-phase N`
2. **Para executar os planos:** execute `/gsd-execute-phase N`
3. **Para verificar o trabalho:** execute `/gsd-progress`
4. **Estado atual:** `.planning/STATE.md`
5. **Roadmap:** `.planning/ROADMAP.md`

## Decisões de teste (não reverter)

- **Framework:** Vitest 4.1.5 — compatível com Vite 8, não usar Jest
- **Mock de Firebase:** sempre via `vi.mock('../firebase')` — nunca mockar `firebase/firestore` diretamente
- **clearMocks: true** no vitest.config.js — nunca usar `resetMocks: true` ou `restoreMocks: true`
- **`.env.test`** com stubs de VITE_FIREBASE_* é **obrigatório** — firebase.js lança erro se variáveis faltarem
- **AdminPage.jsx** tem 3264 linhas — testar comportamentos isolados, nunca renderizar o componente inteiro

## Armadilhas críticas

1. `firebase.js` lança erro na avaliação do módulo se `VITE_FIREBASE_*` não existir — criar `.env.test` antes de qualquer teste
2. `onAuthStateChanged` mock deve chamar o callback **sincronamente** E retornar `() => {}`
3. `useEmpresa` tem cache de módulo (`const cache = {}`) — limpar com `_clearCacheForTest()` no `beforeEach`
4. `FakeAuthProvider` deve sempre incluir `loadingAuth: false` — componentes ficam invisíveis com `true`

## Comandos úteis

```bash
# Rodar testes (dentro de mp-react/)
npm test
npm run test:watch
npm run test:coverage

# Dev server
npm run dev

# Deploy Firebase rules
firebase deploy --only firestore:rules,storage

# Deploy Cloud Functions
firebase deploy --only functions
```
