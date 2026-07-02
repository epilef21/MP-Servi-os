// ============================================================
// ROTA SERVICE — Otimização de rota dos atendimentos do dia
//
// APIs gratuitas (sem chave):
//   - Nominatim (OpenStreetMap): endereço → lat/lng
//   - OSRM público: matriz de tempos/distâncias e traçado da rota
//
// Regras de prioridade (definidas pelo admin na tela de rota):
//   'primeiro' → travada no início da rota, na ordem escolhida
//   'manha'    → deve vir antes de qualquer parada da tarde
//   'tarde'    → só entra depois das paradas da manhã
//   'livre'    → encaixada onde adicionar menos desvio
//
// A rota é "aberta": começa na partida e termina na última
// parada (o técnico não precisa voltar ao ponto de origem).
// ============================================================

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const OSRM_URL      = 'https://router.project-osrm.org'

// ── Fila do Nominatim ────────────────────────────────────────
// A política de uso do Nominatim permite no máximo 1 requisição
// por segundo. Esta fila garante o intervalo mesmo se várias
// geocodificações forem pedidas de uma vez.
let ultimaChamadaNominatim = 0
const INTERVALO_NOMINATIM_MS = 1100

async function aguardarVezNominatim() {
  const agora  = Date.now()
  const espera = ultimaChamadaNominatim + INTERVALO_NOMINATIM_MS - agora
  if (espera > 0) await new Promise(r => setTimeout(r, espera))
  ultimaChamadaNominatim = Date.now()
}

// ── Geocodificação ───────────────────────────────────────────

// Consulta única ao Nominatim. Retorna { lat, lng } ou null.
async function consultarNominatim(query) {
  await aguardarVezNominatim()
  const params = new URLSearchParams({
    format: 'json',
    limit: '1',
    countrycodes: 'br',
    q: query,
  })
  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { 'Accept-Language': 'pt-BR' },
  })
  if (!res.ok) throw new Error(`Nominatim respondeu ${res.status}`)
  const data = await res.json()
  if (!data.length) return null
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

// Tipos de logradouro (para detectar prefixo duplicado tipo "AV AVENIDA X")
const TIPO_LOGRADOURO = /^(av|avenida|r|rua|al|alameda|tv|trav|travessa|rod|rodovia|estr|estrada|pc|praca|praça)\.?$/i

// Limpa o endereço como vem dos portais das seguradoras:
//   "AV AVENIDA BRIGADEIRO GOMES - RESIDENCIAL VALE VERDE"
//   → { rua: 'AVENIDA BRIGADEIRO GOMES', bairro: 'RESIDENCIAL VALE VERDE' }
// Também remove vírgulas soltas/duplicadas e espaços extras.
export function limparEndereco(enderecoBruto) {
  const texto = String(enderecoBruto || '')
    .replace(/\s*,\s*(?=,|$)/g, '')  // vírgulas duplicadas ou penduradas
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,]+|[\s,]+$/g, '')

  // separa "rua - bairro" (hífen com espaços; hífen de nome próprio fica)
  const [ruaParte, ...resto] = texto.split(/\s+-\s+/)
  let rua = ruaParte.trim()
  const bairro = resto.join(' ').replace(/[:,]\s*$/, '').trim()

  // remove tipo de logradouro duplicado no início ("AV AVENIDA", "R R.")
  const tokens = rua.split(/\s+/)
  if (tokens.length >= 2 && TIPO_LOGRADOURO.test(tokens[0]) && TIPO_LOGRADOURO.test(tokens[1])) {
    tokens.shift()
    rua = tokens.join(' ')
  }
  return { rua, bairro }
}

// Converte um endereço em coordenadas com tentativas em cascata:
//   1ª: rua limpa + número + cidade
//   2ª: rua limpa + cidade (centro da rua)
//   3ª: bairro + cidade (localização aproximada)
// Retorna { lat, lng, aproximado } ou null se nada for encontrado.
//
// `endereco` no formato do projeto: "Rua X - Bairro" (número separado)
export async function geocodificarEndereco({ endereco, numero, cidade }) {
  const cidadeLimpa = (cidade || '').replace(/-/g, ' ').replace(/\s{2,}/g, ' ').trim()
  const { rua, bairro } = limparEndereco(endereco)
  if (!rua && !bairro) return null

  const montar = partes => partes.filter(Boolean).join(', ')
  const tentativas = []
  if (rua && numero) tentativas.push({ q: montar([rua, numero, cidadeLimpa, 'Brasil']), aproximado: false })
  if (rua)           tentativas.push({ q: montar([rua, cidadeLimpa, 'Brasil']),         aproximado: false })
  if (bairro)        tentativas.push({ q: montar([bairro, cidadeLimpa, 'Brasil']),      aproximado: true })

  for (const { q, aproximado } of tentativas) {
    const coord = await consultarNominatim(q)
    if (coord) return { ...coord, aproximado }
  }
  return null
}

