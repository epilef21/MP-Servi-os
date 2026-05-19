# Phase 3: Auth e Roteamento — Research

**Researched:** 2026-05-15
**Domain:** Vitest + React Testing Library — Context providers, route guards, custom hooks with module-level cache
**Confidence:** HIGH

---

## Summary

Phase 3 testa três camadas interdependentes: o `AuthContext` (provider React que encapsula o ciclo de vida do Firebase Auth), os guards de rota `RotaAdmin` e `RotaSuperAdmin` (componentes em App.jsx que lêem o contexto), e o hook `useEmpresa` (hook custom com cache de módulo que acessa o Firestore via URL params).

A descoberta crítica desta fase é que **`_clearCacheForTest` NÃO existe** em `useEmpresa.js`. O cache `const cache = {}` é uma variável de módulo simples sem helper de limpeza exportado. Os testes de `useEmpresa` (AUTH-11..13) precisarão de uma estratégia para isolar o cache entre testes — a solução correta é adicionar `export function _clearCacheForTest() { Object.keys(cache).forEach(k => delete cache[k]) }` ao próprio `useEmpresa.js` como parte do Wave 0.

A segunda descoberta crítica: `AuthContext.jsx` lido ao vivo não usa custom claims de `getIdTokenResult()` para resolver `empresaId` — usa Firestore direto (`getDoc(doc(db, 'empresas', user.uid))`). Isso afeta AUTH-02 e AUTH-03. O `checkSuperAdminClaim` usa `getIdTokenResult()` para a flag de superadmin com claims `role === 'superadmin'` e `superadmin_until`.

A terceira descoberta: `RotaAdmin` (em App.jsx) verifica APENAS `estaLogado` (linha 27) — NÃO verifica `empresaId`. Portanto AUTH-07 (redireciona quando autenticado mas sem empresaId) NÃO é o comportamento atual do guard. O componente renderiza mesmo sem empresaId. AUTH-07 deve ser revisto: ou o teste documenta o comportamento atual (sem redirecionamento) ou o guard precisa ser corrigido durante esta fase.

**Primary recommendation:** Criar dois arquivos de teste: `src/__tests__/authContext.test.jsx` (AUTH-01..05) e `src/__tests__/rotasEmpresa.test.jsx` (AUTH-06..13). Adicionar `_clearCacheForTest` ao `useEmpresa.js` como Wave 0 antes dos testes de AUTH-13.

---

## Project Constraints (from CLAUDE.md)

| Diretriz | Impacto na Phase 3 |
|----------|--------------------|
| Mock Firebase via `vi.mock('../firebase')` — NUNCA mockar `firebase/firestore` diretamente | Todos os testes de AuthContext e useEmpresa devem usar `vi.mock('../firebase')` |
| `clearMocks: true` globalmente — nunca `resetMocks` ou `restoreMocks` | Mocks são auto-limpos entre testes; configurar retornos no `beforeEach` de cada bloco |
| `.env.test` com stubs VITE_FIREBASE_* é obrigatório | Já existe — não remover |
| AdminPage.jsx tem 3264 linhas — testar comportamentos isolados, nunca renderizar o inteiro | Não renderizar AdminPage nos testes desta fase |
| Framework: Vitest 4.1.5 — não Jest | Toda sintaxe: `vi.mock`, `vi.fn`, `describe/it/expect` |
| JavaScript puro — sem TypeScript | Arquivos `.test.js` e `.test.jsx` — nunca `.ts`/`.tsx` |
| Arquivos com JSX devem usar extensão `.jsx` | AuthContext tests têm JSX → `.test.jsx`. Testes puros de hook → `.test.js` ou `.test.jsx` (ambos funcionam com o plugin react do vitest) |
| Estilo: 2 espaços, aspas simples, sem ponto-e-vírgula | Aplicar a todos os arquivos novos |
| `AuthContext` exportado como `export const` | Permite `FakeAuthProvider` usar `AuthContext.Provider` diretamente sem disparar Firebase |
| `FakeAuthProvider` deve incluir `loadingAuth: false` | Componentes ficam invisíveis com `loadingAuth: true` |

---

<phase_requirements>
## Phase Requirements

