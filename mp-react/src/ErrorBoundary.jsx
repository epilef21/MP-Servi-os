import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('App crash:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 24,
          background: '#e8edf2', fontFamily: 'Barlow, sans-serif', textAlign: 'center'
        }}>
          <div style={{ fontSize: 56 }}>⚠️</div>
          <h2 style={{ color: '#1a3a5c', marginTop: 16, fontSize: '1.4rem' }}>
            Algo deu errado
          </h2>
          <p style={{ color: '#666', maxWidth: 360, lineHeight: 1.6, marginTop: 8 }}>
            {this.state.error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 24, padding: '10px 24px', background: '#1a3a5c',
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: '1rem', cursor: 'pointer'
            }}
          >
            🔄 Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
