// ============================================================
// ENTRY POINT — AuthProvider adicionado para multi-tenant
// ============================================================
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        {/* AuthProvider envolve o App para que useAuth()
            funcione em qualquer componente da árvore */}
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
