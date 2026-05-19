import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { MemoryRouter, Route, Routes, Navigate, useLocation } from 'react-router-dom'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import { useAuth } from '../contexts/AuthContext'
import { useEmpresa, _clearCacheForTest } from '../hooks/useEmpresa'

// Padrão C: vi.mock inline com objeto literal.
// Inclui getEmpresaBySlug e getConfigEmpresa necessários para useEmpresa.
vi.mock('../firebase', () => ({
  auth: {},
  db: {},
  onAuthStateChanged: vi.fn((auth, cb) => { cb(null); return () => {} }),
  signOut: vi.fn().mockResolvedValue(undefined),
  doc: vi.fn(() => 'mock-doc-ref'),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  getEmpresaBySlug: vi.fn().mockResolvedValue(null),
  getConfigEmpresa: vi.fn().mockResolvedValue({}),
  SUPERADMIN_EMAIL: 'superadmin@test.com',
  PLANOS: { basico: { limiteOS: 50, preco: 97 }, pro: { limiteOS: -1, preco: 197 } },
}))

import { getEmpresaBySlug, getConfigEmpresa } from '../firebase'

// ── Guards locais — espelham App.jsx após correção AUTH-07 ───────────────────
// RotaAdmin agora verifica estaLogado E empresaId (requisito AUTH-07)
function RotaAdmin({ children }) {
  const { estaLogado, empresaId } = useAuth()
  if (!estaLogado || !empresaId) return <Navigate to='/login' replace />
  return children
}

function RotaSuperAdmin({ children }) {
  const { estaLogado, isSuperAdmin } = useAuth()
  if (!estaLogado)   return <Navigate to='/login'  replace />
  if (!isSuperAdmin) return <Navigate to='/'       replace />
  return children
}

// Componente auxiliar para verificar a rota atual após Navigate
function ExibeRota() {
  const location = useLocation()
  return <div data-testid='rota-atual'>{location.pathname}</div>
}

// ── Testes de RotaAdmin ──────────────────────────────────────────────────────

describe('AUTH-06: RotaAdmin sem autenticacao', () => {
  it('redireciona para /login quando usuario nao esta autenticado', () => {
    renderWithProviders(
      <>
        <RotaAdmin>
          <div data-testid='conteudo'>Protegido</div>
        </RotaAdmin>
        <ExibeRota />
      </>,
      { route: '/slug/admin', authOverrides: { estaLogado: false, empresaId: null } }
    )
    expect(screen.queryByTestId('conteudo')).not.toBeInTheDocument()
    expect(screen.getByTestId('rota-atual').textContent).toBe('/login')
  })
})

describe('AUTH-07: RotaAdmin autenticado mas sem empresaId', () => {
  it('redireciona para /login quando usuario autenticado nao tem empresaId', () => {
    renderWithProviders(
      <>
        <RotaAdmin>
          <div data-testid='conteudo'>Protegido</div>
        </RotaAdmin>
        <ExibeRota />
      </>,
      { route: '/slug/admin', authOverrides: { estaLogado: true, empresaId: null } }
    )
    expect(screen.queryByTestId('conteudo')).not.toBeInTheDocument()
    expect(screen.getByTestId('rota-atual').textContent).toBe('/login')
  })
})

describe('AUTH-08: RotaAdmin com admin valido', () => {
  it('renderiza conteudo quando usuario esta autenticado com empresaId', () => {
    renderWithProviders(
      <RotaAdmin>
        <div data-testid='conteudo'>Protegido</div>
      </RotaAdmin>,
      { authOverrides: { estaLogado: true, empresaId: 'emp-123' } }
    )
    expect(screen.getByTestId('conteudo')).toBeInTheDocument()
  })
})

// ── Testes de RotaSuperAdmin ─────────────────────────────────────────────────

describe('AUTH-09: RotaSuperAdmin bloqueia usuario normal', () => {
  it('redireciona para / quando usuario nao e superadmin', () => {
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
    expect(screen.getByTestId('rota-atual').textContent).toBe('/')
  })
})

describe('AUTH-10: RotaSuperAdmin permite superadmin', () => {
  it('renderiza conteudo para superadmin autenticado', () => {
    renderWithProviders(
      <RotaSuperAdmin>
        <div data-testid='superadmin-content'>SA</div>
      </RotaSuperAdmin>,
      { authOverrides: { estaLogado: true, isSuperAdmin: true } }
    )
    expect(screen.getByTestId('superadmin-content')).toBeInTheDocument()
  })
})

// ── Testes de useEmpresa ─────────────────────────────────────────────────────

// Wrapper que injeta slug na URL via React Router — obrigatório para useParams()
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

// Limpar cache de módulo antes de cada teste para isolamento correto (AUTH-13)
beforeEach(() => {
  _clearCacheForTest()
})

describe('AUTH-11: useEmpresa resolve slug valido', () => {
  it('retorna dados da empresa e config quando slug existe', async () => {
    const empresa = { id: 'emp-123', nome: 'Empresa Teste', slug: 'teste', ativo: true }
    const config  = { telefone: '(11) 9999-9999' }
    getEmpresaBySlug.mockResolvedValue(empresa)
    getConfigEmpresa.mockResolvedValue(config)

    const { result } = renderHook(() => useEmpresa(), { wrapper: criarWrapper('teste') })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.empresa).toEqual(empresa)
    expect(result.current.config).toEqual(config)
    expect(result.current.empresaId).toBe('emp-123')
  })
})

describe('AUTH-12: useEmpresa redireciona slug inexistente', () => {
  it('navega para /empresa-nao-encontrada quando getEmpresaBySlug retorna null', async () => {
    getEmpresaBySlug.mockResolvedValue(null)

    // Wrapper com rota adicional para capturar o redirecionamento
    function WrapperComRota({ children }) {
      return (
        <MemoryRouter initialEntries={['/slug-inexistente']}>
          <Routes>
            <Route path='/:slug' element={children} />
            <Route path='/empresa-nao-encontrada' element={<div data-testid='nao-encontrada'>404</div>} />
          </Routes>
        </MemoryRouter>
      )
    }

    const { result } = renderHook(() => useEmpresa(), { wrapper: WrapperComRota })

    await waitFor(() => {
      expect(screen.getByTestId('nao-encontrada')).toBeInTheDocument()
    })
    expect(getEmpresaBySlug).toHaveBeenCalledWith('slug-inexistente')
  })
})

describe('AUTH-13: useEmpresa usa cache na segunda consulta', () => {
  it('nao chama getEmpresaBySlug novamente para o mesmo slug', async () => {
    const empresa = { id: 'emp-cache', nome: 'Empresa Cache', slug: 'cache-slug', ativo: true }
    getEmpresaBySlug.mockResolvedValue(empresa)
    getConfigEmpresa.mockResolvedValue({})

    // Primeira renderização — popula o cache
    const { result: r1 } = renderHook(() => useEmpresa(), { wrapper: criarWrapper('cache-slug') })
    await waitFor(() => expect(r1.current.loading).toBe(false))

    // Segunda renderização com mesmo slug — deve usar o cache
    const { result: r2 } = renderHook(() => useEmpresa(), { wrapper: criarWrapper('cache-slug') })
    await waitFor(() => expect(r2.current.loading).toBe(false))

    // getEmpresaBySlug deve ter sido chamado exatamente uma vez (na primeira renderização)
    expect(getEmpresaBySlug).toHaveBeenCalledTimes(1)
    expect(r2.current.empresa).toEqual(empresa)
  })
})
