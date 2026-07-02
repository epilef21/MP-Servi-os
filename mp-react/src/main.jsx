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

// Registra o Service Worker do Firebase Messaging para notificações em background
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/firebase-messaging-sw.js')
    .then(reg => console.log('Service Worker FCM registrado:', reg.scope))
    .catch(err => console.error('Erro ao registrar Service Worker FCM:', err))
}

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
