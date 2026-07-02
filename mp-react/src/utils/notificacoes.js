import { db } from '../firebase'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'

// Chave pública VAPID gerada para este projeto
const VAPID_PUBLIC_KEY =
  'BLKi9nt5UlNz5m5vZKfHOm2HniRo6jvO52O1QHJJ7VnX0McpVAk5K5dk6fWEh-xoN-72_F8kb66BJMP5Rk4b4HU'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

// Solicita permissão e assina push via Web Push API padrão.
// Salva a subscription no Firestore vinculada à empresa.
export async function solicitarPermissaoENotificacao(empresaId, userLabel) {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'denied') return false

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    const registration = await navigator.serviceWorker.ready

    // Cancela subscrição antiga para forçar nova (evita endpoint expirado)
    const existing = await registration.pushManager.getSubscription()
    if (existing) await existing.unsubscribe()

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    // ID único baseado no endpoint (últimos 20 chars do base64)
    const subId = btoa(subscription.endpoint).replace(/[^a-zA-Z0-9]/g, '').slice(-20)

    await setDoc(
      doc(db, `empresas/${empresaId}/notificacaoTokens/${subId}`),
      {
        subscription: JSON.stringify(subscription.toJSON()),
        label:        userLabel || 'Admin',
        criado_em:    serverTimestamp(),
        ativo:        true,
      }
    )

    console.log('Inscrição push salva com sucesso.')
    return true
  } catch (err) {
    console.error('Erro ao inscrever no push:', err)
    return false
  }
}

// Escuta mensagens do Service Worker (recebidas via postMessage).
// Toca o som e chama o callback quando chega notificação.
export function escutarNotificacoesEmPrimeiroPlano(callback) {
  if (!('serviceWorker' in navigator)) return

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type !== 'PUSH_RECEIVED') return

    try {
      const audio = new Audio('/notification-sound.wav')
      audio.play().catch(() => {})
    } catch { /* navegador pode bloquear autoplay */ }

    if (callback) callback(event.data.data)
  })
}
