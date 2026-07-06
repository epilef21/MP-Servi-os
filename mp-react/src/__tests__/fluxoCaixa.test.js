import { describe, it, expect } from 'vitest'
import {
  mesDeData, dataEntradaNota, fluxoCaixaDoMes,
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
