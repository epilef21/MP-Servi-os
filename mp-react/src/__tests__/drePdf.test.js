import { describe, it, expect } from 'vitest'
import { montarLinhasDre } from '../utils/drePdf'

function baseDre(overrides = {}) {
  return {
    qtdOS: 5,
    receitaOS: 1000,
    receitaParticulares: 200,
    margemMaterial: 0,
    receitaTotal: 1200,
    deducoes: [],
    totalDeducoes: 0,
    receitaLiquida: 1200,
    custoTecnicos: 300,
    custoMaterial: 100,
    custoParticulares: 0,
    custoVariavelTotal: 400,
    lucroBruto: 800,
    despesasFin: 0,
    receitasFin: 0,
    saldoFinanceiro: 0,
    resultFinanceiro: [],
    despesasPorGrupo: {},
    totalDespesas: 0,
    lucroLiquido: 800,
    margemLiquida: 66.7,
    ...overrides,
  }
}

describe('montarLinhasDre', () => {
  it('secao "(+) Receita Bruta" aparece antes de "(=) LUCRO LIQUIDO"', () => {
    const linhas = montarLinhasDre(baseDre())
    const idxReceita = linhas.findIndex(l => l.label === '(+) Receita Bruta')
    const idxLucro = linhas.findIndex(l => l.tipo === 'resultado' && l.label.includes('LUCRO LIQUIDO'))
    expect(idxReceita).toBeGreaterThanOrEqual(0)
    expect(idxLucro).toBeGreaterThan(idxReceita)
  })

  it('com deducoes vazio, ha linha explicativa em vez de linhas de imposto', () => {
    const linhas = montarLinhasDre(baseDre({ deducoes: [] }))
    const aviso = linhas.find(l => l.label.includes('Nenhum imposto'))
    expect(aviso).toBeTruthy()
  })

  it('com deducoes preenchido, gera uma linha por deducao (sem o aviso)', () => {
    const linhas = montarLinhasDre(baseDre({
      deducoes: [{ descricao: 'ISS', valor: 50 }, { descricao: 'ICMS', valor: 30 }],
      totalDeducoes: 80,
      receitaLiquida: 1120,
    }))
    const aviso = linhas.find(l => l.label.includes('Nenhum imposto'))
    expect(aviso).toBeUndefined()
    expect(linhas.find(l => l.label === 'ISS' && l.valor === 50)).toBeTruthy()
    expect(linhas.find(l => l.label === 'ICMS' && l.valor === 30)).toBeTruthy()
  })

  it('com margemMaterial === 0 a linha "Margem em Material" NAO aparece', () => {
    const linhas = montarLinhasDre(baseDre({ margemMaterial: 0 }))
    expect(linhas.find(l => l.label === 'Margem em Material')).toBeUndefined()
  })

  it('com margemMaterial !== 0 a linha "Margem em Material" aparece', () => {
    const linhas = montarLinhasDre(baseDre({ margemMaterial: 120 }))
    const linha = linhas.find(l => l.label === 'Margem em Material')
    expect(linha).toBeTruthy()
    expect(linha.valor).toBe(120)
  })

  it('a ultima linha "resultado" e o LUCRO LIQUIDO com valor === dre.lucroLiquido', () => {
    const dre = baseDre({ lucroLiquido: 654.32 })
    const linhas = montarLinhasDre(dre)
    const resultados = linhas.filter(l => l.tipo === 'resultado')
    const ultimo = resultados[resultados.length - 1]
    expect(ultimo.label).toContain('LUCRO LIQUIDO')
    expect(ultimo.valor).toBe(654.32)
  })

  it('despesasPorGrupo com 1 grupo gera cabecalho do grupo + item + subtotal', () => {
    const dre = baseDre({
      despesasPorGrupo: {
        pessoal: {
          label: '👤 Pessoal',
          itens: [{ descricao: 'Salario Joao', valor: 2000 }],
          subtotal: 2000,
        },
      },
      totalDespesas: 2000,
    })
    const linhas = montarLinhasDre(dre)
    const idxHeader = linhas.findIndex(l => l.tipo === 'secao' && l.label === '👤 Pessoal')
    expect(idxHeader).toBeGreaterThanOrEqual(0)
    const item = linhas[idxHeader + 1]
    expect(item.tipo).toBe('linha')
    expect(item.label).toBe('Salario Joao')
    expect(item.valor).toBe(2000)
    const subtotal = linhas[idxHeader + 2]
    expect(subtotal.tipo).toBe('subtotal')
    expect(subtotal.label).toContain('Subtotal')
    expect(subtotal.valor).toBe(2000)
  })

  it('quando despesasPorGrupo esta vazio, mostra aviso de nenhuma despesa lancada', () => {
    const linhas = montarLinhasDre(baseDre({ despesasPorGrupo: {} }))
    expect(linhas.find(l => l.label.includes('Nenhuma despesa lancada'))).toBeTruthy()
  })

  it('margemLiquida entra no label do lucro liquido', () => {
    const linhas = montarLinhasDre(baseDre({ margemLiquida: 23.4 }))
    const lucro = linhas.find(l => l.tipo === 'resultado' && l.label.includes('LUCRO LIQUIDO'))
    expect(lucro.label).toContain('23.4')
    expect(lucro.label.toUpperCase()).toContain('MARGEM')
  })
})