// ── Matriz de tempos/distâncias (OSRM Table) ─────────────────

// Recebe lista de pontos [{ lat, lng }, ...] e retorna:
//   { duracoes: number[][] (segundos), distancias: number[][] (metros) }
// A posição [i][j] é o custo de ir do ponto i ao ponto j de carro.
export async function buscarMatrizDistancias(pontos) {
  const coords = pontos.map(p => `${p.lng},${p.lat}`).join(';')
  const res = await fetch(
    `${OSRM_URL}/table/v1/driving/${coords}?annotations=duration,distance`
  )
  if (!res.ok) throw new Error(`OSRM respondeu ${res.status}`)
  const data = await res.json()
  if (data.code !== 'Ok') throw new Error(`OSRM: ${data.code}`)
  return { duracoes: data.durations, distancias: data.distances }
}

// ── Traçado final da rota (OSRM Route) ───────────────────────

// Recebe os pontos JÁ na ordem otimizada e retorna o desenho da
// rota pelas ruas + totais exatos:
//   { geometria: [[lat,lng],...], distanciaKm, duracaoMin }
export async function buscarGeometriaRota(pontosOrdenados) {
  const coords = pontosOrdenados.map(p => `${p.lng},${p.lat}`).join(';')
  const res = await fetch(
    `${OSRM_URL}/route/v1/driving/${coords}?overview=full&geometries=geojson`
  )
  if (!res.ok) throw new Error(`OSRM respondeu ${res.status}`)
  const data = await res.json()
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error(`OSRM: ${data.code}`)
  const rota = data.routes[0]
  return {
    // GeoJSON vem como [lng, lat]; Leaflet usa [lat, lng]
    geometria:   rota.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    distanciaKm: rota.distance / 1000,
    duracaoMin:  rota.duration / 60,
  }
}

// ── Algoritmo de otimização ──────────────────────────────────

// Custo total (em segundos) de uma sequência de índices na matriz
function custoRota(ordem, duracoes) {
  let total = 0
  for (let i = 0; i < ordem.length - 1; i++) {
    total += duracoes[ordem[i]][ordem[i + 1]]
  }
  return total
}

// Vizinho mais próximo: a partir de `origem`, visita sempre o
// ponto restante mais perto. Retorna os índices na ordem visitada.
function nearestNeighbor(origem, indices, duracoes) {
  const restantes = [...indices]
  const ordem = []
  let atual = origem
  while (restantes.length) {
    let melhorIdx = 0
    for (let i = 1; i < restantes.length; i++) {
      if (duracoes[atual][restantes[i]] < duracoes[atual][restantes[melhorIdx]]) {
        melhorIdx = i
      }
    }
    atual = restantes.splice(melhorIdx, 1)[0]
    ordem.push(atual)
  }
  return ordem
}

// Insere cada índice "livre" na posição da rota onde ele adiciona
// o menor desvio (inserção mais barata). `posMinima` impede inserir
// antes do bloco travado ("primeiro").
function insercaoMaisBarata(rota, livres, duracoes, posMinima) {
  const resultado = [...rota]
  for (const livre of livres) {
    let melhorPos = -1
    let melhorCusto = Infinity
    // posições possíveis: entre posMinima e o fim (inclusive após o último)
    for (let pos = posMinima; pos <= resultado.length; pos++) {
      const antes  = resultado[pos - 1]
      const depois = pos < resultado.length ? resultado[pos] : null
      const custoAdd = depois === null
        ? duracoes[antes][livre]                                        // vira a última parada
        : duracoes[antes][livre] + duracoes[livre][depois] - duracoes[antes][depois]
      if (custoAdd < melhorCusto) { melhorCusto = custoAdd; melhorPos = pos }
    }
    resultado.splice(melhorPos, 0, livre)
  }
  return resultado
}

// Verifica se uma ordem respeita as restrições:
//   - o bloco "primeiro" permanece intacto no início (após a partida)
//   - nenhuma parada da manhã aparece depois de uma da tarde
function ordemValida(ordem, prioridadePorIndice, blocoFixo) {
  // bloco fixo: posições 1..blocoFixo.length devem ser exatamente ele
  for (let i = 0; i < blocoFixo.length; i++) {
    if (ordem[i + 1] !== blocoFixo[i]) return false
  }
  // manhã nunca depois da tarde
  let viuTarde = false
  for (const idx of ordem) {
    const p = prioridadePorIndice[idx]
    if (p === 'tarde') viuTarde = true
    if (p === 'manha' && viuTarde) return false
  }
  return true
}

