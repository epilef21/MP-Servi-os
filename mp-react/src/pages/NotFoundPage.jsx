import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh', gap: 16,
      fontFamily: 'Barlow, sans-serif', background: 'var(--bg)',
      textAlign: 'center', padding: '2rem',
    }}>
      <div style={{ fontSize: '5rem', lineHeight: 1 }}>404</div>
      <h2 style={{ color: 'var(--text)', margin: 0 }}>Página não encontrada</h2>
      <p style={{ color: 'var(--muted)', maxWidth: 360, margin: 0 }}>
        O endereço que você tentou acessar não existe ou foi removido.
      </p>
      <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none', marginTop: 8 }}>
        ← Voltar para o login
      </Link>
    </div>
  )
}
