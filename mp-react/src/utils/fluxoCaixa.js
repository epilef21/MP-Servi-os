// ============================================================
// fluxoCaixa.js — Fluxo de caixa do mês e série de evolução (Fase 10)
// ============================================================
// Módulo 100% puro — sem dependência de Firebase/React (mesmo padrão de
// contasPagar.js / fechamentoTecnicos.js / faturamento.js).

// Extrai 'YYYY-MM' de uma data 'YYYY-MM-DD', validando o formato.
// NÃO usar new Date(dataISO)/toISOString aqui — bug de timezone (lição LOCKED
// das Fases 7/9: datas locais nunca passam por conversão UTC implícita).
export function mesDeData(dataISO) {
  if (!dataISO || typeof dataISO !== 'string' || dataISO.length < 7) return null
  const partes = dataISO.split('-').map(Number)
  if (partes.length !== 3) return null
  const [ano, mes, dia] = partes
  if (!ano || !mes || !dia) return null
  return dataISO.slice(0, 7)
}

// Data de entrada de caixa de uma nota fiscal paga: pago_em é a fonte da verdade
// (data real do recebimento). Fallback de compatibilidade legada — decisão LOCKED
// do 10-CONTEXT — para notas pagas antigas sem pago_em preenchido: usa
// data_prevista e, na ausência dela, data_emissao.
export function dataEntradaNota(nota) {
  return nota?.pago_em || nota?.data_prevista || nota?.data_emissao || ''
}

// Fluxo de caixa REAL do mês (dinheiro que de fato entrou/saiu — CAIXA-01).
// Regras de inclusão (LOCKED no 10-CONTEXT):
// - nota: status === 'paga' && mesDeData(dataEntradaNota(nota)) === mesRef (soma total)
// - particular: mes_referencia === mesRef (soma valor_recebido)
// - despesa: data_pagamento string não vazia && mesDeData(data_pagamento) === mesRef (soma valor)
//            — despesa sem data_pagamento NUNCA entra, mesmo que esteja marcada como paga.
// - fechamento: status === 'pago' && mesDeData(pago_em) === mesRef (soma total)
export function fluxoCaixaDoMes({ notas, particulares, despesas, fechamentos } = {}, mesRef) {
  const listaNotas = notas || []
  const listaParticulares = particulares || []
  const listaDespesas = despesas || []
  const listaFechamentos = fechamentos || []

  const notasDoMes = listaNotas.filter(
    (n) => n?.status === 'paga' && mesDeData(dataEntradaNota(n)) === mesRef
  )
  const particularesDoMes = listaParticulares.filter((p) => p?.mes_referencia === mesRef)

  const despesasDoMes = listaDespesas.filter((d) => {
    const dataPagamento = d?.data_pagamento
    return typeof dataPagamento === 'string' && dataPagamento !== '' && mesDeData(dataPagamento) === mesRef
  })
  const tecnicosDoMes = listaFechamentos.filter(
    (f) => f?.status === 'pago' && mesDeData(f?.pago_em) === mesRef
  )

  const totalNotas = notasDoMes.reduce((acc, n) => acc + (parseFloat(n.total) || 0), 0)
  const totalParticulares = particularesDoMes.reduce((acc, p) => acc + (parseFloat(p.valor_recebido) || 0), 0)
  const totalDespesas = despesasDoMes.reduce((acc, d) => acc + (parseFloat(d.valor) || 0), 0)
  const totalTecnicos = tecnicosDoMes.reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0)

  const entradas = {
    notas: notasDoMes,
    particulares: particularesDoMes,
    totalNotas,
    totalParticulares,
    total: totalNotas + totalParticulares,
  }
  const saidas = {
    despesas: despesasDoMes,
    tecnicos: tecnicosDoMes,
    totalDespesas,
    totalTecnicos,
    total: totalDespesas + totalTecnicos,
  }

  return { entradas, saidas, saldo: entradas.total - saidas.total }
}
