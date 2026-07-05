import { describe, it, expect } from 'vitest'
import {
  statusDespesa, diasParaVencer, dataVencimentoDoMes, resumoAlertas,
} from '../utils/contasPagar'

describe('statusDespesa', () => {
  it('retorna pago quando há data_pagamento', () => {
    const despesa = { data_vencimento: '2026-07-01', data_pagamento: '2026-07-01' }
    expect(statusDespesa(despesa, '2026-07-05')).toBe('pago')
  })

  it('retorna atrasado quando vencimento passou e não foi paga', () => {
    const despesa = { data_vencimento: '2026-07-01' }
    expect(statusDespesa(despesa, '2026-07-05')).toBe('atrasado')
  })

  it('retorna pendente quando vencimento é futuro', () => {
    const despesa = { data_vencimento: '2026-07-10' }
    expect(statusDespesa(despesa, '2026-07-05')).toBe('pendente')
  })

  it('retorna pendente no dia do vencimento (hoje === vencimento)', () => {
    const despesa = { data_vencimento: '2026-07-05' }
    expect(statusDespesa(despesa, '2026-07-05')).toBe('pendente')
  })

  it('despesa sem data_vencimento nunca é atrasado (legado) — pendente', () => {
    const despesa = {}
    expect(statusDespesa(despesa, '2026-07-05')).toBe('pendente')
  })

  it('despesa sem data_vencimento mas com data_pagamento — pago (legado)', () => {
    const despesa = { data_pagamento: '2026-06-20' }
    expect(statusDespesa(despesa, '2026-07-05')).toBe('pago')
  })
})

describe('diasParaVencer', () => {
  it('retorna null sem data de vencimento', () => {
    expect(diasParaVencer(undefined, '2026-07-05')).toBeNull()
    expect(diasParaVencer('', '2026-07-05')).toBeNull()
  })

  it('retorna 0 no dia do vencimento', () => {
    expect(diasParaVencer('2026-07-05', '2026-07-05')).toBe(0)
  })

  it('retorna positivo para vencimento futuro', () => {
    expect(diasParaVencer('2026-07-10', '2026-07-05')).toBe(5)
  })

  it('retorna negativo para vencimento passado', () => {
    expect(diasParaVencer('2026-07-01', '2026-07-05')).toBe(-4)
  })

  it('calcula corretamente na virada de mês', () => {
    expect(diasParaVencer('2026-08-02', '2026-07-31')).toBe(2)
  })
})

describe('dataVencimentoDoMes', () => {
  it('dia 10 em julho retorna 2026-07-10', () => {
    expect(dataVencimentoDoMes(10, '2026-07')).toBe('2026-07-10')
  })

  it('clamp: dia 31 em mês de 30 dias vira o último dia real (abril)', () => {
    expect(dataVencimentoDoMes(31, '2026-04')).toBe('2026-04-30')
  })

  it('clamp: dia 30 em fevereiro não bissexto vira 28', () => {
    expect(dataVencimentoDoMes(30, '2026-02')).toBe('2026-02-28')
  })

  it('fevereiro bissexto: dia 30 vira 29', () => {
    expect(dataVencimentoDoMes(30, '2024-02')).toBe('2024-02-29')
  })

  it('dia inválido (0) retorna null', () => {
    expect(dataVencimentoDoMes(0, '2026-07')).toBeNull()
  })

  it('dia inválido (32) retorna null', () => {
    expect(dataVencimentoDoMes(32, '2026-07')).toBeNull()
  })

  it('mesRef inválido retorna null', () => {
    expect(dataVencimentoDoMes(10, 'invalido')).toBeNull()
  })
})

describe('resumoAlertas', () => {
  const hojeISO = '2026-07-05'

  it('conta a vencer em até 7 dias, atrasadas, e ignora pagas', () => {
    const despesas = [
      { data_vencimento: '2026-07-01', data_pagamento: '2026-07-01' }, // pago — ignorada
      { data_vencimento: '2026-07-01' }, // atrasada
      { data_vencimento: '2026-07-04' }, // atrasada
      { data_vencimento: '2026-07-05' }, // a vencer (0 dias)
      { data_vencimento: '2026-07-12' }, // a vencer (7 dias)
      { data_vencimento: '2026-07-20' }, // futura além de 7 dias — não conta
      {}, // sem vencimento — não conta
    ]
    const resumo = resumoAlertas(despesas, hojeISO)
    expect(resumo).toEqual({ aVencer: 2, atrasadas: 2, total: 4 })
  })

  it('lista vazia retorna zeros', () => {
    expect(resumoAlertas([], hojeISO)).toEqual({ aVencer: 0, atrasadas: 0, total: 0 })
  })

  it('lida com despesas undefined sem lançar erro', () => {
    expect(() => resumoAlertas(undefined, hojeISO)).not.toThrow()
    expect(resumoAlertas(undefined, hojeISO)).toEqual({ aVencer: 0, atrasadas: 0, total: 0 })
  })
})
