// ============================================================
// Testes do otimizador de rota — rotaService.js
// A matriz OSRM é simulada (fetch mockado): pontos numa linha
// reta onde duração = distância entre posições.
// ============================================================
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { otimizarRota, buildLinkGoogleMaps, limparEndereco } from '../utils/rotaService.js'

// Gera matriz de durações a partir de posições numa linha reta:
// duração(i→j) = |pos[i] - pos[j]| segundos
function matrizDeLinha(posicoes) {
  return posicoes.map(a => posicoes.map(b => Math.abs(a - b)))
}

function mockOsrmTable(posicoes) {
  const durations = matrizDeLinha(posicoes)
  const distances = durations.map(linha => linha.map(v => v * 100)) // metros fictícios
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ code: 'Ok', durations, distances }),
  }))
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.unstubAllGlobals())

describe('otimizarRota — prioridades', () => {
  it('manhã vem antes da tarde mesmo quando a tarde está mais perto', async () => {
    // partida em 0; parada 1 (tarde) a 5 min; parada 2 (manhã) a 50 min.
    // Sem prioridade, o vizinho mais próximo iria primeiro na 1.
    mockOsrmTable([0, 5, 50])
    const pontos = [
      { lat: 0, lng: 0 },                          // partida
      { lat: 0, lng: 0, prioridade: 'tarde' },
      { lat: 0, lng: 0, prioridade: 'manha' },
    ]
    const { ordem } = await otimizarRota(pontos)
    expect(ordem).toEqual([0, 2, 1])
  })

  it('paradas travadas como "primeiro" abrem a rota na ordem escolhida', async () => {
    mockOsrmTable([0, 10, 20, 30])
    const pontos = [
      { lat: 0, lng: 0 },                                             // partida
      { lat: 0, lng: 0, prioridade: 'livre' },
      { lat: 0, lng: 0, prioridade: 'primeiro', ordemPrimeiro: 2 },
      { lat: 0, lng: 0, prioridade: 'primeiro', ordemPrimeiro: 1 },
    ]
    const { ordem } = await otimizarRota(pontos)
    // as duas travadas vêm logo após a partida, respeitando ordemPrimeiro
    expect(ordem.slice(0, 3)).toEqual([0, 3, 2])
    // a livre fica por último (única posição restante)
    expect(ordem[3]).toBe(1)
  })

  it('livres são encaixadas onde não adicionam desvio', async () => {
    // linha: partida(0) → primeiro(40) → livre(30) → manhã(20) → tarde(10)
    // a livre em 30 cabe "no caminho" entre 40 e 20 sem custo extra
    mockOsrmTable([0, 10, 20, 30, 40])
    const pontos = [
      { lat: 0, lng: 0 },                                             // partida
      { lat: 0, lng: 0, prioridade: 'tarde' },
      { lat: 0, lng: 0, prioridade: 'manha' },
      { lat: 0, lng: 0, prioridade: 'livre' },
      { lat: 0, lng: 0, prioridade: 'primeiro', ordemPrimeiro: 1 },
    ]
    const { ordem, duracaoTotalMin } = await otimizarRota(pontos)
    expect(ordem).toEqual([0, 4, 3, 2, 1])
    // 40 + 10 + 10 + 10 = 70 segundos ÷ 60
    expect(duracaoTotalMin).toBeCloseTo(70 / 60, 5)
  })

  it('sem prioridades, escolhe a ordem de menor caminho', async () => {
    // pontos fora de ordem na lista: 0, 30, 10, 20 → melhor rota é 0→10→20→30
    mockOsrmTable([0, 30, 10, 20])
    const pontos = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0 },
    ]
    const { ordem, distanciaTotalKm } = await otimizarRota(pontos)
    expect(ordem).toEqual([0, 2, 3, 1])
    // 30 seg de percurso × 100 m ÷ 1000 = 3 km fictícios
    expect(distanciaTotalKm).toBeCloseTo(3, 5)
  })

  it('exige ao menos uma parada além da partida', async () => {
    await expect(otimizarRota([{ lat: 0, lng: 0 }])).rejects.toThrow()
  })
})

describe('limparEndereco — sujeira dos portais das seguradoras', () => {
  it('remove tipo de logradouro duplicado ("AV AVENIDA")', () => {
    const { rua, bairro } = limparEndereco('AV AVENIDA BRIGADEIRO EDUARDO GOMES - RESIDENCIAL VALE VERDE')
    expect(rua).toBe('AVENIDA BRIGADEIRO EDUARDO GOMES')
    expect(bairro).toBe('RESIDENCIAL VALE VERDE')
  })

  it('remove duplicação abreviada ("R R. DA ESTACAO")', () => {
    const { rua, bairro } = limparEndereco('R R. DA ESTACAO - ARACELI')
    expect(rua).toBe('R. DA ESTACAO')
    expect(bairro).toBe('ARACELI')
  })

  it('limpa vírgulas soltas e espaços duplicados', () => {
    const { rua } = limparEndereco('Rua kazuma Takamoto , ,  ')
    expect(rua).toBe('Rua kazuma Takamoto')
  })

  it('separa bairro com sufixo de dois-pontos ("- Região:")', () => {
    const { rua, bairro } = limparEndereco('AV AVENIDA JOAO SPADOTO - Região:')
    expect(rua).toBe('AVENIDA JOAO SPADOTO')
    expect(bairro).toBe('Região')
  })

  it('não mexe em endereço já limpo', () => {
    const { rua, bairro } = limparEndereco('Rua Vereador Manoel Barbosa Silva')
    expect(rua).toBe('Rua Vereador Manoel Barbosa Silva')
    expect(bairro).toBe('')
  })
})

describe('buildLinkGoogleMaps', () => {
  it('monta origem, destino e waypoints na ordem dada', () => {
    const link = buildLinkGoogleMaps([
      { lat: -22.1, lng: -49.9 },
      { lat: -22.2, lng: -49.8 },
      { lat: -22.3, lng: -49.7 },
    ])
    expect(link).toContain('origin=-22.1,-49.9')
    expect(link).toContain('destination=-22.3,-49.7')
    expect(link).toContain('waypoints=-22.2,-49.8')
  })
})
