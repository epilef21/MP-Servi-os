import { describe, it, expect } from 'vitest'
import { fmtDate, fmtBRL, getLucro, maskPhone, maskCNPJ } from '../utils/formatters'

// UTIL-01: fmtDate
describe('fmtDate', () => {
  it('retorna "—" para null', () => {
    expect(fmtDate(null)).toBe('—')
  })

  it('retorna "—" para undefined', () => {
    expect(fmtDate(undefined)).toBe('—')
  })

  it('retorna string DD/MM/YYYY sem alteracao (passthrough)', () => {
    expect(fmtDate('15/01/2024')).toBe('15/01/2024')
  })

  it('converte string YYYY-MM-DD para DD/MM/YYYY', () => {
    expect(fmtDate('2024-03-07')).toBe('07/03/2024')
  })

  it('formata Firestore Timestamp via toDate() — janeiro (mes 0)', () => {
    // new Date(year, monthIndex, day) — local timezone, sem risco de off-by-one UTC
    const ts = { toDate: () => new Date(2024, 0, 15) }
    expect(fmtDate(ts)).toBe('15/01/2024')
  })

  it('formata Firestore Timestamp via toDate() — dezembro (mes 11)', () => {
    const ts = { toDate: () => new Date(2024, 11, 31) }
    expect(fmtDate(ts)).toBe('31/12/2024')
  })

  it('adiciona zero a esquerda em dia e mes de um digito', () => {
    const ts = { toDate: () => new Date(2024, 2, 5) } // 5 de marco
    expect(fmtDate(ts)).toBe('05/03/2024')
  })

  it('retorna "—" para string sem formato reconhecido (sem separadores)', () => {
    expect(fmtDate('naodata')).toBe('—')
  })
})

// UTIL-02: fmtBRL
describe('fmtBRL', () => {
  it('formata numero inteiro positivo', () => {
    expect(fmtBRL(100)).toBe('R$ 100,00')
  })

  it('formata numero decimal com duas casas', () => {
    expect(fmtBRL(99.9)).toBe('R$ 99,90')
  })

  it('formata string numerica', () => {
    expect(fmtBRL('250.50')).toBe('R$ 250,50')
  })

  it('formata zero', () => {
    expect(fmtBRL(0)).toBe('R$ 0,00')
  })

  it('retorna "—" para string nao-numerica', () => {
    expect(fmtBRL('abc')).toBe('—')
  })

  it('retorna "—" para undefined', () => {
    expect(fmtBRL(undefined)).toBe('—')
  })

  it('usa virgula como separador decimal (padrao pt-BR)', () => {
    expect(fmtBRL(1234.56)).toBe('R$ 1234,56')
  })
})

// UTIL-03: getLucro
describe('getLucro', () => {
  it('calcula lucro basico: (mo_seguradora - valor_prestador) + valor_deslocamento', () => {
    expect(getLucro({ mo_seguradora: '300', valor_prestador: '200', valor_deslocamento: '50' })).toBe(150)
  })

  it('retorna null quando todos os campos sao undefined (nao 0)', () => {
    expect(getLucro({ mo_seguradora: undefined, valor_prestador: undefined, valor_deslocamento: undefined })).toBeNull()
  })

  it('retorna null quando todos os campos sao string vazia', () => {
    expect(getLucro({ mo_seguradora: '', valor_prestador: '', valor_deslocamento: '' })).toBeNull()
  })

  it('calcula quando apenas mo_seguradora tem valor', () => {
    expect(getLucro({ mo_seguradora: '500', valor_prestador: '0', valor_deslocamento: '0' })).toBe(500)
  })

  it('calcula quando mo_seguradora e menor que valor_prestador (lucro negativo)', () => {
    expect(getLucro({ mo_seguradora: '100', valor_prestador: '200', valor_deslocamento: '0' })).toBe(-100)
  })

  it('calcula com valor_deslocamento contribuindo positivamente', () => {
    expect(getLucro({ mo_seguradora: '200', valor_prestador: '150', valor_deslocamento: '30' })).toBe(80)
  })
})

// UTIL-04: maskPhone e maskCNPJ
describe('maskPhone', () => {
  it('mascara celular com 11 digitos: (XX) XXXXX-XXXX', () => {
    expect(maskPhone('11987654321')).toBe('(11) 98765-4321')
  })

  it('mascara fixo com 10 digitos: (XX) XXXX-XXXX', () => {
    expect(maskPhone('1134567890')).toBe('(11) 3456-7890')
  })

  it('remove caracteres nao-numericos antes de mascarar', () => {
    expect(maskPhone('(11) 98765-4321')).toBe('(11) 98765-4321')
  })

  it('limita a 11 digitos (ignora excedente)', () => {
    expect(maskPhone('119876543211111')).toBe('(11) 98765-4321')
  })

  it('retorna digitos sem mascara para entrada parcial menor que 6 digitos', () => {
    const result = maskPhone('11')
    expect(result).toBe('11')
  })
})

describe('maskCNPJ', () => {
  it('mascara CNPJ completo: XX.XXX.XXX/XXXX-XX', () => {
    expect(maskCNPJ('12345678000195')).toBe('12.345.678/0001-95')
  })

  it('remove caracteres nao-numericos antes de mascarar', () => {
    expect(maskCNPJ('12.345.678/0001-95')).toBe('12.345.678/0001-95')
  })

  it('limita a 14 digitos (ignora excedente)', () => {
    expect(maskCNPJ('123456780001951234')).toBe('12.345.678/0001-95')
  })

  it('mascara entrada parcial', () => {
    const result = maskCNPJ('12345')
    expect(result).toBe('12.345')
  })
})
