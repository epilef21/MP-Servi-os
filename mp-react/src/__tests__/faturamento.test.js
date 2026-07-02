import { describe, it, expect } from 'vitest'
import {
  calcularDataPrevista, proximoDiaUtil, getDivergenciaFat,
  digitosCodigo, getRegrasFaturamento, REGRAS_FATURAMENTO_PADRAO,
  SEGS_COM_CODIGO, SEGS_AUTO_NUM_ASSIST, STATUS_FATURAVEIS,
} from '../utils/faturamento'

// FAT-07: calculo da data prevista por calendario com fallback e config editavel
describe('calcularDataPrevista', () => {
  it('Mapfre 01–10 → dia 01 do mês seguinte', () => {
    expect(calcularDataPrevista('Mapfre', '2026-06-05', null).data).toBe('2026-07-01')
  })

  it('Mapfre 11–25 → dia 16 do mês seguinte', () => {
    expect(calcularDataPrevista('Mapfre', '2026-06-15', null).data).toBe('2026-07-16')
  })

  it('Mapfre 26–31 → dia 01 do 2º mês, empurrado p/ dia útil (01/08 sáb → 03/08)', () => {
    expect(calcularDataPrevista('Mapfre', '2026-06-29', null).data).toBe('2026-08-03')
  })

  it('Allianz 01–03 → dia 13 mesmo mês, empurrado (13/06 sáb → 15/06)', () => {
    expect(calcularDataPrevista('Allianz', '2026-06-02', null).data).toBe('2026-06-15')
  })

  it('Allianz 04–10 → dia 25 do mesmo mês', () => {
    expect(calcularDataPrevista('Allianz', '2026-06-07', null).data).toBe('2026-06-25')
  })

  it('Allianz 11–20 → dia 03 do mês seguinte', () => {
    expect(calcularDataPrevista('Allianz', '2026-06-15', null).data).toBe('2026-07-03')
  })

  it('Allianz 21–25 → dia 13 do mês seguinte', () => {
    expect(calcularDataPrevista('Allianz', '2026-06-23', null).data).toBe('2026-07-13')
  })

  it('Allianz 26–31 → naoFaturavel, data null (FAT-08)', () => {
    const r = calcularDataPrevista('Allianz', '2026-06-28', null)
    expect(r.naoFaturavel).toBe(true)
    expect(r.data).toBeNull()
  })

  it('Mondial usa o mesmo calendário da Allianz (26–31 naoFaturavel)', () => {
    const r = calcularDataPrevista('Mondial', '2026-06-28', null)
    expect(r.naoFaturavel).toBe(true)
    expect(r.data).toBeNull()
  })

  it('seguradora sem calendário (Tempo) → semCalendario, data null', () => {
    const r = calcularDataPrevista('Tempo', '2026-06-10', null)
    expect(r.semCalendario).toBe(true)
    expect(r.data).toBeNull()
  })

  it('seguradora sem calendário (Maxpar) → semCalendario, data null', () => {
    const r = calcularDataPrevista('Maxpar', '2026-06-10', null)
    expect(r.semCalendario).toBe(true)
    expect(r.data).toBeNull()
  })

  it('usa faixas customizadas do config quando presentes', () => {
    const cfg = { calendarioFaturamento: { Mapfre: { faixas: [{ diaDe: 1, diaAte: 31, addMeses: 0, diaPagto: 20 }] } } }
    expect(calcularDataPrevista('Mapfre', '2026-06-05', cfg).data).toBe('2026-06-22') // 20/06 sáb → segunda 22/06
  })

  it('dataEmissao vazia/inválida → semCalendario, data null (guard T-07-01)', () => {
    const r = calcularDataPrevista('Mapfre', '', null)
    expect(r.semCalendario).toBe(true)
    expect(r.data).toBeNull()
  })

  it('dataEmissao undefined → semCalendario, data null (guard T-07-01)', () => {
    const r = calcularDataPrevista('Mapfre', undefined, null)
    expect(r.semCalendario).toBe(true)
    expect(r.data).toBeNull()
  })
})

describe('proximoDiaUtil', () => {
  it('sábado 01/08/2026 vira segunda 03/08', () => {
    expect(proximoDiaUtil(new Date(2026, 7, 1)).getDate()).toBe(3)
  })

  it('dia útil permanece inalterado', () => {
    const d = proximoDiaUtil(new Date(2026, 6, 1)) // 01/07/2026 quarta
    expect(d.getDate()).toBe(1)
  })

  it('domingo vira segunda', () => {
    // 05/07/2026 é domingo
    const d = proximoDiaUtil(new Date(2026, 6, 5))
    expect(d.getDate()).toBe(6)
  })
})

describe('getDivergenciaFat', () => {
  it('valores iguais → bateu true, diff 0', () => {
    expect(getDivergenciaFat('130', '130')).toEqual({ diff: 0, bateu: true })
  })

  it('código maior que OS → diff positivo, bateu false', () => {
    expect(getDivergenciaFat('150', '130')).toEqual({ diff: 20, bateu: false })
  })

  it('valor vazio no código → diff negativo', () => {
    expect(getDivergenciaFat('', '130')).toEqual({ diff: -130, bateu: false })
  })
})

describe('digitosCodigo', () => {
  it('Mapfre = 8', () => { expect(digitosCodigo('Mapfre')).toBe(8) })
  it('Allianz = 2', () => { expect(digitosCodigo('Allianz')).toBe(2) })
  it('Mondial = 2', () => { expect(digitosCodigo('Mondial')).toBe(2) })
})

describe('getRegrasFaturamento', () => {
  it('retorna faixas customizadas do config quando presentes', () => {
    const cfg = { calendarioFaturamento: { Mapfre: { faixas: [{ diaDe: 1, diaAte: 31, addMeses: 0, diaPagto: 5 }] } } }
    expect(getRegrasFaturamento(cfg, 'Mapfre')).toEqual(cfg.calendarioFaturamento.Mapfre.faixas)
  })

  it('retorna faixas padrão quando config é null', () => {
    expect(getRegrasFaturamento(null, 'Mapfre')).toEqual(REGRAS_FATURAMENTO_PADRAO.Mapfre.faixas)
  })

  it('retorna null para seguradora sem calendário (Tempo)', () => {
    expect(getRegrasFaturamento(null, 'Tempo')).toBeNull()
  })
})

describe('grupos de seguradora', () => {
  it('Mapfre e Allianz têm código; Tempo e Maxpar entram pelo num_assist', () => {
    expect(SEGS_COM_CODIGO).toContain('Mapfre')
    expect(SEGS_AUTO_NUM_ASSIST).toEqual(['Tempo', 'Maxpar'])
    expect(STATUS_FATURAVEIS).toEqual(['processado', 'enviado'])
  })
})
