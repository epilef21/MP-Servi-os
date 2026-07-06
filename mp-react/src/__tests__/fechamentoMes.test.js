import { describe, it, expect } from 'vitest'
import { estaFechado, formatarFechadoEm } from '../utils/fechamentoMes'

describe('estaFechado', () => {
  it('retorna true quando doc.fechado === true', () => {
    expect(estaFechado({ fechado: true })).toBe(true)
  })

  it('retorna false quando doc.fechado === false', () => {
    expect(estaFechado({ fechado: false })).toBe(false)
  })

  it('retorna false para null', () => {
    expect(estaFechado(null)).toBe(false)
  })

  it('retorna false para undefined', () => {
    expect(estaFechado(undefined)).toBe(false)
  })

  it('retorna false para objeto vazio', () => {
    expect(estaFechado({})).toBe(false)
  })
})

describe('formatarFechadoEm', () => {
  it('aceita Date e formata DD/MM/AAAA', () => {
    expect(formatarFechadoEm(new Date(2026, 5, 3))).toBe('03/06/2026')
  })

  it('aceita objeto tipo Firestore Timestamp (toDate())', () => {
    const timestamp = { toDate: () => new Date(2026, 5, 3) }
    expect(formatarFechadoEm(timestamp)).toBe('03/06/2026')
  })

  it('aceita string ISO YYYY-MM-DD', () => {
    expect(formatarFechadoEm('2026-06-03')).toBe('03/06/2026')
  })

  it('retorna string vazia para null', () => {
    expect(formatarFechadoEm(null)).toBe('')
  })

  it('retorna string vazia para undefined', () => {
    expect(formatarFechadoEm(undefined)).toBe('')
  })

  it('retorna string vazia para valor inválido', () => {
    expect(formatarFechadoEm('nao e uma data')).toBe('')
  })
})
