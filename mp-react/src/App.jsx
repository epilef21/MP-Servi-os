// ============================================================
// APP — Definição de rotas multi-tenant
// ============================================================
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'

// Páginas existentes (serão adaptadas nos próximos arquivos)
import FormPage    from './pages/FormPage.jsx'
import AdminPage   from './pages/AdminPage.jsx'
import LoginPage   from './pages/LoginPage.jsx'

// Páginas novas
import CadastroPage      from './pages/CadastroPage.jsx'
import SuperAdminPage    from './pages/SuperAdminPage.jsx'
import EmpresaNaoEncontrada from './pages/EmpresaNaoEncontrada.jsx'

// ── Guarda de rota para admin da empresa ─────────────────────
// Redireciona para /login se o usuário não estiver autenticado
function RotaAdmin({ children }) {
  const { estaLogado } = useAuth()
  if (!estaLogado) return <Navigate to="/login" replace />
  return children
}

// ── Guarda de rota exclusiva para superadmin ─────────────────
function RotaSuperAdmin({ children }) {
  const { estaLogado, isSuperAdmin } = useAuth()
  if (!estaLogado)    return <Navigate to="/login"    replace />
  if (!isSuperAdmin)  return <Navigate to="/"         replace />
  return children
}

export default function App() {
  return (
    <Routes>
      {/* ── Rotas públicas ─────────────────────────────────── */}
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/cadastro" element={<CadastroPage />} />
      <Route path="/empresa-nao-encontrada" element={<EmpresaNaoEncontrada />} />

      {/* ── Superadmin ─────────────────────────────────────── */}
      <Route
        path="/superadmin"
        element={
          <RotaSuperAdmin>
            <SuperAdminPage />
          </RotaSuperAdmin>
        }
      />

      {/* ── Rotas por slug da empresa ──────────────────────── */}

      {/* Formulário público do técnico — /:slug */}
      <Route path="/:slug" element={<FormPage />} />

      {/* Painel admin da empresa — /:slug/admin (protegido) */}
      <Route
        path="/:slug/admin"
        element={
          <RotaAdmin>
            <AdminPage />
          </RotaAdmin>
        }
      />

      {/* Raiz redireciona para login */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Qualquer rota desconhecida vai para a raiz */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