| ID | Descrição | Suporte da pesquisa |
|----|-----------|----------------------|
| AUTH-01 | AuthContext exibe loading enquanto onAuthStateChanged não respondeu | `loadingAuth` inicia como `true`; quando `true`, o provider renderiza `<div>Carregando...</div>` em vez dos children. Testar: não chamar o callback do `onAuthStateChanged` mock → verificar que o texto "Carregando..." aparece na tela |
| AUTH-02 | AuthContext resolve usuário normal com empresaId via token claims | ATENÇÃO: o código real usa Firestore (não claims) para resolver `empresaId`. Mock `getDoc` para `empresas/{uid}` retornar `exists: true` → verificar que `empresaId === user.uid` |
| AUTH-03 | AuthContext usa fallback Firestore quando claims não têm empresaId | Mock `getDoc(empresas/uid)` retornando `exists: false` e `getDoc(usuarios/uid)` retornando `exists: true, data: { empresaId: 'outro-id' }` → verificar `empresaId === 'outro-id'` |
| AUTH-04 | AuthContext identifica superadmin pelo email SUPERADMIN_EMAIL | Mock `getIdTokenResult` retornando `claims: { role: 'superadmin', superadmin_until: futureTimestamp }` → verificar `isSuperAdmin === true` e `empresaId === null` |
| AUTH-05 | AuthContext limpa estado e redireciona no logout | Chamar `logout()` do contexto → mock `signOut` resolve → verificar que `usuario` e `empresaId` voltam a `null` |
| AUTH-06 | RotaAdmin redireciona para login quando usuário não está autenticado | Renderizar `<RotaAdmin>` via `renderWithProviders` com `authOverrides: { estaLogado: false }` → verificar `Navigate to="/login"` é renderizado |
| AUTH-07 | RotaAdmin redireciona para login quando usuário autenticado mas sem empresaId | DESCOBERTA CRÍTICA: `RotaAdmin` atual verifica APENAS `estaLogado`, não `empresaId`. O guard NÃO redireciona neste caso. O plano deve decidir: (a) corrigir o guard para verificar `empresaId` também, ou (b) documentar que o requisito está incorreto |
| AUTH-08 | RotaAdmin renderiza conteúdo para admin válido autenticado | `authOverrides: { estaLogado: true, empresaId: 'emp-123' }` → verificar que o children é renderizado |
| AUTH-09 | RotaSuperAdmin redireciona usuário normal (não superadmin) para / | `authOverrides: { estaLogado: true, isSuperAdmin: false }` → verificar `Navigate to="/"` |
| AUTH-10 | RotaSuperAdmin renderiza conteúdo para superadmin autenticado | `authOverrides: { estaLogado: true, isSuperAdmin: true }` → verificar que o children é renderizado |
| AUTH-11 | useEmpresa resolve slug e retorna dados da empresa do Firestore | Mock `getEmpresaBySlug` e `getConfigEmpresa` retornando dados válidos → verificar que `empresa` e `config` ficam populados |
| AUTH-12 | useEmpresa redireciona para /empresa-nao-encontrada quando slug não existe | Mock `getEmpresaBySlug` retornando `null` → verificar que `navigate('/empresa-nao-encontrada', { replace: true })` é chamado |
| AUTH-13 | useEmpresa retorna dados do cache sem nova chamada ao Firestore na segunda consulta | Renderizar o hook com mesmo slug duas vezes; na segunda renderização `getEmpresaBySlug` não deve ser chamado novamente |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Estado de autenticação (usuario, empresaId, isSuperAdmin) | Context Provider (AuthContext) | Firebase Auth SDK | Lógica de estado centralizada no provider; SDK é fonte da verdade |
| Proteção de rotas (RotaAdmin, RotaSuperAdmin) | Frontend Router (App.jsx) | AuthContext | Guards lêem o contexto e delegam navegação ao React Router |
| Resolução de empresa por slug | Hook (useEmpresa) | Firebase/Firestore via `getEmpresaBySlug` | Hook encapsula leitura de URL params + Firestore + cache de sessão |
| Cache de sessão por slug | Módulo-level (useEmpresa `const cache`) | — | Cache em memória no módulo — persiste entre re-renders mas reseta no reload |
| Verificação de superadmin | AuthContext (`checkSuperAdminClaim`) | Firebase Auth `getIdTokenResult()` | Claims verificados no token JWT, não no Firestore |

---

## Standard Stack

### Core (já instalado — Phase 1 completa)

| Biblioteca | Versão | Propósito | Nota |
|-----------|--------|-----------|------|
| vitest | ^4.1.5 | Test runner | Locked no CLAUDE.md |
| @testing-library/react | ^16.3.2 | `render`, `screen`, `act`, `waitFor` | Padrão para componentes React |
| @testing-library/user-event | ^14.6.1 | Simulação de interação do usuário | Disponível mas não crítico para esta fase |
| react-router-dom | ^7.14.0 | `MemoryRouter`, `Navigate`, `useParams`, `useNavigate` | Versão 7 — API igual à v6 para uso básico |
| jsdom | ^25.0.1 | Ambiente browser simulado | Configurado no vitest.config.js |

### Nenhuma nova dependência necessária para a Phase 3

Todos os testes desta fase usam infraestrutura já instalada na Phase 1.
[VERIFIED: mp-react/package.json lido diretamente]

---

## Architecture Patterns

### System Architecture Diagram

```
Plan 03-01: Testes do AuthContext
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  src/__tests__/authContext.test.jsx
      │
      │  vi.mock('../firebase')   ← intercepta no boundary do módulo
      ▼
  mockFirebase.js createFirebaseMocks()
  ┌────────────────────────────────────────────────────────────┐
  │ onAuthStateChanged — vi.fn() configurado por teste         │
  │ getDoc — mock para empresas/{uid} e usuarios/{uid}         │
  │ signOut — mock para testar logout                          │
  └────────────────────────────────────────────────────────────┘
      │  callbacks chamados síncronamente (sem act() wrapper)
      ▼
  AuthProvider (renderizado via renderWithProviders ou render direto)
  ┌──────────────────────────────────────────────────────────┐
  │ loadingAuth: true → renderiza "Carregando..."            │
  │ loadingAuth: false, user != null → resolve empresaId     │
  │ loadingAuth: false, user == null → limpa estado          │
  └──────────────────────────────────────────────────────────┘
      │  screen.getByText / screen.queryByText
      ▼
  [assertions RTL]


Plan 03-02: Testes de Guards e useEmpresa
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  src/__tests__/rotasEmpresa.test.jsx
      │
      ├─ Guards (RotaAdmin, RotaSuperAdmin)
      │    renderWithProviders(<RotaAdmin><Filho/></RotaAdmin>, authOverrides)
      │    verifica se Filho aparece ou se Navigate é renderizado
      │
      └─ useEmpresa (hook com cache de módulo)
           vi.mock('../firebase')
           _clearCacheForTest() no beforeEach
           renderHook(() => useEmpresa(), { wrapper: MemoryRouterWithSlug })
           waitFor(() => expect(result.current.empresa).not.toBeNull())
```

### Recommended Project Structure

