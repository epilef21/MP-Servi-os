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

// Array de 12 'YYYY-MM' terminando em mesRef (ordem cronológica, mais antigo primeiro).
// Aritmética local com new Date(ano, mes-1-i, 1) + padStart — mesmo padrão de
// navegarMes do FinanceiroEmpresaTab. PROIBIDO toISOString aqui (bug de timezone).
export function ultimos12Meses(mesRef) {
  const [ano, mes] = mesRef.split('-').map(Number)
  const meses = []
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(ano, mes - 1 - i, 1)
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return meses
}

// Mês da OS pelo critério EXATO do calcularDRE (FinanceiroEmpresaTab.jsx:640-641).
// ATENÇÃO: usar criado_em.toDate().toISOString() AQUI é INTENCIONAL — replica byte
// a byte o critério do DRE para que a série de evolução mostre os MESMOS números
// do DRE mensal (mesmo precedente da decisão 08-01). NÃO "corrigir" para data local.
export function mesDaOS(os) {
  try {
    const d = os?.criado_em?.toDate?.()
    return d ? d.toISOString().slice(0, 7) : null
  } catch {
    return null
  }
}

// Série de evolução dos últimos 12 meses (CAIXA-02): receita, lucroLiquido e margem
// por mês, replicando a MESMA cascata do calcularDRE (FinanceiroEmpresaTab.jsx:636-712)
// para garantir paridade de números entre o DRE mensal e o gráfico de evolução.
export function serieEvolucao12Meses(
  { reports, particulares, despesas, deducoes, resultadoFinanceiro } = {},
  mesRef
) {
  const listaReports = reports || []
  const listaParticulares = particulares || []
  const listaDespesas = despesas || []
  const listaDeducoes = deducoes || []
  const listaResultFin = resultadoFinanceiro || []

  return ultimos12Meses(mesRef).map((m) => {
    const osDoMes = listaReports.filter((r) => mesDaOS(r) === m)
    const particularesDoMes = listaParticulares.filter((p) => p?.mes_referencia === m)
    const deducoesDoMes = listaDeducoes.filter((d) => d?.mes_referencia === m)
    const despesasDoMes = listaDespesas.filter((d) => d?.mes_referencia === m)
    const resultFinDoMes = listaResultFin.filter((f) => f?.mes_referencia === m)

    const receitaOS = osDoMes.reduce(
      (acc, r) =>
        acc +
        (parseFloat(r.mo_seguradora) || 0) +
        (parseFloat(r.valor_deslocamento) || 0) +
        (parseFloat(r.material_cobrado_seguradora) || 0),
      0
    )
    const receitaPart = particularesDoMes.reduce((acc, p) => acc + (parseFloat(p.valor_recebido) || 0), 0)
    const receita = receitaOS + receitaPart

    const totalDeducoes = deducoesDoMes.reduce((acc, d) => acc + (parseFloat(d.valor) || 0), 0)

    const custoVariavel =
      osDoMes.reduce(
        (acc, r) => acc + (parseFloat(r.valor_prestador) || 0) + (parseFloat(r.material_custo_real) || 0),
        0
      ) + particularesDoMes.reduce((acc, p) => acc + (parseFloat(p.valor_custo) || 0), 0)

    const saldoFinanceiro =
      resultFinDoMes.filter((f) => f.tipo === 'receita').reduce((acc, f) => acc + (parseFloat(f.valor) || 0), 0) -
      resultFinDoMes.filter((f) => f.tipo === 'despesa').reduce((acc, f) => acc + (parseFloat(f.valor) || 0), 0)

    const totalDespesas = despesasDoMes.reduce((acc, d) => acc + (parseFloat(d.valor) || 0), 0)

    const lucroLiquido = receita - totalDeducoes - custoVariavel + saldoFinanceiro - totalDespesas
    const margem = receita > 0 ? (lucroLiquido / receita) * 100 : 0

    return { mes: m, receita, lucroLiquido, margem }
  })
}
