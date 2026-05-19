// ============================================================
// LOGIN — Firebase Auth (substitui senha hardcoded do .env)
// Redireciona superadmin para /superadmin,
// admin de empresa para /:slug/admin
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link, useSearchParams, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { db, doc, getDoc, auth, SUPERADMIN_EMAIL } from '../firebase'

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, estaLogado, isSuperAdmin, empresaId, emailUsuario } = useAuth()

  const [email,           setEmail]           = useState('')
  const [senha,           setSenha]           = useState('')
  const [erro,            setErro]            = useState('')
  const [loading,         setLoading]         = useState(false)
  const [showSenha,       setShowSenha]       = useState(false)
  const [extensaoOk,      setExtensaoOk]      = useState(false)

  // Garante que a navegação pós-login acontece só uma vez por montagem do componente
  const didNavigate = useRef(false)

  // Parâmetros passados pela extensão Chrome
  const extId   = searchParams.get('ext_id')
  const extMode = searchParams.get('extension') === 'auth' && !!extId

  // Empresa admin: resolve slug via Firestore e navega (useEffect só para o caso assíncrono)
  useEffect(() => {
    if (!estaLogado) { didNavigate.current = false; return }
    if (didNavigate.current) return
    if (isSuperAdmin || emailUsuario === SUPERADMIN_EMAIL) return  // tratado no render
    if (!empresaId) return

    didNavigate.current = true
    getDoc(doc(db, 'empresas', empresaId)).then(async snap => {
      if (!snap.exists()) return
      const slug = snap.data().slug

      if (extMode) {
        try {
          const user = auth.currentUser
          if (user) {
            const token = await user.getIdToken()
            await enviarTokenParaExtensao(extId, token, slug)
            setExtensaoOk(true)
          }
        } catch { /* silencioso */ }
        return
      }

      navigate(`/${slug}/admin`, { replace: true })
    }).catch(() => {})
  }, [estaLogado, isSuperAdmin, empresaId, navigate, extMode, extId])

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      // login() retorna o user do Firebase Auth imediatamente
      const user = await login(email.trim(), senha)

      // Superadmin — deixa o useEffect redirecionar após onAuthStateChanged atualizar
      if (user.email === SUPERADMIN_EMAIL) {
        return
      }

      // Resolve slug da empresa para poder enviar para a extensão
      let slug = null

      // Tentativa primária: empresas/{uid} (convenção: empresaId === uid)
      const snapEmpresa = await getDoc(doc(db, 'empresas', user.uid))
      if (snapEmpresa.exists()) {
        slug = snapEmpresa.data().slug
      } else {
        // Fallback: usuarios/{uid} → empresaId (compatibilidade com cadastros antigos)
        const snapUsuario = await getDoc(doc(db, 'usuarios', user.uid))
        if (snapUsuario.exists() && snapUsuario.data().empresaId) {
          const eid     = snapUsuario.data().empresaId
          const snapEmp = await getDoc(doc(db, 'empresas', eid))
          if (snapEmp.exists()) slug = snapEmp.data().slug
        }
      }

      if (!slug) {
        setErro('Empresa não encontrada para este usuário. Contate o suporte.')
        return
      }

      // Fluxo extensão Chrome: envia token + slug para a extensão e exibe confirmação
      if (extMode) {
        try {
          const token = await user.getIdToken()
          await enviarTokenParaExtensao(extId, token, slug)
          setExtensaoOk(true)
        } catch {
          setErro('Não foi possível conectar à extensão. Tente novamente.')
        }
        return
      }

      navigate(`/${slug}/admin`, { replace: true })
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

  // Envia token ao service worker da extensão via cross-extension messaging
  function enviarTokenParaExtensao(extensionId, token, empresaSlug) {
    return new Promise((resolve, reject) => {
      if (!window.chrome?.runtime?.sendMessage) {
        reject(new Error('API da extensão indisponível. Verifique se ela está instalada.'))
        return
      }
      chrome.runtime.sendMessage(
        extensionId,
        { action: 'setAuth', token, empresaSlug },
        (resp) => {
          if (chrome.runtime.lastError || !resp?.success) {
            reject(new Error(chrome.runtime.lastError?.message || 'Resposta inválida da extensão'))
          } else {
            resolve()
          }
        }
      )
    })
  }

  // Superadmin logado e não em modo extensão → redireciona declarativamente (sem useEffect)
  if (!extMode && estaLogado && (isSuperAdmin || emailUsuario === SUPERADMIN_EMAIL)) {
    return <Navigate to="/superadmin" replace />
  }

  // Tela de sucesso mostrada após conectar a extensão
  if (extensaoOk) {
    return (
      <div className="login-container">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
          <h2 style={{ color: 'var(--success)', marginBottom: '0.5rem' }}>Extensão conectada!</h2>
          <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>
            A extensão AssistHub agora pode criar OS automaticamente.<br />
            Você pode fechar esta aba.
          </p>
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={() => window.close()}
          >
            Fechar aba
          </button>
        </div>
      </div>
    )
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

        {extMode && (
          <div className="alert" style={{
            background: '#e8f0fe', border: '1px solid #b3c6f7',
            color: '#1a3fa8', borderRadius: '8px',
            padding: '10px 14px', marginBottom: '1rem', fontSize: '0.9rem'
          }}>
            🔌 Conectando extensão Chrome — faça login para autorizar.
          </div>
        )}

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
