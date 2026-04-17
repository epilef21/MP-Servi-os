import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASSWORD || 'mp@admin2024'

export default function LoginPage() {
  const [password, setPassword]   = useState('')
  const [error, setError]         = useState(false)
  const [loading, setLoading]     = useState(false)
  const navigate = useNavigate()

  function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError(false)
    setTimeout(() => {
      if (password === ADMIN_PASS) {
        sessionStorage.setItem('mp_auth', '1')
        navigate('/admin')
      } else {
        setError(true)
        setLoading(false)
        setPassword('')
      }
    }, 400)
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="l-icon">🏠</div>
        <h2>MP Serviços</h2>
        <p>Painel administrativo — acesso restrito</p>

        <form onSubmit={handleLogin}>
          <div className="field">
            <label>Senha de acesso</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
              required
            />
          </div>
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'Verificando...' : 'Entrar no Painel'}
          </button>
          {error && <p className="login-err">❌ Senha incorreta. Tente novamente.</p>}
        </form>

        <Link to="/" className="login-back">← Voltar ao formulário</Link>
      </div>
    </div>
  )
}
