// ============================================================
// APP — Definição de rotas multi-tenant
// Páginas carregadas sob demanda (lazy) para reduzir o bundle
// inicial — o técnico no campo não baixa o painel admin inteiro.
// ============================================================
import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'

// Páginas leves e de entrada — carregam junto com o app
import LoginPage    from './pages/LoginPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

// Demais páginas — cada uma vira um arquivo separado, baixado só quando acessada
const FormPage              = lazy(() => import('./pages/FormPage.jsx'))
const AdminPage             = lazy(() => import('./pages/AdminPage.jsx'))
const CadastroPage          = lazy(() => import('./pages/CadastroPage.jsx'))
const SuperAdminPage        = lazy(() => import('./pages/SuperAdminPage.jsx'))
const EmpresaNaoEncontrada  = lazy(() => import('./pages/EmpresaNaoEncontrada.jsx'))
const AvaliacaoPage         = lazy(() => import('./pages/AvaliacaoPage.jsx'))
const OrcamentoTecnicoPage  = lazy(() => import('./pages/OrcamentoTecnicoPage.jsx'))
const AprovarOrcamentoPage  = lazy(() => import('./pages/AprovarOrcamentoPage.jsx'))
const AgendaPage            = lazy(() => import('./pages/AgendaPage.jsx'))
const RelatorioPage         = lazy(() => import('./pages/RelatorioPage.jsx'))
const AssinarClientePage    = lazy(() => import('./pages/AssinarClientePage.jsx'))
const OAuthCallbackPage     = lazy(() => import('./pages/OAuthCallbackPage.jsx'))

// Tela exibida enquanto o arquivo da página é baixado
function CarregandoPagina() {
  return (
    <div className="loading-state" style={{ paddingTop: '20vh' }}>
      <div className="spinner" />
      <p className="loading-text">Carregando...</p>
    </div>
  )
}

// ── Guarda de rota para admin da empresa ─────────────────────
// Redireciona para /login se o usuário não estiver autenticado
function RotaAdmin({ children }) {
  const { estaLogado, empresaId } = useAuth()
  if (!estaLogado || !empresaId) return <Navigate to="/login" replace />
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
    <Suspense fallback={<CarregandoPagina />}>
    <Routes>
      {/* ── Rotas públicas ─────────────────────────────────── */}
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/cadastro" element={<CadastroPage />} />
      <Route path="/empresa-nao-encontrada" element={<EmpresaNaoEncontrada />} />

      {/* Pesquisa de satisfação — pública, sem auth */}
      <Route path="/avaliacao/:slug/:osId" element={<AvaliacaoPage />} />

      {/* Técnico preenche orçamento no local — pública, sem auth */}
      <Route path="/orcamento/:slug/:orcamentoId" element={<OrcamentoTecnicoPage />} />

      {/* Cliente visualiza e aprova orçamento — pública, sem auth */}
      <Route path="/aprovar/:slug/:orcamentoId" element={<AprovarOrcamentoPage />} />

      {/* Relatório técnico público — enviado à seguradora via link */}
      <Route path="/relatorio/:slug/:osId" element={<RelatorioPage />} />

      {/* Assinatura remota do cliente — admin preenche, cliente só assina */}
      <Route path="/assinar/:slug/:osId" element={<AssinarClientePage />} />

      {/* Callback OAuth do Google Calendar — recebe o code e conecta a conta */}
      <Route path="/oauth-callback" element={<OAuthCallbackPage />} />

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

      {/* Agenda visual do dia — /:slug/agenda (protegido) */}
      <Route
        path="/:slug/agenda"
        element={
          <RotaAdmin>
            <AgendaPage />
          </RotaAdmin>
        }
      />

      {/* Raiz redireciona para login */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Qualquer rota desconhecida exibe a página 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
  )
}
