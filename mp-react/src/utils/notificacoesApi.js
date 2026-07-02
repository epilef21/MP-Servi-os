import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'

const notificarFn = httpsCallable(functions, 'notificarChecklistEnviado')

// Notifica todos os admins da empresa que um checklist foi enviado.
// Falha silenciosa — nunca deve travar o envio do checklist.
export async function notificarChecklistEnviado(empresaId, dadosOS) {
  const result = await notificarFn({
    empresaId,
    nomeSegurado: dadosOS.nome_segurado  || '',
    cidade:       dadosOS.cidade         || '',
    numAssist:    dadosOS.num_assist      || '',
  })
  return result.data
}
