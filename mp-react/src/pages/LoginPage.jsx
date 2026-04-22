// ============================================================
// LOGIN — Firebase Auth (substitui senha hardcoded do .env)
// Redireciona superadmin para /superadmin,
// admin de empresa para /:slug/admin
// ============================================================
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { db, doc, getDoc, SUPERADMIN_EMAIL } from '../firebase'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, estaLogado, isSuperAdmin, empresaId, emailUsuario } = useAuth()

  const [email,   setEmail]   = useState('')
  const [senha,   setSenha]   = useState('')
  const [erro,    setErro]    = useState('')
  const [loading, setLoading] = useState(false)

  // Se já estiver logado, redireciona direto sem mostrar o form
  useEffect(() => {
    if (!estaLogado) return

    async function redirecionar() {
      if (isSuperAdmin) {
        navigate('/superadmin', { replace: true })
        return
      }

      if (empresaId) {
        // Busca o slug da empresa para montar a rota /:slug/admin
        const snap = await getDoc(doc(db, 'empresas', empresaId))
        if (snap.exists()) {
          navigate(`/${snap.data().slug}/admin`, { replace: true })
          return
        }
      }

      // Fallback: usuário logado mas sem empresa vinculada
      navigate('/cadastro', { replace: true })
    }

    redirecionar()
  }, [estaLogado, isSuperAdmin, empresaId, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      await login(email.trim(), senha)
      // O useEffect acima cuida do redirecionamento
      // após o AuthContext atualizar o estado
    } catch (err) {
      console.error('[LoginPage] Erro no login:', err)

      // Traduz os erros mais comuns do Firebase Auth
      const mensagens = {
        'auth/user-not-found':      'E-mail não encontrado.',
        'auth/wrong-password':      'Senha incorreta.',
        'auth/invalid-email':       'E-mail inválido.',
        'auth/invalid-credential':  'E-mail ou senha incorretos.',
        'auth/too-many-requests':   'Muitas tentativas. Aguarde alguns minutos.',
        'auth/user-disabled':       'Esta conta foi desativada.',
      }
      setErro(mensagens[err.code] || 'Erro ao entrar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">

        {/* Cabeçalho */}
        <div className="login-header">
          <div className="login-icon">
            <img src="/logo.png" height="48" alt="AssistHub" style={{ display: 'block' }} />
          </div>
          <h1 className="login-title">AssistHub</h1>
          <p className="login-subtitle">Painel administrativo — acesso restrito</p>
        </div>

        {erro && (
          <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>

          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@suaempresa.com"
              autoFocus
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Senha</label>
            <input
              className="form-input"
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading ? 'Verificando...' : 'Entrar no Painel'}
          </button>

        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem', color: '#666' }}>
          Ainda não tem conta?{' '}
          <Link to="/cadastro" style={{ color: '#1a3fa8', fontWeight: '600' }}>
            Criar empresa
          </Link>
        </p>

      </div>
    </div>
  )
}
