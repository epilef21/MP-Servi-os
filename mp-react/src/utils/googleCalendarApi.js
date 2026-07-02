// Wrappers das Cloud Functions callable do Google Calendar.
// Tokens nunca passam pelo frontend — toda autenticação é feita no servidor.
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'

const conectarFn    = httpsCallable(functions, 'conectarGoogleCalendar')
const listarFn      = httpsCallable(functions, 'listarContasGoogleCalendar')
const criarFn       = httpsCallable(functions, 'criarEventoCalendar')
const atualizarFn   = httpsCallable(functions, 'atualizarEventoCalendar')
const excluirFn     = httpsCallable(functions, 'excluirEventoCalendar')
const desconectarFn = httpsCallable(functions, 'desconectarGoogleCalendar')
const finalizarFn   = httpsCallable(functions, 'finalizarEventoCalendar')

export async function conectarGoogleCalendar(authCode, empresaId, contaLabel) {
  const result = await conectarFn({ authCode, empresaId, contaLabel })
  return result.data
}

export async function listarContasGoogleCalendar(empresaId) {
  const result = await listarFn({ empresaId })
  return result.data
}

// contasIds (opcional): array de IDs de contas a usar; se omitido, usa todas as ativas
export async function criarEventoOS(empresaId, osData, contasIds) {
  const result = await criarFn({ empresaId, osData, contasIds })
  return result.data
}

export async function atualizarEventoOS(empresaId, osData, eventosExistentes) {
  const result = await atualizarFn({ empresaId, osData, eventosExistentes })
  return result.data
}

export async function excluirEventoOS(empresaId, eventosExistentes) {
  const result = await excluirFn({ empresaId, eventosExistentes })
  return result.data
}

export async function desconectarGoogleCalendar(empresaId, contaId) {
  const result = await desconectarFn({ empresaId, contaId })
  return result.data
}

// Atualiza o horário de fim do evento para o momento do envio do checklist.
// Chamada pelo técnico (sem login) — a Cloud Function não exige autenticação.
export async function finalizarEventoOS(empresaId, eventosExistentes, dataAgendada) {
  const result = await finalizarFn({ empresaId, eventosExistentes, dataAgendada })
  return result.data
}
