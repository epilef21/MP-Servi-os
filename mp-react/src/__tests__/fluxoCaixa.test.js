import { describe, it, expect } from 'vitest'
import {
  mesDeData, dataEntradaNota, fluxoCaixaDoMes, ultimos12Meses, serieEvolucao12Meses,
} from '../utils/fluxoCaixa'

describe('mesDeData', () => {
  it('extrai YYYY-MM de uma data ISO válida', () => {
    expect(mesDeData('2026-07-10')).toBe('2026-07')
  })

  it('retorna null para string vazia', () => {
    expect(mesDeData('')).toBeNull()
  })

  it('retorna null para null/undefined', () => {
    expect(mesDeData(null)).toBeNull()
    expect(mesDeData(undefined)).toBeNull()
  })

  it('retorna null para formato inválido', () => {
    expect(mesDeData('invalido')).toBeNull()
    expect(mesDeData('2026/07/10')).toBeNull()
  })
})

describe('dataEntradaNota', () => {
  it('usa pago_em quando presente', () => {
    const nota = { pago_em: '2026-07-10', data_prevista: '2026-07-01', data_emissao: '2026-06-01' }
    expect(dataEntradaNota(nota)).toBe('2026-07-10')
  })

  it('usa data_prevista quando pago_em é null (fallback legado)', () => {
    const nota = { pago_em: null, data_prevista: '2026-07-01', data_emissao: '2026-06-01' }
    expect(dataEntradaNota(nota)).toBe('2026-07-01')
  })

  it('usa data_prevista quando pago_em é string vazia', () => {
    const nota = { pago_em: '', data_prevista: '2026-07-01', data_emissao: '2026-06-01' }
    expect(dataEntradaNota(nota)).toBe('2026-07-01')
  })

  it('usa data_emissao quando pago_em e data_prevista ausentes', () => {
    const nota = { pago_em: null, data_prevista: '', data_emissao: '2026-06-01' }
    expect(dataEntradaNota(nota)).toBe('2026-06-01')
  })

  it('retorna string vazia quando nenhuma data existe', () => {
    expect(dataEntradaNota({})).toBe('')
  })
})

