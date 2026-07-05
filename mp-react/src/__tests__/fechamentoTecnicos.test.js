import { describe, it, expect } from 'vitest'
import {
  normNome, osDoMes, agruparPorTecnico, acharFechamento, statusFechamento,
} from '../utils/fechamentoTecnicos'

// Helper para simular o Timestamp do Firestore (r.criado_em?.toDate?.())
const ts = iso => ({ toDate: () => new Date(iso) })

describe('normNome', () => {
  it('trim + lowercase + colapsa espaços internos', () => {
    expect(normNome('  João  Silva ')).toBe('joão silva')
  })

  it('undefined vira string vazia', () => {
    expect(normNome(undefined)).toBe('')
  })

  it('null vira string vazia', () => {
    expect(normNome(null)).toBe('')
  })

  it('lowercase simples', () => {
    expect(normNome('MAPFRE')).toBe('mapfre')
  })
})

describe('osDoMes', () => {
  it('inclui OS com criado_em dentro do mês de referência', () => {
    const reports = [{ criado_em: ts('2026-07-10T12:00:00Z') }]
    expect(osDoMes(reports, '2026-07')).toHaveLength(1)
  })

  it('exclui OS com criado_em fora do mês de referência', () => {
    const reports = [{ criado_em: ts('2026-06-30T12:00:00Z') }]
    expect(osDoMes(reports, '2026-07')).toHaveLength(0)
  })

  it('ignora OS sem criado_em válido sem lançar erro', () => {
    expect(() => osDoMes([{ id: 'x' }], '2026-07')).not.toThrow()
    expect(osDoMes([{ id: 'x' }], '2026-07')).toEqual([])
  })
})

describe('agruparPorTecnico', () => {
  it('junta OS do mesmo técnico com nome escrito de formas diferentes, somando valor_prestador', () => {
    const reports = [
      { criado_em: ts('2026-07-05T12:00:00Z'), tecnico_nome: 'JOÃO', valor_prestador: 100 },
      { criado_em: ts('2026-07-10T12:00:00Z'), tecnico_nome: 'joão ', valor_prestador: 40 },
      { criado_em: ts('2026-07-15T12:00:00Z'), tecnico_nome: 'Maria', valor_prestador: 200 },
    ]
    const grupos = agruparPorTecnico(reports, '2026-07')
    expect(grupos).toHaveLength(2)
    // ordenado por tecnicoNome (João antes de Maria)
    expect(grupos[0].tecnicoNome).toBe('JOÃO')
    expect(grupos[0].total).toBe(140)
    expect(grupos[0].count).toBe(2)
    expect(grupos[1].tecnicoNome).toBe('Maria')
  })

  it('regressão: OS com APENAS tecnico_nome (sem tecnico_id) agrupa corretamente', () => {
    const reports = [
      { criado_em: ts('2026-07-05T12:00:00Z'), tecnico_nome: 'Carlos', valor_prestador: 50 },
    ]
    const grupos = agruparPorTecnico(reports, '2026-07')
    expect(grupos).toHaveLength(1)
    expect(grupos[0].tecnicoNorm).toBe('carlos')
    expect(grupos[0].count).toBe(1)
    expect(grupos[0].tecnicoId).toBe('')
  })

  it('grupo carrega tecnicoId do primeiro tecnico_id não vazio visto', () => {
    const reports = [
      { criado_em: ts('2026-07-05T12:00:00Z'), tecnico_nome: 'João', tecnico_id: 'tec-1', valor_prestador: 100 },
      { criado_em: ts('2026-07-10T12:00:00Z'), tecnico_nome: 'joão', valor_prestador: 40 },
    ]
    const grupos = agruparPorTecnico(reports, '2026-07')
    expect(grupos).toHaveLength(1)
    expect(grupos[0].tecnicoId).toBe('tec-1')
  })

  it('OS sem tecnico_nome cria grupo "(sem técnico)"', () => {
    const reports = [
      { criado_em: ts('2026-07-05T12:00:00Z'), tecnico_nome: '', valor_prestador: 30 },
    ]
    const grupos = agruparPorTecnico(reports, '2026-07')
    expect(grupos[0].tecnicoNome).toBe('(sem técnico)')
  })

  it('OS de outro mês não entram no agrupamento', () => {
    const reports = [
      { criado_em: ts('2026-06-30T12:00:00Z'), tecnico_nome: 'João', valor_prestador: 100 },
    ]
    const grupos = agruparPorTecnico(reports, '2026-07')
    expect(grupos).toHaveLength(0)
  })
})

describe('acharFechamento', () => {
  it('acha o doc de fechamento por tecnico_norm + mes_referencia', () => {
    const fechamentos = [
      { tecnico_norm: 'joão silva', mes_referencia: '2026-07', status: 'pago' },
    ]
    const achado = acharFechamento(fechamentos, 'joão silva', '2026-07')
    expect(achado).not.toBeNull()
    expect(achado.status).toBe('pago')
  })

  it('devolve null quando técnico não bate', () => {
    const fechamentos = [
      { tecnico_norm: 'joão silva', mes_referencia: '2026-07', status: 'pago' },
    ]
    expect(acharFechamento(fechamentos, 'maria', '2026-07')).toBeNull()
  })
})

describe('statusFechamento', () => {
  it('retorna pago quando status é pago', () => {
    expect(statusFechamento({ status: 'pago' })).toBe('pago')
  })

  it('retorna pendente quando fechamento é null', () => {
    expect(statusFechamento(null)).toBe('pendente')
  })
})