```
mp-react/src/
├── hooks/
│   └── useEmpresa.js        ← MODIFICAR: adicionar export _clearCacheForTest()
├── __tests__/               (existente desde Phase 2)
│   ├── formatters.test.js   (existente)
│   ├── firebase.test.js     (existente)
│   ├── authContext.test.jsx  ← NOVO (Plan 03-01)
│   └── rotasEmpresa.test.jsx ← NOVO (Plan 03-02)
└── test-utils/              (existente)
    ├── setupTests.js
    ├── mockFirebase.js
    ├── renderWithProviders.jsx
    └── smoke.test.jsx
```

### Pattern 1: Testar AuthContext com onAuthStateChanged mock

**O que:** Renderizar `AuthProvider` diretamente (não via `renderWithProviders` que usa `FakeAuthProvider`) para testar a lógica real do provider.
**Quando usar:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05 — testam o provider real, não uma versão fake.

```jsx
// Source: [VERIFIED: AuthContext.jsx lido diretamente; mockFirebase.js lido diretamente]
// File: src/__tests__/authContext.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import { createFirebaseMocks } from '../test-utils/mockFirebase'

let mocks

vi.mock('../firebase', () => mocks)

beforeEach(() => {
  mocks = createFirebaseMocks()
})

// Componente auxiliar para expor o contexto nos testes
function ExporContexto() {
  const ctx = useAuth()
  return (
    <div>
      <span data-testid='loading'>{String(ctx.loadingAuth)}</span>
      <span data-testid='empresaId'>{ctx.empresaId ?? 'null'}</span>
      <span data-testid='superadmin'>{String(ctx.isSuperAdmin)}</span>
    </div>
  )
}

function renderProvider() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ExporContexto />
      </AuthProvider>
    </MemoryRouter>
  )
}
```

**AUTH-01 — Estado de loading enquanto onAuthStateChanged não responde:**

```jsx
// Source: [VERIFIED: AuthContext.jsx linhas 134-148 — loadingAuth: true renderiza "Carregando..."]
it('exibe Carregando enquanto onAuthStateChanged nao respondeu', () => {
  // Mock NÃO chama o callback — simula pending state
  mocks.onAuthStateChanged = vi.fn(() => () => {})
  const { container } = renderProvider()
  // O provider renderiza o div "Carregando..." em vez dos children
  expect(container.textContent).toContain('Carregando')
})
```

**AUTH-02 — Usuário normal com empresaId via Firestore (empresas/{uid}):**

```jsx
// Source: [VERIFIED: AuthContext.jsx linhas 57-63 — getDoc(doc(db, 'empresas', user.uid))]
it('resolve empresaId quando empresa existe em empresas/{uid}', async () => {
  const fakeUser = {
    uid: 'user-123',
    email: 'admin@teste.com',
    getIdTokenResult: vi.fn().mockResolvedValue({ claims: {} }),
  }
  mocks.onAuthStateChanged = vi.fn((auth, cb) => { cb(fakeUser); return () => {} })
  // getDoc para empresas/user-123 retorna exists: true
  mocks.getDoc = vi.fn().mockResolvedValueOnce({ exists: () => true })

  renderProvider()
  await waitFor(() => {
    expect(screen.getByTestId('empresaId').textContent).toBe('user-123')
  })
})
```

**AUTH-03 — Fallback para usuarios/{uid}:**

```jsx
// Source: [VERIFIED: AuthContext.jsx linhas 63-70]
it('usa fallback usuarios/{uid} quando empresa nao existe', async () => {
  const fakeUser = {
    uid: 'user-456',
    email: 'admin@teste.com',
    getIdTokenResult: vi.fn().mockResolvedValue({ claims: {} }),
  }
  mocks.onAuthStateChanged = vi.fn((auth, cb) => { cb(fakeUser); return () => {} })
  // Primeira chamada getDoc (empresas/uid) retorna exists: false
  // Segunda chamada getDoc (usuarios/uid) retorna exists: true com empresaId
  mocks.getDoc = vi.fn()
    .mockResolvedValueOnce({ exists: () => false })
    .mockResolvedValueOnce({ exists: () => true, data: () => ({ empresaId: 'emp-xyz' }) })

  renderProvider()
  await waitFor(() => {
    expect(screen.getByTestId('empresaId').textContent).toBe('emp-xyz')
  })
})
```

**AUTH-04 — Superadmin via claims:**

```jsx
// Source: [VERIFIED: AuthContext.jsx linhas 29-41 — checkSuperAdminClaim]
it('identifica superadmin via claims role e superadmin_until', async () => {
  const futureTs = Math.floor(Date.now() / 1000) + 3600 // 1 hora no futuro
  const fakeUser = {
    uid: 'super-001',
    email: 'superadmin@test.com',
    getIdTokenResult: vi.fn().mockResolvedValue({
      claims: { role: 'superadmin', superadmin_until: futureTs }
    }),
  }
  mocks.onAuthStateChanged = vi.fn((auth, cb) => { cb(fakeUser); return () => {} })

  renderProvider()
  await waitFor(() => {
    expect(screen.getByTestId('superadmin').textContent).toBe('true')
    expect(screen.getByTestId('empresaId').textContent).toBe('null')
  })
})
```

**AUTH-05 — Logout limpa o estado:**

```jsx
// Source: [VERIFIED: AuthContext.jsx linhas 77-83 — setUsuario(null), setEmpresaId(null)]
// NOTA: logout() chama signOut(auth) que dispara onAuthStateChanged com user=null
it('limpa estado apos logout', async () => {
  let authCallback
  mocks.onAuthStateChanged = vi.fn((auth, cb) => { authCallback = cb; return () => {} })
  mocks.signOut = vi.fn().mockImplementation(async () => {
    // Simular que signOut dispara onAuthStateChanged com null
    authCallback(null)
  })

  // Começar logado
  // ... setup inicial com user
  // Chamar logout via userEvent ou act()
  // Verificar que usuario e empresaId ficam null
})
```

### Pattern 2: Testar Guards de Rota (RotaAdmin, RotaSuperAdmin)

