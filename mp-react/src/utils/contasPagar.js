// ============================================================
// contasPagar.js — Vencimento e status das despesas (Contas a Pagar)
// ============================================================
// Módulo 100% puro — sem dependência de Firebase/React (ver threat model 09-01).

function fmtISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Parseia 'YYYY-MM-DD' em { ano, mes, dia } ou null se inválido.
function parseISO(dataISO) {
  if (!dataISO || typeof dataISO !== 'string') return null
  const partes = dataISO.split('-').map(Number)
  if (partes.length !== 3) return null
  const [ano, mes, dia] = partes
  if (!ano || !mes || !dia) return null
  return { ano, mes, dia }
}

// Status derivado da despesa — NUNCA gravado no Firestore (mesmo padrão das notas
// da Fase 7 e dos fechamentos da Fase 8).
// 'pago' se data_pagamento preenchida; senão 'atrasado' se venceu e não foi paga;
// senão 'pendente'. Vencimento HOJE ainda é 'pendente' (comparação estrita >).
export function statusDespesa(despesa, hojeISO) {
  if (despesa?.data_pagamento && typeof despesa.data_pagamento === 'string' && despesa.data_pagamento.trim() !== '') {
    return 'pago'
  }
  if (despesa?.data_vencimento && hojeISO && hojeISO > despesa.data_vencimento) {
    return 'atrasado'
  }
  return 'pendente'
}

// Dias de hojeISO até dataVencimento (negativo = já venceu, 0 = vence hoje, null = sem data).
// Usa Date.UTC para os dois lados — à prova de fuso/DST.
export function diasParaVencer(dataVencimento, hojeISO) {
  const venc = parseISO(dataVencimento)
  const hoje = parseISO(hojeISO)
  if (!venc || !hoje) return null
  const msVenc = Date.UTC(venc.ano, venc.mes - 1, venc.dia)
  const msHoje = Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia)
  return Math.round((msVenc - msHoje) / 86400000)
}

// Data de vencimento do mês a partir do dia cadastrado (despesasRecorrentes.dia_vencimento).
// Clamp de fim de mês: dia 31 em mês de 30 dias vira o último dia real; dia 30 em
// fevereiro vira 28/29. Retorna null se diaVencimento ou mesRef forem inválidos.
export function dataVencimentoDoMes(diaVencimento, mesRef) {
  const dia = Number(diaVencimento)
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) return null
  if (!mesRef || typeof mesRef !== 'string') return null
  const partes = mesRef.split('-').map(Number)
  if (partes.length !== 2) return null
  const [ano, mes] = partes
  if (!ano || !mes || mes < 1 || mes > 12) return null

  const ultimoDia = new Date(ano, mes, 0).getDate()
  const diaClamp = Math.min(dia, ultimoDia)
  const data = new Date(ano, mes - 1, diaClamp)
  return fmtISO(data)
}

// Resumo de alertas de vencimento sobre uma lista de despesasMensais.
// aVencer = não pagas, com data_vencimento, diasParaVencer entre 0 e 7 (inclusive).
// atrasadas = não pagas, com data_vencimento, diasParaVencer < 0.
// total = aVencer + atrasadas.
export function resumoAlertas(despesas, hojeISO) {
  let aVencer = 0
  let atrasadas = 0
  for (const despesa of (despesas || [])) {
    const status = statusDespesa(despesa, hojeISO)
    if (status === 'pago') continue
    if (!despesa?.data_vencimento) continue
    const dias = diasParaVencer(despesa.data_vencimento, hojeISO)
    if (dias === null) continue
    if (dias < 0) atrasadas += 1
    else if (dias <= 7) aVencer += 1
  }
  return { aVencer, atrasadas, total: aVencer + atrasadas }
}
