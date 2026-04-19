// ============================================================
// PÁGINA DE ERRO — Empresa não encontrada ou inativa
// ============================================================
export default function EmpresaNaoEncontrada() {
  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      height:         '100vh',
      fontFamily:     'Barlow, sans-serif',
      color:          '#1a3a5c',
      textAlign:      'center',
      padding:        '2rem',
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Empresa não encontrada</h1>
      <p style={{ color: '#666', maxWidth: '360px' }}>
        O link que você acessou é inválido ou a empresa está inativa.
        Verifique o endereço e tente novamente.
      </p>
    </div>
  )
}