**O que:** Renderizar o guard como parte do App, usando `renderWithProviders` com `authOverrides`.
**Quando usar:** AUTH-06, AUTH-07, AUTH-08, AUTH-09, AUTH-10.
**Ponto crítico:** `RotaAdmin` e `RotaSuperAdmin` estão definidos DENTRO de App.jsx e não são exportados. Para testá-los, é necessário extraí-los ou testar via renderização do App completo.

**Opção A (recomendada): Extrair os guards para arquivo próprio**

```jsx
// NOVO: src/components/guards.jsx
export function RotaAdmin({ children }) {
  const { estaLogado } = useAuth()
  if (!estaLogado) return <Navigate to='/login' replace />
  return children
}

export function RotaSuperAdmin({ children }) {
  const { estaLogado, isSuperAdmin } = useAuth()
  if (!estaLogado)   return <Navigate to='/login' replace />
  if (!isSuperAdmin) return <Navigate to='/'     replace />
  return children
}
```

**Opção B: Copiar a lógica do guard no arquivo de teste (sem modificar App.jsx)**

```jsx
// Source: [VERIFIED: App.jsx linhas 25-37]
// src/__tests__/rotasEmpresa.test.jsx

// Reimplementação local para teste — replica exatamente o que está em App.jsx
function RotaAdmin({ children }) {
  const { estaLogado } = useAuth()
  if (!estaLogado) return <Navigate to='/login' replace />
  return children
}

function RotaSuperAdmin({ children }) {
  const { estaLogado, isSuperAdmin } = useAuth()
  if (!estaLogado)   return <Navigate to='/login'  replace />
  if (!isSuperAdmin) return <Navigate to='/'       replace />
  return children
}
```

**Pattern de teste para o guard:**

```jsx
// AUTH-06: Redireciona para login sem autenticação
it('RotaAdmin redireciona para /login quando nao autenticado', () => {
  const { container } = renderWithProviders(
    <RotaAdmin>
      <div data-testid='conteudo-protegido'>Conteúdo</div>
    </RotaAdmin>,
    { authOverrides: { estaLogado: false } }
  )
  // O children não aparece; Navigate renderiza (rota muda)
  expect(screen.queryByTestId('conteudo-protegido')).not.toBeInTheDocument()
})

// AUTH-08: Renderiza conteúdo para admin válido
it('RotaAdmin renderiza conteudo para usuario autenticado', () => {
  renderWithProviders(
    <RotaAdmin>
      <div data-testid='conteudo-protegido'>Conteúdo</div>
    </RotaAdmin>,
    { authOverrides: { estaLogado: true, empresaId: 'emp-123' } }
  )
  expect(screen.getByTestId('conteudo-protegido')).toBeInTheDocument()
})
```

**Como verificar redirecionamento com MemoryRouter:**

```jsx
// Source: [ASSUMED — padrão RTL+MemoryRouter] — verificar rota após Navigate
import { useLocation } from 'react-router-dom'

function ExibeRota() {
  const location = useLocation()
  return <div data-testid='rota-atual'>{location.pathname}</div>
}

it('RotaSuperAdmin redireciona usuario normal para /', () => {
  renderWithProviders(
    <>
      <RotaSuperAdmin>
        <div data-testid='superadmin-content'>SA</div>
      </RotaSuperAdmin>
      <ExibeRota />
    </>,
    { route: '/superadmin', authOverrides: { estaLogado: true, isSuperAdmin: false } }
  )
  expect(screen.queryByTestId('superadmin-content')).not.toBeInTheDocument()
  // OU: verificar que ExibeRota mostra '/'
  expect(screen.getByTestId('rota-atual').textContent).toBe('/')
})
```

### Pattern 3: Testar useEmpresa com renderHook

**O que:** `renderHook` do RTL renderiza um hook em isolamento sem criar um componente wrapper.
**Quando usar:** AUTH-11, AUTH-12, AUTH-13.
**Requisito:** `useEmpresa` usa `useParams` e `useNavigate` do React Router — precisa de um `MemoryRouter` como wrapper.

```jsx
// Source: [VERIFIED: useEmpresa.js lido diretamente]
// src/__tests__/rotasEmpresa.test.jsx

import { renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useEmpresa, _clearCacheForTest } from '../hooks/useEmpresa'

let mocks
vi.mock('../firebase', () => mocks)

beforeEach(() => {
  mocks = createFirebaseMocks()
  _clearCacheForTest() // Limpar cache do módulo entre testes
})

// Wrapper que injeta slug na URL via React Router
function criarWrapper(slug) {
  return function Wrapper({ children }) {
    return (
      <MemoryRouter initialEntries={[`/${slug}`]}>
        <Routes>
          <Route path='/:slug' element={children} />
        </Routes>
      </MemoryRouter>
    )
  }
}

// AUTH-11: Slug válido retorna dados da empresa
it('resolve slug e retorna dados da empresa', async () => {
  const empresa = { id: 'emp-123', nome: 'Empresa Teste', slug: 'teste', ativo: true }
  const config = { telefone: '(11) 9999-9999' }
  mocks.getEmpresaBySlug = vi.fn().mockResolvedValue(empresa)
  mocks.getConfigEmpresa = vi.fn().mockResolvedValue(config)

  const { result } = renderHook(() => useEmpresa(), { wrapper: criarWrapper('teste') })

  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.empresa).toEqual(empresa)
  expect(result.current.config).toEqual(config)
  expect(result.current.empresaId).toBe('emp-123')
})

// AUTH-12: Slug inexistente chama navigate
it('navega para /empresa-nao-encontrada quando slug nao existe', async () => {
  mocks.getEmpresaBySlug = vi.fn().mockResolvedValue(null)
  const navigateMock = vi.fn()
  // useNavigate precisa ser mockado via vi.mock('../../../node_modules/react-router-dom')
  // OU verificar side effects da navegação no MemoryRouter
  // ... (ver seção de pitfalls para a abordagem correta)
})

// AUTH-13: Cache evita segunda chamada ao Firestore
it('retorna cache sem nova chamada ao Firestore na segunda consulta', async () => {
  const empresa = { id: 'emp-123', nome: 'Empresa Teste', slug: 'cache-slug', ativo: true }
  mocks.getEmpresaBySlug = vi.fn().mockResolvedValue(empresa)
  mocks.getConfigEmpresa = vi.fn().mockResolvedValue({})

  // Primeira renderização — popula o cache
  const { result: r1 } = renderHook(() => useEmpresa(), { wrapper: criarWrapper('cache-slug') })
  await waitFor(() => expect(r1.current.loading).toBe(false))

  // Segunda renderização com mesmo slug — deve usar cache
  const { result: r2 } = renderHook(() => useEmpresa(), { wrapper: criarWrapper('cache-slug') })
  await waitFor(() => expect(r2.current.loading).toBe(false))

  // getEmpresaBySlug deve ter sido chamado apenas uma vez
  expect(mocks.getEmpresaBySlug).toHaveBeenCalledTimes(1)
})
```

