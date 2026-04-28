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

  const [email,     setEmail]     = useState('')
  const [senha,     setSenha]     = useState('')
  const [erro,      setErro]      = useState('')
  const [loading,   setLoading]   = useState(false)
  const [showSenha, setShowSenha] = useState(false)

  // Redireciona quem já estava logado ao acessar /login (ex: refresh de página)
  // Não tem fallback para /cadastro — evita corrida com o AuthContext assíncrono
  useEffect(() => {
    if (!estaLogado) return
    if (isSuperAdmin) { navigate('/superadmin', { replace: true }); return }
    if (empresaId) {
      getDoc(doc(db, 'empresas', empresaId))
        .then(snap => { if (snap.exists()) navigate(`/${snap.data().slug}/admin`, { replace: true }) })
        .catch(() => {})
    }
  }, [estaLogado, isSuperAdmin, empresaId, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      // login() retorna o user do Firebase Auth imediatamente
      const user = await login(email.trim(), senha)

      // Superadmin — redireciona direto
      if (user.email === SUPERADMIN_EMAIL) {
        navigate('/superadmin', { replace: true })
        return
      }

      // Tentativa primária: empresas/{uid} (convenção: empresaId === uid)
      const snapEmpresa = await getDoc(doc(db, 'empresas', user.uid))
      if (snapEmpresa.exists()) {
        navigate(`/${snapEmpresa.data().slug}/admin`, { replace: true })
        return
      }

      // Fallback: usuarios/{uid} → empresaId (compatibilidade com cadastros antigos)
      const snapUsuario = await getDoc(doc(db, 'usuarios', user.uid))
      if (snapUsuario.exists() && snapUsuario.data().empresaId) {
        const eid     = snapUsuario.data().empresaId
        const snapEmp = await getDoc(doc(db, 'empresas', eid))
        if (snapEmp.exists()) {
          navigate(`/${snapEmp.data().slug}/admin`, { replace: true })
          return
        }
      }

      // Empresa não encontrada — mostra erro, sem redirecionar para /cadastro
      setErro('Empresa não encontrada para este usuário. Contate o suporte.')
    } catch (err) {
      console.error('[LoginPage] Erro no login:', err)
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
            <div className="password-field">
              <input
                className="form-input"
                type={showSenha ? 'text' : 'password'}
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowSenha(p => !p)}
                tabIndex={-1}
              >
                {showSenha ? '🙈' : '👁️'}
              </button>
            </div>
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