describe('fluxoCaixaDoMes', () => {
  const mesRef = '2026-07'

  it('nota paga com pago_em no mês entra nas entradas; fora do mês não entra', () => {
    const notas = [
      { seguradora: 'Mapfre', numero: '1', status: 'paga', pago_em: '2026-07-10', total: 100 },
      { seguradora: 'Mapfre', numero: '2', status: 'paga', pago_em: '2026-06-10', total: 200 },
    ]
    const resultado = fluxoCaixaDoMes({ notas, particulares: [], despesas: [], fechamentos: [] }, mesRef)
    expect(resultado.entradas.notas).toHaveLength(1)
    expect(resultado.entradas.notas[0].numero).toBe('1')
    expect(resultado.entradas.totalNotas).toBe(100)
  })

  it('nota status aguardando nunca entra, mesmo com data_prevista no mês', () => {
    const notas = [
      { seguradora: 'Mapfre', numero: '1', status: 'aguardando', data_prevista: '2026-07-15', total: 500 },
    ]
    const resultado = fluxoCaixaDoMes({ notas, particulares: [], despesas: [], fechamentos: [] }, mesRef)
    expect(resultado.entradas.notas).toHaveLength(0)
    expect(resultado.entradas.totalNotas).toBe(0)
  })

  it('nota paga com pago_em null usa data_prevista como fallback; sem data_prevista usa data_emissao', () => {
    const notas = [
      { numero: '1', status: 'paga', pago_em: null, data_prevista: '2026-07-05', total: 100 },
      { numero: '2', status: 'paga', pago_em: null, data_prevista: '', data_emissao: '2026-07-01', total: 50 },
    ]
    const resultado = fluxoCaixaDoMes({ notas, particulares: [], despesas: [], fechamentos: [] }, mesRef)
    expect(resultado.entradas.notas).toHaveLength(2)
    expect(resultado.entradas.totalNotas).toBe(150)
  })

  it('particular com mes_referencia === mesRef entra nas entradas pelo valor_recebido', () => {
    const particulares = [
      { descricao: 'Conserto', mes_referencia: '2026-07', valor_recebido: 300 },
      { descricao: 'Fora do mês', mes_referencia: '2026-06', valor_recebido: 400 },
    ]
    const resultado = fluxoCaixaDoMes({ notas: [], particulares, despesas: [], fechamentos: [] }, mesRef)
    expect(resultado.entradas.particulares).toHaveLength(1)
    expect(resultado.entradas.totalParticulares).toBe(300)
    expect(resultado.entradas.total).toBe(300)
  })

  it('despesa com data_pagamento no mês entra nas saídas, mesmo que mes_referencia seja outro mês', () => {
    const despesas = [
      { descricao: 'Aluguel', mes_referencia: '2026-06', data_pagamento: '2026-07-05', valor: 1000 },
    ]
    const resultado = fluxoCaixaDoMes({ notas: [], particulares: [], despesas, fechamentos: [] }, mesRef)
    expect(resultado.saidas.despesas).toHaveLength(1)
    expect(resultado.saidas.totalDespesas).toBe(1000)
  })

  it('despesa com data_pagamento vazia NÃO entra nas saídas', () => {
    const despesas = [
      { descricao: 'Luz', mes_referencia: '2026-07', data_pagamento: '', valor: 200 },
    ]
    const resultado = fluxoCaixaDoMes({ notas: [], particulares: [], despesas, fechamentos: [] }, mesRef)
    expect(resultado.saidas.despesas).toHaveLength(0)
    expect(resultado.saidas.totalDespesas).toBe(0)
  })

  it('fechamento status pago com pago_em no mês entra nas saídas pelo total', () => {
    const fechamentos = [
      { tecnico: 'João', status: 'pago', pago_em: '2026-07-20', total: 800 },
      { tecnico: 'Maria', status: 'pago', pago_em: '2026-06-20', total: 900 },
    ]
    const resultado = fluxoCaixaDoMes({ notas: [], particulares: [], despesas: [], fechamentos }, mesRef)
    expect(resultado.saidas.tecnicos).toHaveLength(1)
    expect(resultado.saidas.totalTecnicos).toBe(800)
  })

  it('saldo === entradas.total − saidas.total', () => {
    const notas = [{ numero: '1', status: 'paga', pago_em: '2026-07-10', total: 1000 }]
    const despesas = [{ data_pagamento: '2026-07-05', valor: 300 }]
    const resultado = fluxoCaixaDoMes({ notas, particulares: [], despesas, fechamentos: [] }, mesRef)
    expect(resultado.entradas.total).toBe(1000)
    expect(resultado.saidas.total).toBe(300)
    expect(resultado.saldo).toBe(700)
  })

  it('listas vazias retornam tudo zero, saldo zero, sem NaN', () => {
    const resultado = fluxoCaixaDoMes({ notas: [], particulares: [], despesas: [], fechamentos: [] }, mesRef)
    expect(resultado.entradas.total).toBe(0)
    expect(resultado.saidas.total).toBe(0)
    expect(resultado.saldo).toBe(0)
  })

  it('arrays undefined/null são tratados como vazios sem lançar erro', () => {
    expect(() => fluxoCaixaDoMes({}, mesRef)).not.toThrow()
    const resultado = fluxoCaixaDoMes({}, mesRef)
    expect(resultado.saldo).toBe(0)
  })

  it('valores em string somam via parseFloat', () => {
    const notas = [{ numero: '1', status: 'paga', pago_em: '2026-07-10', total: '150.50' }]
    const resultado = fluxoCaixaDoMes({ notas, particulares: [], despesas: [], fechamentos: [] }, mesRef)
    expect(resultado.entradas.totalNotas).toBe(150.5)
  })
})

describe('ultimos12Meses', () => {
  it('retorna 12 meses terminando em mesRef, em ordem cronológica', () => {
    const meses = ultimos12Meses('2026-07')
    expect(meses).toHaveLength(12)
    expect(meses[11]).toBe('2026-07')
    expect(meses[0]).toBe('2025-08')
  })

  it('cruza a virada de ano corretamente', () => {
    const meses = ultimos12Meses('2026-01')
    expect(meses).toHaveLength(12)
    expect(meses[11]).toBe('2026-01')
    expect(meses[0]).toBe('2025-02')
  })
})