### Anti-Patterns a Evitar

- **Usar `FakeAuthProvider` para testar o AuthProvider real:** `renderWithProviders` injeta um `FakeAuthProvider` que substitui o AuthContext real — para testar a lógica do `AuthProvider`, renderizá-lo diretamente sem o wrapper de teste.
- **Chamar callback de onAuthStateChanged fora de `act()`:** Quando o callback é chamado após a renderização inicial (ex: simulando delay), é necessário envolver em `act()`. O mock síncrono do `createFirebaseMocks` evita este problema ao chamar o callback imediatamente.
- **Esquecer de limpar o cache do useEmpresa:** O `const cache = {}` em `useEmpresa.js` persiste entre testes no mesmo arquivo. Sem limpeza, um teste de "cache hit" passa mesmo quando não deveria porque outro teste o populou antes.
- **Mockar `useNavigate` diretamente:** Em vez de mockar o hook interno, verificar o efeito da navegação no `MemoryRouter` (a rota muda) usando um componente auxiliar `ExibeRota`.
- **Passar `authOverrides` incompleto:** `renderWithProviders` faz spread sobre `DEFAULT_AUTH` — só precisar passar o que diverge do padrão. Mas sempre incluir `loadingAuth: false` (já está no `DEFAULT_AUTH`).
- **Testar `RotaAdmin` esperando verificação de empresaId:** O guard atual verifica APENAS `estaLogado`. AUTH-07 exige decisão antes de implementar o teste.

---

## Don't Hand-Roll

| Problema | Não construir | Usar em vez disso | Por quê |
|----------|---------------|-------------------|---------|
| Ambiente do hook | Custom mock de useParams/useNavigate | `MemoryRouter` com `<Route path='/:slug'>` como wrapper | React Router disponibiliza os hooks via contexto — wrapper é a forma correta |
| Simulação de delay no Auth | `setTimeout` ou `sleep` nos testes | Mock síncrono: `cb(null)` sem delay | Testes assíncronos com timers reais são lentos e frágeis |
| Cache cleanup entre testes | Reimplementar a lógica do cache no arquivo de teste | Exportar `_clearCacheForTest()` de `useEmpresa.js` | Única forma confiável de limpar o estado de módulo entre testes |
| Verificação de redirecionamento | Mockar `window.location` ou `history` | Componente `ExibeRota` + `MemoryRouter` | MemoryRouter gerencia o histórico; `useLocation` lê o pathname atual |

**Key insight:** O maior risco nesta fase é a contaminação de estado entre testes — o cache de módulo do useEmpresa e o estado do Firebase Auth mock podem vazar entre `it()` se não forem limpos no `beforeEach`. Use `_clearCacheForTest()` e confie no `clearMocks: true` do vitest para os vi.fn().

---

## Descobertas Críticas

### Descoberta 1: RotaAdmin não verifica empresaId

[VERIFIED: App.jsx linhas 25-29]

```jsx
function RotaAdmin({ children }) {
  const { estaLogado } = useAuth()
  if (!estaLogado) return <Navigate to='/login' replace />
  return children
}
```

O guard verifica APENAS `estaLogado`. Um usuário autenticado sem `empresaId` passa pelo guard e vê o conteúdo do `AdminPage`. AUTH-07 ("redireciona para login quando autenticado mas sem empresaId") descreve um comportamento que **não existe atualmente**.

**Opções para o plano:**
1. **Corrigir o guard durante Phase 3** — adicionar verificação de `empresaId`. Isso é uma mudança no código de produção além dos testes.
2. **Documentar o comportamento atual e não testar AUTH-07** — o teste descreveria um comportamento que não existe.
3. **Testar o comportamento real** — AUTH-07 documenta que um usuário sem empresaId *consegue acessar* o guard (behavior test, não requirement test).

**Recomendação:** Corrigir o guard para incluir `!empresaId` como condição de redirecionamento. Esta é uma correção de segurança pequena e óbvia, não uma refatoração.

### Descoberta 2: AuthContext usa Firestore para empresaId, não token claims

[VERIFIED: AuthContext.jsx linhas 47-83]

O `empresaId` é resolvido via dois `getDoc()` Firestore (empresas/{uid} → fallback usuarios/{uid}), não via `user.getIdTokenResult().claims`. Os claims são usados APENAS para a flag de superadmin. A descrição de AUTH-02 ("via token claims") está imprecisa — o comportamento real usa Firestore.

O que realmente acontece para AUTH-02:
- `getDoc(doc(db, 'empresas', user.uid))` é chamado primeiro
- Se `snapEmpresa.exists()` é true → `setEmpresaId(user.uid)`

