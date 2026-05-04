import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../contexts/AuthContext'

// FakeAuthProvider — fornece contexto de auth falso sem conectar ao Firebase.
// loadingAuth: false é OBRIGATÓRIO — componentes renderizam null com true.
function FakeAuthProvider({ children, authValue }) {
  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  )
}

const DEFAULT_AUTH = {
  usuario: null,
  empresaId: null,
  isSuperAdmin: false,
  loadingAuth: false,
  login: () => Promise.resolve(),
  logout: () => Promise.resolve(),
  cadastrar: () => Promise.resolve(),
}

export function renderWithProviders(ui, { route = '/', authOverrides = {} } = {}) {
  const authValue = { ...DEFAULT_AUTH, ...authOverrides }

  return render(
    <MemoryRouter initialEntries={[route]}>
      <FakeAuthProvider authValue={authValue}>
        {ui}
      </FakeAuthProvider>
    </MemoryRouter>
  )
}
