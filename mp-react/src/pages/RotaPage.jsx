// ============================================================
// ROTA PAGE — Otimização da rota de atendimentos do dia
// Rota: /:slug/rota (protegida por RotaAdmin)
//
// Fluxo em 3 passos:
//   1. Partida  → admin informa de onde vai sair (lembra a última)
//   2. Seleção  → escolhe as OS do dia e define prioridades
//   3. Resultado→ mapa com pinos numerados + resumo + Google Maps
//
// APIs gratuitas: Nominatim (geocodificação) e OSRM (rotas).
// lat/lng são salvos na OS após a 1ª geocodificação (cache).
// ============================================================
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { db, collection, query, where, getDocs, doc, updateDoc } from '../firebase.js'
import { useEmpresa } from '../hooks/useEmpresa.js'
import {
  geocodificarEndereco, otimizarRota, buscarGeometriaRota, buildLinkGoogleMaps,
} from '../utils/rotaService.js'
import './RotaPage.css'

// ── Helpers ─────────────────────────────────────────────────

function dataHoje() { return new Date().toISOString().slice(0, 10) }

// Prioridade inicial sugerida a partir da faixa de horário da OS
function prioridadeSugerida(os) {
  if (os.faixa_horario === 'manha') return 'manha'
  if (os.faixa_horario === 'tarde') return 'tarde'
  return 'livre'
}

const LABEL_PRIORIDADE = {
  primeiro: '📌 Primeiro',
  manha:    '🌅 Manhã',
  tarde:    '☀️ Tarde',
  livre:    '⚪ Livre',
}