O que acontece para AUTH-03:
- Se empresas/{uid} não existe → `getDoc(doc(db, 'usuarios', user.uid))`
- Se `snapUsuario.exists()` → `setEmpresaId(snapUsuario.data().empresaId ?? null)`

### Descoberta 3: _clearCacheForTest não existe em useEmpresa.js

[VERIFIED: useEmpresa.js lido integralmente — grep por _clearCacheForTest retornou zero resultados]

O `const cache = {}` é uma variável de módulo não exportada. Para os testes de AUTH-13 funcionarem (cache hit), é necessário adicionar ao `useEmpresa.js`:

```js
// Adicionar ao final de useEmpresa.js — apenas para uso em testes
export function _clearCacheForTest() {
  Object.keys(cache).forEach(k => delete cache[k])
}
```

Esta é uma modificação de código de produção (mínima, não-breaking, equivalente a um test helper) que deve fazer parte do Wave 0 do Plan 03-02.

### Descoberta 4: getConfigEmpresa precisa ser mockada no useEmpresa

[VERIFIED: useEmpresa.js linhas 52-55]

`useEmpresa` importa `getConfigEmpresa` de `'../firebase'`. O mock `createFirebaseMocks()` atual NÃO inclui `getConfigEmpresa`. O mock do módulo `../firebase` precisará incluir esta função.

```js
// Adicionar ao createFirebaseMocks() em mockFirebase.js — ou incluir no vi.mock inline
getConfigEmpresa: vi.fn().mockResolvedValue({}),
getEmpresaBySlug: vi.fn().mockResolvedValue(null), // já está, mas nome correto
```

**Verificar:** `createFirebaseMocks()` inclui `PLANOS` e `getEmpresaBySlug` — mas não `getConfigEmpresa`. O vi.mock local do arquivo de teste pode adicionar o que faltar.

---

## Common Pitfalls

### Pitfall 1: onAuthStateChanged fora de act()

**O que acontece:** Warning "Warning: An update to AuthProvider inside a test was not wrapped in act(...)" no console; o teste passa mas com warnings que podem se tornar erros em versões futuras.
**Por que acontece:** `onAuthStateChanged` chama o callback que faz `setState` — se o callback é chamado de forma assíncrona (ex: `setTimeout`), o React não sabe que a atualização veio de um evento de teste.
**Como evitar:** Usar o mock síncrono do `createFirebaseMocks()` que chama `cb(null)` imediatamente. Para cenários com usuário logado, chamar `cb(fakeUser)` também síncronamente. Se precisar de comportamento assíncrono, envolver em `act(async () => { ... })`.
**Sinais de alerta:** Console mostra "not wrapped in act()" durante os testes.

### Pitfall 2: Cache do useEmpresa vazando entre testes

**O que acontece:** O teste AUTH-13 (cache hit) passa mesmo quando `getEmpresaBySlug` é chamado múltiplas vezes porque um teste anterior já populou o cache com o mesmo slug.
**Por que acontece:** `const cache = {}` é avaliado uma vez por sessão de teste — Vitest roda todos os testes do arquivo no mesmo processo, então o estado do módulo persiste entre `it()`.
**Como evitar:** Chamar `_clearCacheForTest()` no `beforeEach` de TODOS os testes de useEmpresa, não apenas do AUTH-13.
**Sinais de alerta:** AUTH-13 passa mesmo quando você comenta o `_clearCacheForTest()` — sinal de que o cache não foi populado no momento esperado.

### Pitfall 3: vi.mock com factory function assíncrona

**O que acontece:** `vi.mock('../firebase', () => mocks)` falha quando `mocks` é definido no `beforeEach` (depois que vi.mock é hoistado).
**Por que acontece:** `vi.mock` é hoistado para o topo do arquivo pelo Vitest — a factory é chamada antes do `beforeEach`. A variável `mocks` está `undefined` no momento em que a factory executa.
**Como evitar:** A factory deve referenciar `mocks` via closure E `mocks` deve ser inicializado antes da factory ser invocada. A solução mais robusta é usar `vi.mock` com um objeto fixo E depois sobrescrever via `vi.spyOn` ou configurar os retornos via `mockImplementation` no `beforeEach`.

**Padrão correto (verificado na firebase.test.js existente):**

```js
// Padrão A: Declarar mocks fora e inicializar no beforeEach
// Funciona porque vi.mock factory captura a referência da variável, não o valor
let mocks
vi.mock('../firebase', () => mocks)  // mocks será undefined aqui — PROBLEMA

// Padrão B (correto): vi.mock retorna objeto com getters dinâmicos
let mocks = {}
vi.mock('../firebase', async () => {
  const actual = await vi.importActual('../firebase')
  return {
    ...actual,
    // retornar mocks dinâmicos via getter
    get onAuthStateChanged() { return mocks.onAuthStateChanged },
    get getDoc() { return mocks.getDoc },
    // ...
  }
})
beforeEach(() => { mocks = createFirebaseMocks() })

// Padrão C (mais simples — usado nos testes existentes):
// Definir vi.mock com vi.fn() inline e reconfigurar no beforeEach
import { onAuthStateChanged, getDoc } from '../firebase'
vi.mock('../firebase', () => ({
  auth: {},
  db: {},
  onAuthStateChanged: vi.fn((auth, cb) => { cb(null); return () => {} }),
  getDoc: vi.fn(),
  signOut: vi.fn(),
  getConfigEmpresa: vi.fn().mockResolvedValue({}),
  getEmpresaBySlug: vi.fn().mockResolvedValue(null),
  doc: vi.fn(() => 'mock-doc-ref'),
  SUPERADMIN_EMAIL: 'superadmin@test.com',
  PLANOS: { basico: { limiteOS: 50, preco: 97 }, pro: { limiteOS: -1, preco: 197 } },
}))

// Depois no beforeEach — como clearMocks: true limpa call counts mas NÃO mockResolvedValue,
// reconfigurar implementações que mudam por teste:
beforeEach(() => {
  onAuthStateChanged.mockImplementation((auth, cb) => { cb(null); return () => {} })
})
```