function osComData(ano, mesIndex0, dia, campos) {
  return {
    criado_em: { toDate: () => new Date(Date.UTC(ano, mesIndex0, dia)) },
    ...campos,
  }
}

describe('serieEvolucao12Meses', () => {
  it('retorna 12 objetos alinhados com ultimos12Meses', () => {
    const serie = serieEvolucao12Meses({}, '2026-07')
    expect(serie).toHaveLength(12)
    expect(serie[11].mes).toBe('2026-07')
    expect(serie.map((s) => s.mes)).toEqual(ultimos12Meses('2026-07'))
  })

  it('mês sem nenhum dado retorna receita/lucroLiquido/margem zerados, sem NaN', () => {
    const serie = serieEvolucao12Meses({}, '2026-07')
    for (const mesObj of serie) {
      expect(mesObj.receita).toBe(0)
      expect(mesObj.lucroLiquido).toBe(0)
      expect(mesObj.margem).toBe(0)
      expect(Number.isNaN(mesObj.margem)).toBe(false)
    }
  })

  it('margem é 0 quando receita do mês é 0 (sem divisão por zero)', () => {
    const despesas = [{ mes_referencia: '2026-07', valor: 500 }]
    const serie = serieEvolucao12Meses({ despesas }, '2026-07')
    const jul = serie.find((s) => s.mes === '2026-07')
    expect(jul.receita).toBe(0)
    expect(jul.margem).toBe(0)
  })

  it('paridade com a cascata do calcularDRE: OS + particular + dedução + despesa + resultado financeiro', () => {
    const reports = [
      osComData(2026, 6, 15, {
        mo_seguradora: 100, valor_deslocamento: 20, material_cobrado_seguradora: 30,
        valor_prestador: 40, material_custo_real: 10, margem_material: 5,
      }),
    ]
    const particulares = [{ mes_referencia: '2026-07', valor_recebido: 200, valor_custo: 50 }]
    const deducoes = [{ mes_referencia: '2026-07', valor: 15 }]
    const despesas = [{ mes_referencia: '2026-07', valor: 60 }]
    const resultadoFinanceiro = [
      { tipo: 'receita', mes_referencia: '2026-07', valor: 25 },
      { tipo: 'despesa', mes_referencia: '2026-07', valor: 5 },
    ]

    const serie = serieEvolucao12Meses(
      { reports, particulares, despesas, deducoes, resultadoFinanceiro },
      '2026-07'
    )
    const jul = serie.find((s) => s.mes === '2026-07')

    // Cascata replicada manualmente (mesma fórmula do calcularDRE):
    const receitaOS = 100 + 20 + 30
    const receitaPart = 200
    const receita = receitaOS + receitaPart // 350
    const totalDeducoes = 15
    const custoVariavel = (40 + 10) + 50 // 100
    const saldoFinanceiro = 25 - 5 // 20
    const totalDespesas = 60
    const lucroLiquidoEsperado = receita - totalDeducoes - custoVariavel + saldoFinanceiro - totalDespesas
    const margemEsperada = (lucroLiquidoEsperado / receita) * 100

    expect(jul.receita).toBe(receita)
    expect(jul.lucroLiquido).toBe(lucroLiquidoEsperado)
    expect(jul.margem).toBeCloseTo(margemEsperada, 6)
  })

  it('OS fora do mês (criado_em em outro mês) não entra na receita do mês', () => {
    const reports = [
      osComData(2026, 5, 20, { mo_seguradora: 999, valor_deslocamento: 0, material_cobrado_seguradora: 0 }),
    ]
    const serie = serieEvolucao12Meses({ reports }, '2026-07')
    const jul = serie.find((s) => s.mes === '2026-07')
    const jun = serie.find((s) => s.mes === '2026-06')
    expect(jul.receita).toBe(0)
    expect(jun.receita).toBe(999)
  })
})
