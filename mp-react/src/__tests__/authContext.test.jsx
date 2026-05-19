import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider, useAuth } from '../contexts/AuthContext'

// Padrão C: vi.mock inline com objeto literal.
// onAuthStateChanged padrão chama cb(null) síncronamente — simula usuário deslogado.
// Cada teste sobrescreve via .mockImplementation() no próprio it ou no beforeEach.
vi.mock('../firebase', () => ({
  auth: {},
  db: {},
  onAuthStateChanged: vi.fn((auth, cb) => { cb(null); return () => {} }),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
  doc: vi.fn(() => 'mock-doc-ref'),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  SUPERADMIN_EMAIL: 'superadmin@test.com',
  PLANOS: { basico: { limiteOS: 50, preco: 97 }, pro: { limiteOS: -1, preco: 197 } },
}))

// Importar DEPOIS do vi.mock para receber as versões mockadas
import { onAuthStateChanged, getDoc, signOut } from '../firebase'

// Componente auxiliar — expõe o contexto de auth na DOM para asserções
function ExporContexto() {
  const ctx = useAuth()
  return (
    <div>
      <span data-testid='loading'>{String(ctx.loadingAuth)}</span>
      <span data-testid='empresaId'>{ctx.empresaId ?? 'null'}</span>
      <span data-testid='superadmin'>{String(ctx.isSuperAdmin)}</span>
      <span data-testid='usuario'>{ctx.usuario?.uid ?? 'null'}</span>
      <button onClick={ctx.logout} data-testid='btn-logout'>Sair</button>
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

// AUTH-01: loading enquanto onAuthStateChanged não chamou o callback
describe('AUTH-01: estado de loading', () => {
  it('exibe Carregando enquanto onAuthStateChanged nao respondeu', () => {
    // Mock NÃO chama o callback — simula o estado pendente inicial
    onAuthStateChanged.mockImplementation(() => () => {})
    const { container } = renderProvider()
    expect(container.textContent).toContain('Carregando')
    // ExporContexto NÃO aparece porque AuthProvider renderiza o fallback
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
  })
})

// AUTH-02: empresaId via getDoc(empresas/{uid}) quando existe
describe('AUTH-02: resolucao de empresaId via Firestore (empresas/{uid})', () => {
  it('resolve empresaId quando empresa existe em empresas/uid', async () => {
    const fakeUser = {
      uid: 'user-123',
      email: 'admin@teste.com',
      getIdTokenResult: vi.fn().mockResolvedValue({ claims: {} }),
    }
    onAuthStateChanged.mockImplementation((auth, cb) => { cb(fakeUser); return () => {} })
    // getDoc retorna exists: true para empresas/user-123
    getDoc.mockResolvedValue({ exists: () => true })

    renderProvider()

    await waitFor(() => {
      expect(screen.getByTestId('empresaId').textContent).toBe('user-123')
    })
    expect(screen.getByTestId('usuario').textContent).toBe('user-123')
  })
})

// AUTH-03: fallback para usuarios/{uid} quando empresas/{uid} não existe
describe('AUTH-03: fallback Firestore para usuarios/{uid}', () => {
  it('usa fallback usuarios/uid quando empresa nao existe', async () => {
    const fakeUser = {
      uid: 'user-456',
      email: 'admin@teste.com',
      getIdTokenResult: vi.fn().mockResolvedValue({ claims: {} }),
    }
    onAuthStateChanged.mockImplementation((auth, cb) => { cb(fakeUser); return () => {} })
    // Primeira chamada (empresas/uid) → não existe
    // Segunda chamada (usuarios/uid) → existe com empresaId diferente
    getDoc
      .mockResolvedValueOnce({ exists: () => false })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ empresaId: 'emp-xyz' }) })

    renderProvider()

    await waitFor(() => {
      expect(screen.getByTestId('empresaId').textContent).toBe('emp-xyz')
    })
  })
})

// AUTH-04: superadmin via claims role + superadmin_until
describe('AUTH-04: identificacao de superadmin via claims', () => {
  it('identifica superadmin quando role=superadmin e superadmin_until nao expirado', async () => {
    const futureTs = Math.floor(Date.now() / 1000) + 3600 // 1h no futuro
    const fakeUser = {
      uid: 'super-001',
      email: 'superadmin@test.com',
      getIdTokenResult: vi.fn().mockResolvedValue({
        claims: { role: 'superadmin', superadmin_until: futureTs },
      }),
    }
    onAuthStateChanged.mockImplementation((auth, cb) => { cb(fakeUser); return () => {} })

    renderProvider()

    await waitFor(() => {
      expect(screen.getByTestId('superadmin').textContent).toBe('true')
    })
    // superadmin não tem empresaId
    expect(screen.getByTestId('empresaId').textContent).toBe('null')
  })
})

// AUTH-05: logout limpa o estado
describe('AUTH-05: logout limpa estado', () => {
  it('limpa usuario e empresaId apos logout', async () => {
    let authCallback
    const fakeUser = {
      uid: 'user-789',
      email: 'admin@teste.com',
      getIdTokenResult: vi.fn().mockResolvedValue({ claims: {} }),
    }

    // Começa logado
    onAuthStateChanged.mockImplementation((auth, cb) => {
      authCallback = cb
      cb(fakeUser)
      return () => {}
    })
    getDoc.mockResolvedValue({ exists: () => true })

    renderProvider()

    // Aguarda resolver o empresaId inicial
    await waitFor(() => {
      expect(screen.getByTestId('usuario').textContent).toBe('user-789')
    })

    // signOut dispara onAuthStateChanged com null (comportamento real do Firebase)
    signOut.mockImplementation(async () => {
      authCallback(null)
    })

    // Chamar logout via botão
    await act(async () => {
      screen.getByTestId('btn-logout').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('usuario').textContent).toBe('null')
      expect(screen.getByTestId('empresaId').textContent).toBe('null')
    })
  })
})