// Pino numerado do mapa (divIcon evita o bug de ícone do Leaflet no Vite)
function pinoNumerado(numero, ehPartida = false) {
  return L.divIcon({
    className: 'rota-marker',
    html: `<div class="rota-marker-pin${ehPartida ? ' partida' : ''}"><span>${ehPartida ? '🏁' : numero}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  })
}

// Enquadra o mapa em todos os pontos da rota
function AjustarMapa({ pontos }) {
  const map = useMap()
  useEffect(() => {
    if (!pontos.length) return
    map.fitBounds(pontos.map(p => [p.lat, p.lng]), { padding: [36, 36] })
  }, [pontos, map])
  return null
}

// ── Componente principal ─────────────────────────────────────

export default function RotaPage() {
  const navigate = useNavigate()
  const { empresaId, slug, loading: loadingEmpresa } = useEmpresa()

  const [etapa, setEtapa] = useState(1)

  // Passo 1 — partida
  const [partidaTexto,     setPartidaTexto]     = useState('')
  const [partidaCoord,     setPartidaCoord]     = useState(null)
  const [geocodandoPartida, setGeocodandoPartida] = useState(false)
  const [erroPartida,      setErroPartida]      = useState(null)
  const [ultimaPartida,    setUltimaPartida]    = useState(null)

  // Passo 2 — OS do dia
  const [data,         setData]         = useState(dataHoje)
  const [osList,       setOsList]       = useState([])
  const [loadingDia,   setLoadingDia]   = useState(false)
  const [selecionadas, setSelecionadas] = useState({})   // { osId: true }
  const [prioridades,  setPrioridades]  = useState({})   // { osId: 'manha'|... }
  const [ordemPrimeiro, setOrdemPrimeiro] = useState([]) // [osId] na ordem de marcação

  // Cálculo / resultado
  const [calculando, setCalculando] = useState(false)
  const [faseCalculo, setFaseCalculo] = useState('')
  const [erroCalculo, setErroCalculo] = useState(null)
  const [resultado,   setResultado]   = useState(null)

  // Carrega a última partida usada (fica só neste navegador)
  useEffect(() => {
    if (!empresaId) return
    try {
      const salva = localStorage.getItem(`rota_partida_${empresaId}`)
      if (salva) setUltimaPartida(JSON.parse(salva))
    } catch { /* localStorage indisponível: segue sem memória */ }
  }, [empresaId])

  // ── Passo 2: busca as OS do dia (agendadas + retornos) ─────
  useEffect(() => {
    if (!empresaId || etapa !== 2) return
    let cancelado = false
    async function carregar() {
      setLoadingDia(true)
      try {
        const qAgendadas = query(
          collection(db, `empresas/${empresaId}/checklist`),
          where('data_agendada', '==', data)
        )
        const qRetornos = query(
          collection(db, `empresas/${empresaId}/checklist`),
          where('resultado_visita', '==', 'ficou_visita'),
          where('data_retorno', '==', data)
        )
        const [snapA, snapR] = await Promise.all([getDocs(qAgendadas), getDocs(qRetornos)])
        if (cancelado) return
        const ids = new Set()
        const lista = []
        snapA.docs.forEach(d => { ids.add(d.id); lista.push({ id: d.id, ...d.data() }) })
        snapR.docs.forEach(d => { if (!ids.has(d.id)) lista.push({ id: d.id, ...d.data() }) })
        lista.sort((a, b) => (a.hora_agendada || '99') < (b.hora_agendada || '99') ? -1 : 1)
        setOsList(lista)

        // pré-seleciona o que ainda vai ser atendido e sugere prioridades
        const sel = {}, pri = {}
        lista.forEach(os => {
          const finalizada = ['concluido', 'processado', 'enviado'].includes(os.status)
          if (!finalizada && os.endereco) sel[os.id] = true
          pri[os.id] = prioridadeSugerida(os)
        })
        setSelecionadas(sel)
        setPrioridades(pri)
        setOrdemPrimeiro([])
      } catch (e) {
        if (!cancelado) setErroCalculo('Erro ao buscar as OS do dia: ' + e.message)
      } finally {
        if (!cancelado) setLoadingDia(false)
      }
    }
    carregar()
    return () => { cancelado = true }
  }, [empresaId, data, etapa])

  // ── Passo 1: confirmar partida ─────────────────────────────
  async function confirmarPartida(texto, coordSalva = null) {
    setErroPartida(null)
    const endereco = (texto || '').trim()
    if (!endereco) { setErroPartida('Digite o endereço de partida.'); return }

    // Se veio da "última partida", já temos as coordenadas
    if (coordSalva) {
      setPartidaTexto(endereco)
      setPartidaCoord(coordSalva)
      setEtapa(2)
      return
    }

    setGeocodandoPartida(true)
    try {
      const coord = await geocodificarEndereco({ endereco })
      if (!coord) {
        setErroPartida('Endereço não encontrado. Tente incluir cidade e estado (ex: "Rua X, 100, Marília, SP").')
        return
      }
      setPartidaCoord(coord)
      try {
        localStorage.setItem(`rota_partida_${empresaId}`, JSON.stringify({ endereco, ...coord }))
      } catch { /* sem localStorage, sem memória */ }
      setEtapa(2)
    } catch (e) {
      setErroPartida('Falha ao localizar o endereço: ' + e.message)
    } finally {
      setGeocodandoPartida(false)
    }
  }

  // ── Passo 2: alternar seleção e prioridade ─────────────────
  function toggleOs(osId) {
    setSelecionadas(p => ({ ...p, [osId]: !p[osId] }))
  }

  function mudarPrioridade(osId, valor) {
    setPrioridades(p => ({ ...p, [osId]: valor }))
    setOrdemPrimeiro(prev => {
      const sem = prev.filter(id => id !== osId)
      return valor === 'primeiro' ? [...sem, osId] : sem
    })
  }

  const totalSelecionadas = useMemo(
    () => osList.filter(os => selecionadas[os.id]).length,
    [osList, selecionadas]
  )

  // ── Cálculo da rota ────────────────────────────────────────
  async function calcularRota() {
    const escolhidas = osList.filter(os => selecionadas[os.id])
    if (!escolhidas.length) { setErroCalculo('Selecione ao menos uma OS.'); return }

    setCalculando(true)
    setErroCalculo(null)
    try {
      // 1) Garante coordenadas de cada parada (usa cache lat/lng da OS)
      const localizadas = []
      const naoLocalizadas = []
      for (let i = 0; i < escolhidas.length; i++) {
        const os = escolhidas[i]
        if (os.lat != null && os.lng != null) {
          localizadas.push({ os, lat: os.lat, lng: os.lng })
          continue
        }
        setFaseCalculo(`Localizando endereços (${i + 1}/${escolhidas.length})...`)
        const coord = await geocodificarEndereco({
          endereco: os.endereco, numero: os.numero, cidade: os.cidade,
        })
        if (!coord) { naoLocalizadas.push(os); continue }
        localizadas.push({ os, ...coord })
        // salva o cache na OS — nas próximas rotas não geocodifica de novo
        updateDoc(doc(db, `empresas/${empresaId}/checklist`, os.id), coord)
          .catch(err => console.error('[Rota] Falha ao salvar lat/lng:', err))
      }

      if (!localizadas.length) {
        setErroCalculo('Nenhum endereço pôde ser localizado no mapa. Confira os endereços das OS.')
        return
      }

      // 2) Monta os pontos (índice 0 = partida) e otimiza
      setFaseCalculo('Calculando a melhor ordem...')
      const pontos = [
        { lat: partidaCoord.lat, lng: partidaCoord.lng },
        ...localizadas.map(({ os, lat, lng }) => ({
          lat, lng,
          prioridade: prioridades[os.id] || 'livre',
          ordemPrimeiro: ordemPrimeiro.indexOf(os.id),
        })),
      ]
      const { ordem } = await otimizarRota(pontos)

      // 3) Traçado final pelas ruas + totais exatos
      setFaseCalculo('Traçando o caminho pelas ruas...')
      const pontosOrdenados = ordem.map(idx => idx === 0
        ? { lat: partidaCoord.lat, lng: partidaCoord.lng, partida: true }
        : { ...localizadas[idx - 1], partida: false }
      )
      const { geometria, distanciaKm, duracaoMin } = await buscarGeometriaRota(pontosOrdenados)

      setResultado({ pontosOrdenados, geometria, distanciaKm, duracaoMin, naoLocalizadas })
      setEtapa(3)
    } catch (e) {
      setErroCalculo(
        'Não foi possível calcular a rota agora: ' + e.message +
        '. Os serviços gratuitos de mapa podem oscilar — tente novamente em instantes.'
      )
    } finally {
      setCalculando(false)
      setFaseCalculo('')
    }
  }

  // ── Render ─────────────────────────────────────────────────
  if (loadingEmpresa) {
    return (
      <div className="loading-state" style={{ paddingTop: '20vh' }}>
        <div className="spinner" />
        <p className="loading-text">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="rota-page">
      <header className="rota-header">
        <button className="rota-voltar" onClick={() => navigate(`/${slug}/agenda`)}>← Agenda</button>
        <h1>🗺️ Rota do Dia</h1>
      </header>

      <div className="rota-container">

        {/* Indicador de passos */}
        <div className="rota-passos">
          <div className={`rota-passo ${etapa === 1 ? 'ativo' : 'completo'}`}>1 · Partida</div>
          <div className={`rota-passo ${etapa === 2 ? 'ativo' : etapa > 2 ? 'completo' : ''}`}>2 · Atendimentos</div>
          <div className={`rota-passo ${etapa === 3 ? 'ativo' : ''}`}>3 · Rota</div>
        </div>

        {/* ══ PASSO 1: PARTIDA ══ */}
        {etapa === 1 && (
          <div className="rota-card">
            <h2>🚩 De onde você vai sair?</h2>
            <p className="rota-dica">
              Informe o endereço de onde o técnico inicia o dia (casa ou empresa), com cidade e estado.
            </p>
            <div className="rota-partida-form">
              <input
                type="text"
                value={partidaTexto}
                onChange={e => setPartidaTexto(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmarPartida(partidaTexto)}
                placeholder="Ex: Rua das Flores, 100, Marília, SP"
                className={erroPartida ? 'erro' : ''}
              />
              <button
                className="rota-btn rota-btn-primario"
                disabled={geocodandoPartida}
                onClick={() => confirmarPartida(partidaTexto)}
              >
                {geocodandoPartida ? '⏳ Localizando...' : 'Continuar →'}
              </button>
              {ultimaPartida && (
                <button
                  className="rota-btn rota-btn-secundario"
                  disabled={geocodandoPartida}
                  onClick={() => confirmarPartida(ultimaPartida.endereco, { lat: ultimaPartida.lat, lng: ultimaPartida.lng })}
                >
                  ↩ Usar a última partida: {ultimaPartida.endereco}
                </button>
              )}
            </div>
            {erroPartida && <div className="rota-erro">⚠️ {erroPartida}</div>}
          </div>
        )}

        {/* ══ PASSO 2: SELEÇÃO ══ */}
        {etapa === 2 && !calculando && (
          <>
            <div className="rota-card">
              <h2>📋 Atendimentos do dia</h2>
              <div className="rota-data-row">
                <label>Data:</label>
                <input type="date" value={data} onChange={e => setData(e.target.value)} />
              </div>
              <p className="rota-dica">
                Marque quem entra na rota e ajuste a prioridade. A sugestão vem da faixa de horário da OS.
              </p>

              {loadingDia && (
                <div className="rota-calculando">
                  <div className="spinner" />
                  <p>Buscando OS do dia...</p>
                </div>
              )}

              {!loadingDia && osList.length === 0 && (
                <div className="rota-vazio">📭 Nenhuma OS agendada para esta data.</div>
              )}

              {!loadingDia && osList.map(os => (
                <div className="rota-os-item" key={os.id}>
                  <input
                    type="checkbox"
                    checked={!!selecionadas[os.id]}
                    disabled={!os.endereco}
                    onChange={() => toggleOs(os.id)}
                  />
                  <div className="rota-os-info">
                    <div className="rota-os-nome">
                      {os.nome_segurado || '—'}
                      {prioridades[os.id] === 'primeiro' && (
                        <span className="rota-badge-primeiro">
                          📌 {ordemPrimeiro.indexOf(os.id) + 1}º
                        </span>
                      )}
                    </div>
                    <div className="rota-os-end">
                      📍 {os.endereco ? `${os.endereco}${os.numero ? `, ${os.numero}` : ''} — ${os.cidade || ''}` : 'Sem endereço cadastrado'}
                    </div>
                    <div className="rota-os-meta">
                      🔧 {os.servico || '—'}
                      {os.hora_agendada ? ` · 🕐 ${os.hora_agendada}` : ''}
                      {os.lat != null ? ' · 🗺️ já localizada' : ''}
                    </div>
                  </div>
                  {selecionadas[os.id] && (
                    <select
                      value={prioridades[os.id] || 'livre'}
                      onChange={e => mudarPrioridade(os.id, e.target.value)}
                    >
                      {Object.entries(LABEL_PRIORIDADE).map(([v, lbl]) => (
                        <option key={v} value={v}>{lbl}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>

            {erroCalculo && <div className="rota-erro">⚠️ {erroCalculo}</div>}

            <div className="rota-acao-fixa">
              <button className="rota-btn rota-btn-secundario" onClick={() => setEtapa(1)}>← Partida</button>
              <button
                className="rota-btn rota-btn-primario"
                disabled={totalSelecionadas === 0}
                onClick={calcularRota}
              >
                🧭 Otimizar rota ({totalSelecionadas})
              </button>
            </div>
          </>
        )}

        {/* Loading do cálculo */}
        {calculando && (
          <div className="rota-card rota-calculando">
            <div className="spinner" />
            <p>{faseCalculo || 'Calculando...'}</p>
            <p className="rota-dica" style={{ marginTop: 8 }}>
              A localização de endereços novos leva ~1 segundo cada (limite das APIs gratuitas).
            </p>
          </div>
        )}

        {/* ══ PASSO 3: RESULTADO ══ */}
        {etapa === 3 && resultado && (
          <>
            <div className="rota-resumo-grid">
              <div className="rota-resumo-item">
                <div className="valor">{resultado.pontosOrdenados.length - 1}</div>
                <div className="rotulo">Paradas</div>
              </div>
              <div className="rota-resumo-item">
                <div className="valor">{resultado.distanciaKm.toFixed(1)} km</div>
                <div className="rotulo">Distância</div>
              </div>
              <div className="rota-resumo-item">
                <div className="valor">{Math.round(resultado.duracaoMin)} min</div>
                <div className="rotulo">No trânsito</div>
              </div>
            </div>

            {resultado.naoLocalizadas.length > 0 && (
              <div className="rota-aviso" style={{ marginBottom: 14 }}>
                ⚠️ {resultado.naoLocalizadas.length} endereço(s) não encontrado(s) no mapa e fora da rota:{' '}
                {resultado.naoLocalizadas.map(os => os.nome_segurado || os.endereco).join(', ')}.
                Confira o endereço dessas OS no painel.
              </div>
            )}

            <div className="rota-resultado-grid">
              <div className="rota-mapa-wrap">
                <MapContainer
                  center={[resultado.pontosOrdenados[0].lat, resultado.pontosOrdenados[0].lng]}
                  zoom={13}
                  scrollWheelZoom
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <AjustarMapa pontos={resultado.pontosOrdenados} />
                  <Polyline
                    positions={resultado.geometria}
                    pathOptions={{ color: '#1a3fa8', weight: 5, opacity: .75 }}
                  />
                  {resultado.pontosOrdenados.map((p, i) => (
                    <Marker
                      key={i}
                      position={[p.lat, p.lng]}
                      icon={pinoNumerado(i, p.partida)}
                    >
                      <Popup>
                        {p.partida ? (
                          <strong>🏁 Partida</strong>
                        ) : (
                          <>
                            <strong>{i}º — {p.os.nome_segurado || '—'}</strong><br />
                            📍 {p.os.endereco}{p.os.numero ? `, ${p.os.numero}` : ''}<br />
                            🔧 {p.os.servico || '—'}
                            {p.os.hora_agendada ? <><br />🕐 {p.os.hora_agendada}</> : null}
                          </>
                        )}
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>

              <div className="rota-card">
                <h2>📋 Ordem das visitas</h2>
                <div className="rota-parada">
                  <div className="num partida">🏁</div>
                  <div className="rota-os-info">
                    <div className="rota-os-nome">Partida</div>
                    <div className="rota-os-end">{partidaTexto}</div>
                  </div>
                </div>
                {resultado.pontosOrdenados.slice(1).map((p, i) => (
                  <div className="rota-parada" key={p.os.id}>
                    <div className="num">{i + 1}</div>
                    <div className="rota-os-info">
                      <div className="rota-os-nome">{p.os.nome_segurado || '—'}</div>
                      <div className="rota-os-end">
                        📍 {p.os.endereco}{p.os.numero ? `, ${p.os.numero}` : ''} — {p.os.cidade || ''}
                      </div>
                      <div className="rota-os-meta">
                        {LABEL_PRIORIDADE[prioridades[p.os.id] || 'livre']}
                        {p.os.hora_agendada ? ` · 🕐 ${p.os.hora_agendada}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rota-botoes-final">
              <button className="rota-btn rota-btn-secundario" onClick={() => { setResultado(null); setEtapa(2) }}>
                ← Ajustar seleção
              </button>
              <a
                className="rota-btn rota-btn-verde"
                style={{ textAlign: 'center', textDecoration: 'none' }}
                href={buildLinkGoogleMaps(resultado.pontosOrdenados)}
                target="_blank" rel="noopener noreferrer"
              >
                🚗 Abrir no Google Maps
              </a>
            </div>
            {resultado.pontosOrdenados.length > 11 && (
              <div className="rota-aviso">
                ℹ️ O Google Maps aceita no máximo ~10 paradas por link — as primeiras serão carregadas;
                as demais seguem visíveis no mapa acima.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
