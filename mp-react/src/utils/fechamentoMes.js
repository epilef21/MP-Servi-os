// ============================================================
// fechamentoMes.js — Estado de "mês fechado" (Exportação e Fechamento do Mês)
// ============================================================
// Módulo 100% puro — sem dependência de Firebase/React (ver threat model 11-04).
//
// Doc lido de empresas/{empresaId}/fechamentosMes/{mesRef} (id = 'YYYY-MM'):
//   { fechado: true, fechado_em: <Firestore Timestamp>, fechado_por?: <string> }
// Se o mês nunca foi fechado, o getDoc não existe → o consumidor passa null/undefined.

// true SOMENTE se doc existe e doc.fechado === true.
export function estaFechado(doc) {
  return !!doc && doc.fechado === true
}

// Formata a data de fechamento para o banner: 'DD/MM/AAAA'.
// Aceita Firestore Timestamp ({ toDate() }), Date, ou string ISO 'YYYY-MM-DD'.
// NUNCA usa new Date(string) para ISO curto (risco de fuso) nem toISOString.
// Retorna '' para valor ausente/inválido.
export function formatarFechadoEm(v) {
  let data = null

  if (!v) return ''

  if (typeof v.toDate === 'function') {
    data = v.toDate()
  } else if (v instanceof Date) {
    data = v
  } else if (typeof v === 'string') {
    const partes = v.split('-').map(Number)
    if (partes.length !== 3) return ''
    const [ano, mes, dia] = partes
    if (!ano || !mes || !dia) return ''
    data = new Date(ano, mes - 1, dia)
  } else {
    return ''
  }

  if (!(data instanceof Date) || Number.isNaN(data.getTime())) return ''

  const dd = String(data.getDate()).padStart(2, '0')
  const mm = String(data.getMonth() + 1).padStart(2, '0')
  const yyyy = data.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}