// Melhoria 2-opt com restrições: tenta inverter trechos da rota e
// aceita a inversão apenas se reduzir o tempo total E continuar
// respeitando prioridades. Repete até não haver melhoria.
function melhorar2opt(ordem, duracoes, prioridadePorIndice, blocoFixo) {
  let rota = [...ordem]
  let melhorou = true
  while (melhorou) {
    melhorou = false
    // posição 0 é a partida — nunca entra na inversão
    for (let i = 1; i < rota.length - 1; i++) {
      for (let j = i + 1; j < rota.length; j++) {
        const nova = [
          ...rota.slice(0, i),
          ...rota.slice(i, j + 1).reverse(),
          ...rota.slice(j + 1),
        ]
        if (!ordemValida(nova, prioridadePorIndice, blocoFixo)) continue
        if (custoRota(nova, duracoes) < custoRota(rota, duracoes)) {
          rota = nova
          melhorou = true
        }
      }
    }
  }
  return rota
}

// ── Função principal ─────────────────────────────────────────

// Otimiza a ordem das paradas respeitando prioridades.
//
// `pontos`: array onde o índice 0 é SEMPRE a partida. Cada item:
//   { lat, lng, prioridade?: 'primeiro'|'manha'|'tarde'|'livre', ordemPrimeiro?: number }
//
// Retorna:
//   { ordem: number[],        // índices de `pontos` na sequência final (começa com 0)
//     duracaoTotalMin: number,
//     distanciaTotalKm: number }
export async function otimizarRota(pontos) {
  if (pontos.length < 2) throw new Error('É preciso ao menos a partida e uma parada.')

  const { duracoes, distancias } = await buscarMatrizDistancias(pontos)

  // Separa os índices (1..n) por prioridade
  const prioridadePorIndice = {}
  const fixos = [], manha = [], tarde = [], livres = []
  for (let i = 1; i < pontos.length; i++) {
    const p = pontos[i].prioridade || 'livre'
    prioridadePorIndice[i] = p
    if      (p === 'primeiro') fixos.push(i)
    else if (p === 'manha')    manha.push(i)
    else if (p === 'tarde')    tarde.push(i)
    else                       livres.push(i)
  }
  // Bloco travado na ordem escolhida pelo admin
  fixos.sort((a, b) => (pontos[a].ordemPrimeiro ?? 0) - (pontos[b].ordemPrimeiro ?? 0))

  // 1) Partida + bloco travado
  let rota = [0, ...fixos]

  // 2) Manhã pelo vizinho mais próximo, partindo do fim do bloco
  rota = rota.concat(nearestNeighbor(rota[rota.length - 1], manha, duracoes))

  // 3) Tarde pelo vizinho mais próximo, na sequência
  rota = rota.concat(nearestNeighbor(rota[rota.length - 1], tarde, duracoes))

  // 4) Livres encaixadas onde custam menos (nunca antes do bloco travado)
  rota = insercaoMaisBarata(rota, livres, duracoes, 1 + fixos.length)

  // 5) Polimento 2-opt respeitando as restrições
  rota = melhorar2opt(rota, duracoes, prioridadePorIndice, fixos)

  // Totais estimados pela matriz (o traçado final refina com buscarGeometriaRota)
  let duracaoSeg = 0, distanciaM = 0
  for (let i = 0; i < rota.length - 1; i++) {
    duracaoSeg += duracoes[rota[i]][rota[i + 1]]
    distanciaM += distancias[rota[i]][rota[i + 1]]
  }

  return {
    ordem: rota,
    duracaoTotalMin:  duracaoSeg / 60,
    distanciaTotalKm: distanciaM / 1000,
  }
}

// ── Link do Google Maps na ordem otimizada ───────────────────
// Fallback prático: abre a navegação no celular com as paradas
// já na sequência calculada.
export function buildLinkGoogleMaps(pontosOrdenados) {
  const enc = pontosOrdenados.map(p => `${p.lat},${p.lng}`)
  const origem  = enc[0]
  const destino = enc[enc.length - 1]
  const wps = enc.length > 2 ? `&waypoints=${enc.slice(1, -1).join('|')}` : ''
  return `https://www.google.com/maps/dir/?api=1&origin=${origem}&destination=${destino}${wps}&travelmode=driving`
}
