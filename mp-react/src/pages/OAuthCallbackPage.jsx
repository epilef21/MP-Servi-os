import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { conectarGoogleCalendar } from '../utils/googleCalendarApi'
import { auth } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'

export default function OAuthCallbackPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('processando')
  const [erro, setErro]     = useState('')

  useEffect(() => {
    let mounted = true

    // Aguarda o Firebase restaurar a sessão antes de chamar a Cloud Function.
    // Sem essa espera, o onCall recebe context.auth == null e retorna 401.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe() // só precisa da primeira resposta
      if (!mounted) return

      if (!user) {
        setStatus('erro')
        setErro('Sessão expirada. Faça login novamente e tente conectar o Google Calendar.')
        return
      }

      processar()
    })

    async function processar() {
      const params     = new URLSearchParams(window.location.search)
      const code       = params.get('code')
      const errorParam = params.get('error')
      const stateRaw   = params.get('state')

      if (errorParam) {
        if (mounted) { setStatus('erro'); setErro('Conexão cancelada ou negada pelo Google.') }
        return
      }

      let contaLabel = 'Conta Google'
      let empresaId  = ''
      let slug       = ''
      try {
        const parsed = stateRaw ? JSON.parse(stateRaw) : {}
        contaLabel = parsed.contaLabel || contaLabel
        empresaId  = parsed.empresaId  || localStorage.getItem('empresaIdAtual') || ''
        slug       = parsed.slug       || localStorage.getItem('slugAtual')       || ''
      } catch {}

      if (!code || !empresaId) {
        if (mounted) { setStatus('erro'); setErro('Dados incompletos para concluir a conexão. Tente novamente.') }
        return
      }

      try {
        await conectarGoogleCalendar(code, empresaId, contaLabel)
        if (mounted) {
          setStatus('sucesso')
          setTimeout(() => navigate(slug ? `/${slug}/admin` : '/login'), 1800)
        }
      } catch (err) {
        console.error('Erro ao conectar Google Calendar:', err)
        if (mounted) { setStatus('erro'); setErro('Não foi possível concluir a conexão. Tente novamente.') }
      }
    }

    return () => { mounted = false }
  }, [navigate])

  return (
    <div className="oauth-loading">
      {status === 'processando' && <p>🔄 Conectando ao Google Calendar...</p>}
      {status === 'sucesso'     && <p>✅ Conectado com sucesso! Redirecionando...</p>}
      {status === 'erro'        && (
        <div>
          <p>❌ {erro}</p>
          <button className="btn-sm btn-view" style={{ marginTop: 16 }}
            onClick={() => navigate('/login')}>
            Voltar
          </button>
        </div>
      )}
    </div>
  )
}
