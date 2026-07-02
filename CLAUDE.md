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
- **AdminPage.jsx** foi refatorado (2026-07): é um orquestrador de ~580 linhas; as abas e os modais vivem em `mp-react/src/components/admin/` (NovaOSModal, DetalheOSModal, NovoOrcamentoModal, RevisarOrcamentoModal etc.) e consomem `useAdminContext()`. Testar comportamentos isolados por componente, nunca renderizar o AdminPage inteiro

## Armadilhas críticas

1. `firebase.js` lança erro na avaliação do módulo se `VITE_FIREBASE_*` não existir — criar `.env.test` antes de qualquer teste
2. `onAuthStateChanged` mock deve chamar o callback **sincronamente** E retornar `() => {}`
3. `useEmpresa` tem cache de módulo (`const cache = {}`) — limpar com `_clearCacheForTest()` no `beforeEach`
4. `FakeAuthProvider` deve sempre incluir `loadingAuth: false` — componentes ficam invisíveis com `true`

## Extensão Chrome (assisthub-extension/)

### Status por portal (atualizado 2026-05-10)

| Portal | Domínio | Segurado | Telefone | Seguradora | Endereço+Nº | Data | Horário | Serviço | Nº OS |
|--------|---------|----------|----------|------------|-------------|------|---------|---------|-------|
| Maxpar (novo) | `prestador.maxpar.com` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Maxpar (legado) | `sistemas.maxpar.com.br` | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | ✓ |
| Portal Juvo (Tempo) | `novo-portal-prestador.prd.tempoassist.cloud` | ✓ | — (portal não fornece) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tempo Assist (legado) | `portal.tempoassist.com.br` | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | ✓ |
| Allianz | `portal.allianz.com.br` | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | ✓ |
| Mondial | `vianet.webmondial.com.br` | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| **Mapfre** | app mobile / web | **pendente — planejar** | | | | | | | |

### Arquitetura da extração

- `popup/popup.js` — UI + lógica de extração injetada via `chrome.scripting.executeScript`
- `background/service-worker.js` — recebe dados do popup, chama Cloud Function `criarOSFromExtension`
- Extração roda **no contexto da aba** (função `extrairOSNaPagina` injetada diretamente)
- Três estratégias por portal:
  1. **SELECTORS** — seletores CSS diretos (Tempo legado, Maxpar legado, Allianz)
  2. **LABEL_MAP** — busca por texto de label + sibling (`prestador.maxpar.com`)
  3. **Custom** — lógica dedicada para Mondial e Portal Juvo

### Campos extraídos e mapeamento para Firestore

| Campo extensão | Campo Firestore | Notas |
|----------------|-----------------|-------|
| `nome_segurado` | `nome_segurado` | |
| `tel_segurado` | `tel_segurado` | digits only |
| `seguradora` | `seguradora` | hardcoded por portal |
| `endereco` | `endereco` | rua sem número |
| `numero` | `numero` | número da casa |
| `bairro` | `bairro` | |
| `cidade` | `cidade` | |
| `cep` | `cep` | digits only |
| `tipo_sinistro` | `servico` | mapeado no Cloud Function |
| `descricao` | `descricao` | |
| `numero_os` | `num_assist` | mapeado no Cloud Function |
| `data_chegada` | `data_chegada` | DD/MM/AAAA |
| `hora_chegada` | `hora_chegada` | HH:MM |
| `hora_saida` | `hora_saida` | HH:MM |

### Deploy da extensão

A extensão é carregada manualmente no Edge (`edge://extensions` → modo desenvolvedor → carregar sem compactação). Recarregar após qualquer mudança em `popup.js` ou `background/service-worker.js`.

### Deploy do frontend

**IMPORTANTE:** O projeto Vercel correto é `mp-servi-os` (não `mp-react`).
- URL de produção: `https://mp-servi-os.vercel.app`
- Para deployar: o `.vercel/project.json` deve apontar para `mp-servi-os`
- Se estiver errado, rodar: `npx vercel link --project mp-servi-os --yes` dentro de `mp-react/`

### Armadilhas da extensão

1. **Portal Juvo** — `getLabelVal` só funciona em `span.label`; tipo de serviço vem de `getLabelVal('Nome da cobertura')`, NÃO do regex no card da lista (que pega o card errado)
2. **Maxpar novo** — endereço formato `"RUA X - NUM - BAIRRO - CIDADE"` com split por ` - `; número "0" = S/N, ignorar
3. **`prestador.maxpar.com`** precisava ser adicionado ao mapa de portais no `verificarPortalAtivo()` — sem ele mostrava "portal não suportado"
4. **Cloud Function URL** — Gen 2 tem dois URLs; o legacy `https://us-central1-checklist-53795.cloudfunctions.net/criarOSFromExtension` funciona como proxy e é o que o service-worker usa
5. **Número da casa no modal** — o campo `numero` é salvo no Firestore mas a view do AdminPage só exibia `endereco`; fix em `AdminPage.jsx:2551` combina os dois

### Próximo: Mapfre

Planejar extração para o app/portal da Mapfre. Verificar se é web ou app mobile, qual domínio, e como o DOM é estruturado.

## Comandos úteis

```bash
# Rodar testes (dentro de mp-react/)
npm test
npm run test:watch
npm run test:coverage

# Dev server
npm run dev

# Deploy Firebase rules + Cloud Functions
firebase deploy --only firestore:rules,storage
firebase deploy --only functions

# Deploy frontend (SEMPRE usar mp-servi-os)
cd mp-react/
npx vercel link --project mp-servi-os --yes  # só se necessário relinkar
npx vercel --prod
```