**Padrão C é o recomendado** — consistente com o `firebase.test.js` existente (que também usa vi.mock inline).

### Pitfall 4: renderHook precisa do wrapper correto para useEmpresa

**O que acontece:** `Error: useParams() may be used only in the context of a <Router> component`
**Por que acontece:** `useEmpresa` chama `useParams()` e `useNavigate()` — ambos requerem React Router context.
**Como evitar:** Sempre passar um `wrapper` com `MemoryRouter + <Route path="/:slug">` para `renderHook`.
**Sinais de alerta:** "useParams() may be used only in the context of a <Router>" no output do teste.

### Pitfall 5: getDoc mock com shape errada para AuthContext

**O que acontece:** `snap.exists is not a function` ao testar AUTH-02/AUTH-03.
**Por que acontece:** AuthContext chama `snapEmpresa.exists()` — é uma função, não uma propriedade.
**Como evitar:** Mockar como `{ exists: () => true, data: () => ({}) }` — nunca `{ exists: true }`.
**Sinais de alerta:** TypeError "snap.exists is not a function" nos testes de AuthContext.

---

## Análise por Requisito

### AUTH-01 — Loading state
**Arquivo:** `src/__tests__/authContext.test.jsx`
**Abordagem:** Mock `onAuthStateChanged` para NÃO chamar o callback (`vi.fn(() => () => {})`). Renderizar `AuthProvider` com um children qualquer. Verificar que o texto "Carregando..." está presente no DOM (AuthContext.jsx linha 145).
**Complexity:** BAIXA — comportamento determinístico.

### AUTH-02 — Resolução de empresaId via Firestore (empresas/{uid})
**Arquivo:** `src/__tests__/authContext.test.jsx`
**Abordagem:** Mock `onAuthStateChanged` chamando `cb(fakeUser)` síncronamente. Mock `getDoc` retornando `{ exists: () => true }` para a primeira chamada. Verificar via `waitFor` que `empresaId === user.uid`.
**Atenção:** O requisito diz "via token claims" mas o código real usa Firestore. Testar o comportamento real.

### AUTH-03 — Fallback para usuarios/{uid}
**Arquivo:** `src/__tests__/authContext.test.jsx`
**Abordagem:** `getDoc` mockado com `mockResolvedValueOnce` para dois retornos: primeiro `{ exists: () => false }`, segundo `{ exists: () => true, data: () => ({ empresaId: 'outro-id' }) }`.

### AUTH-04 — Superadmin via claims
**Arquivo:** `src/__tests__/authContext.test.jsx`
**Abordagem:** `fakeUser.getIdTokenResult` retorna `{ claims: { role: 'superadmin', superadmin_until: futureTimestamp } }`. Verificar `isSuperAdmin === true` e `empresaId === null`.

### AUTH-05 — Logout
**Arquivo:** `src/__tests__/authContext.test.jsx`
**Abordagem:** Renderizar AuthProvider com usuário logado, chamar `logout()` do contexto, verificar que estado volta ao inicial. `signOut` mockado para resolver sem erro.

### AUTH-06 — RotaAdmin sem auth
**Arquivo:** `src/__tests__/rotasEmpresa.test.jsx`
**Abordagem:** `renderWithProviders(<RotaAdmin>...<RotaAdmin>, { authOverrides: { estaLogado: false } })`. Verificar que o children não está no DOM.

### AUTH-07 — RotaAdmin sem empresaId
**Arquivo:** `src/__tests__/rotasEmpresa.test.jsx`
**DECISÃO NECESSÁRIA:** O guard atual não verifica `empresaId`. Opções:
- Corrigir o guard (adiciona `!empresaId` ao if) e então testar o comportamento corrigido
- Documentar que o teste verifica que o requisito NÃO está implementado (test para futura correção)

### AUTH-08 — RotaAdmin com admin válido
**Arquivo:** `src/__tests__/rotasEmpresa.test.jsx`
**Abordagem:** `authOverrides: { estaLogado: true, empresaId: 'emp-123' }`. Verificar que children aparece.

### AUTH-09 — RotaSuperAdmin bloqueia usuário normal
**Arquivo:** `src/__tests__/rotasEmpresa.test.jsx`
**Abordagem:** `authOverrides: { estaLogado: true, isSuperAdmin: false }`. Verificar que children não aparece.

### AUTH-10 — RotaSuperAdmin permite superadmin
**Arquivo:** `src/__tests__/rotasEmpresa.test.jsx`
**Abordagem:** `authOverrides: { estaLogado: true, isSuperAdmin: true }`. Verificar que children aparece.

### AUTH-11 — useEmpresa resolve slug válido
**Arquivo:** `src/__tests__/rotasEmpresa.test.jsx`
**Abordagem:** `renderHook` com wrapper `MemoryRouter + Route`. Mock `getEmpresaBySlug` retornando empresa. Mock `getConfigEmpresa` retornando config. `waitFor` loading === false. Verificar empresa e config.

### AUTH-12 — useEmpresa redireciona slug inexistente
**Arquivo:** `src/__tests__/rotasEmpresa.test.jsx`
**Abordagem:** Mock `getEmpresaBySlug` retornando `null`. Verificar redirecionamento via MemoryRouter (componente auxiliar lê `location.pathname`).

### AUTH-13 — useEmpresa usa cache
**Arquivo:** `src/__tests__/rotasEmpresa.test.jsx`
**Abordagem:** Duas chamadas de `renderHook` com mesmo slug. Verificar que `getEmpresaBySlug` foi chamado exatamente uma vez. **Requer `_clearCacheForTest()` no beforeEach.**

---

## Assumptions Log

| # | Claim | Seção | Risco se errado |
|---|-------|-------|-----------------|
| A1 | O padrão C (vi.mock inline) para mockar '../firebase' é a abordagem correta para os testes do AuthContext | Pattern 3 / Pitfall 3 | Se o hoisting do vi.mock causar problemas com variáveis mutáveis, precisará ajustar para usar getters dinâmicos |
| A2 | Adicionar `_clearCacheForTest()` ao useEmpresa.js é aceitável como modificação de código de produção para suporte a testes | Descoberta 3 | Se houver restrição contra adicionar código de teste em arquivos de produção, alternativa é usar `vi.mock` para substituir o módulo inteiro |
| A3 | AUTH-07 deve ser resolvido corrigindo o guard (adicionando verificação de empresaId) em vez de apenas documentar o gap | Descoberta 1 | Se o usuário quiser que o guard permita acesso sem empresaId (comportamento intencional), AUTH-07 não faz sentido como requisito |
| A4 | `renderHook` do RTL 16 suporta `wrapper` com MemoryRouter + Routes aninhados | Pattern 3 | Se o MemoryRouter/Routes não funcionar como wrapper de renderHook, alternativa é criar um componente wrapper customizado |

---

## Open Questions

1. **AUTH-07: Comportamento do guard ou requisito incorreto?**
   - O que sabemos: `RotaAdmin` verifica APENAS `estaLogado`, não `empresaId`.
   - O que está unclear: O requisito é uma correção intencionada de segurança ou um erro na especificação?
   - Recomendação: Corrigir o guard durante Phase 3 (adicionar `!empresaId` ao if). Pequena correção de segurança.

2. **AUTH-02: Descrição do requisito vs. comportamento real**
   - O que sabemos: AuthContext usa Firestore, não claims, para `empresaId`.
   - O que está unclear: Deve-se corrigir a descrição do requisito ou testar o comportamento real documentando a discrepância?
   - Recomendação: Testar o comportamento real; documentar no arquivo de teste que a resolução é via Firestore (não claims diretas).

3. **getConfigEmpresa no mock**
   - O que sabemos: `createFirebaseMocks()` não inclui `getConfigEmpresa`.
   - O que está unclear: Deve-se atualizar `mockFirebase.js` ou usar vi.mock inline nos testes de useEmpresa?
   - Recomendação: Adicionar `getConfigEmpresa: vi.fn()` ao `createFirebaseMocks()` para manter o factory completo.

---

## Environment Availability

| Dependência | Required By | Disponível | Versão | Fallback |
|-------------|------------|------------|--------|----------|
| vitest | Test runner | Sim | ^4.1.5 | — |
| @testing-library/react | render, renderHook, waitFor | Sim | ^16.3.2 | — |
| @testing-library/jest-dom | DOM matchers | Sim | ^6.9.1 | — |
| react-router-dom | MemoryRouter, renderHook wrapper | Sim | ^7.14.0 | — |
| node.js | Execução dos testes | Sim | ambiente atual | — |

[VERIFIED: mp-react/package.json lido diretamente]

Nenhuma dependência nova necessária para Phase 3.

---

## Security Domain

Nenhuma superfície de segurança nova é introduzida na Phase 3. Esta fase adiciona exclusivamente arquivos de teste e uma modificação mínima em `useEmpresa.js` (`_clearCacheForTest`).

A correção do `RotaAdmin` (adicionar verificação de `empresaId` se AUTH-07 for implementado) é uma melhoria de segurança no código de produção — pequena, mas relevante para acesso não autorizado ao AdminPage.

---

## Sources

### Primary (HIGH confidence)

- `mp-react/src/contexts/AuthContext.jsx` — lido diretamente; todo fluxo de auth verificado linha a linha
- `mp-react/src/App.jsx` — lido diretamente; guards RotaAdmin e RotaSuperAdmin verificados
- `mp-react/src/hooks/useEmpresa.js` — lido diretamente; cache e fluxo de resolução verificados
- `mp-react/src/test-utils/renderWithProviders.jsx` — lido diretamente; FakeAuthProvider e DEFAULT_AUTH verificados
- `mp-react/src/test-utils/mockFirebase.js` — lido diretamente; exports do createFirebaseMocks() verificados
- `mp-react/vitest.config.js` — lido diretamente; clearMocks: true, jsdom, globals confirmados
- `mp-react/.env.test` — lido diretamente; todos os stubs presentes
- `mp-react/src/__tests__/firebase.test.js` — lido diretamente; padrão de vi.mock inline estabelecido

### Secondary (MEDIUM confidence)

- `mp-react/src/__tests__/formatters.test.js` — lido diretamente; padrão de teste de Phase 2 confirmado
- Padrão renderHook com MemoryRouter wrapper — [ASSUMED] baseado em knowledge de treinamento sobre RTL 16; consistente com a API documentada do @testing-library/react

---

## Metadata

**Confidence breakdown:**
- AuthContext flow (AUTH-01..05): HIGH — lido diretamente linha a linha
- Guards RotaAdmin/RotaSuperAdmin (AUTH-06..10): HIGH — verificados em App.jsx
- useEmpresa cache e fluxo (AUTH-11..13): HIGH — lido diretamente; ausência de _clearCacheForTest verificada por grep
- Mock patterns para vi.mock inline: HIGH — padrão já estabelecido em firebase.test.js
- renderHook wrapper pattern: MEDIUM — baseado em training knowledge + consistente com RTL 16 API

**Research date:** 2026-05-15
**Valid until:** 2026-06-15 (codebase estável — AuthContext e guards raramente mudam)
