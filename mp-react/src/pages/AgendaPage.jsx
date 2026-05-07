// ============================================================
// AGENDA PAGE — Visualização do dia por OS agendada
// Rota: /:slug/agenda (protegida por RotaAdmin)
// ============================================================
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { onSnapshot } from 'firebase/firestore'
import { db, collection, query, where, orderBy } from '../firebase.js'
import { useEmpresa } from '../hooks/useEmpresa.js'
import './AgendaPage.css'

const STATUS_META = {
  aguardando_tecnico: { label: '🔔 Aguardando', dot: '#f05a1a' },
  pendente:           { label: '⏳ Pendente',    dot: '#f59e0b' },
  processado:         { label: '✅ Processado',  dot: '#2d8a4e' },
  enviado:            { label: '📤 Enviado',     dot: '#1a3fa8' },
}

const SEG_CORES = {
  'Mapfre':       '#00529b',
  'Porto Seguro': '#003d80',
  'Allianz':      '#003781',
  'Tempo':        '#e8531a',
  'Maxpar':       '#2d8a4e',
  'SulAmérica':   '#e8003d',
}

// Segunda a domingo (semana começa na segunda)
const DIAS_SEMANA_SEG = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function dataHoje() {
  return new Date().toISOString().slice(0, 10)
}

// Retorna array de 7 datas ISO da semana que contém dataISO (Seg–Dom)
function diasDaSemana(dataISO) {
  const d = new Date(dataISO + 'T12:00:00')
  const dow = d.getDay() // 0=dom, 1=seg, ..., 6=sab
  const diffToMon = dow === 0 ? -6 : 1 - dow
  const seg = new Date(d)
  seg.setDate(d.getDate() + diffToMon)
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(seg)
    dd.setDate(seg.getDate() + i)
    return dd.toISOString().slice(0, 10)
  })
}

// "Terça-feira, 7 de maio de 2026"
function dataExtenso(dataISO) {
  const [y, m, d] = dataISO.split('-').map(Number)
  const str = new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function tempoDecorrido(criado_em) {
  if (!criado_em) return ''
  try {
    const criado = criado_em.toDate?.() || new Date(criado_em)
    const diff   = new Date() - criado
    const horas  = Math.floor(diff / (1000 * 60 * 60))
    const dias   = Math.floor(horas / 24)
    if (dias  > 0) return `Aberta há ${dias} dia${dias > 1 ? 's' : ''}`
    if (horas > 0) return `Aberta há ${horas}h`
    return 'Aberta há menos de 1h'
  } catch { return '' }
}

export default function AgendaPage() {
  const navigate = useNavigate()
  const { empresa, config, empresaId, slug, loading: loadingEmpresa } = useEmpresa()

  const [data,          setData]          = useState(dataHoje)
  const [filtroStatus,  setFiltroStatus]  = useState('todos')
  const [filtroTecnico, setFiltroTecnico] = useState('todos')
  const [osList,        setOsList]        = useState([])
  const [osSemana,      setOsSemana]      = useState([])
  const [loadingDia,    setLoadingDia]    = useState(false)
  const [copiado,       setCopiado]       = useState(null)

  // Query semanal — alimenta a mini barra (Seg–Dom da semana atual)
  useEffect(() => {
    if (!empresaId) return
    const dias = diasDaSemana(data)
    const q = query(
      collection(db, `empresas/${empresaId}/checklist`),
      where('data_agendada', '>=', dias[0]),
      where('data_agendada', '<=', dias[6])
    )
    const unsub = onSnapshot(
      q,
      snap => setOsSemana(snap.docs.map(d => ({ id: d.id, data_agendada: d.data().data_agendada }))),
      err  => console.error('[Agenda] Erro query semanal:', err)
    )
    return () => unsub()
  }, [empresaId, data])

  // Query diária — data_agendada + retornos de "ficou na visita" para o mesmo dia
  useEffect(() => {
    if (!empresaId) return
    setLoadingDia(true)

    // Query principal: OS agendadas para o dia
    const qPrincipal = query(
      collection(db, `empresas/${empresaId}/checklist`),
      where('data_agendada', '==', data),
      orderBy('hora_agendada', 'asc')
    )
    // Query secundária: OS "ficou na visita" com data de retorno no dia
    const qRetorno = query(
      collection(db, `empresas/${empresaId}/checklist`),
      where('resultado_visita', '==', 'ficou_visita'),
      where('data_retorno', '==', data)
    )

    let snapPrincipal = null
    let snapRetorno = null
    let unsubPrincipal = null
    let unsubRetorno = null

    function merge() {
      if (snapPrincipal === null || snapRetorno === null) return
      const mapaIds = new Set()
      const lista = []
      snapPrincipal.docs.forEach(d => {
        mapaIds.add(d.id)
        lista.push({ id: d.id, ...d.data() })
      })
      // adiciona retornos que não estejam já na lista principal
      snapRetorno.docs.forEach(d => {
        if (!mapaIds.has(d.id)) lista.push({ id: d.id, ...d.data() })
      })
      setOsList(lista)
      setLoadingDia(false)
    }

    unsubPrincipal = onSnapshot(
      qPrincipal,
      snap => { snapPrincipal = snap; merge() },
      err  => { console.error('[Agenda] Erro query diária:', err); setLoadingDia(false) }
    )
    unsubRetorno = onSnapshot(
      qRetorno,
      snap => { snapRetorno = snap; merge() },
      err  => { console.error('[Agenda] Erro query retorno:', err) }
    )

    return () => { unsubPrincipal?.(); unsubRetorno?.() }
  }, [empresaId, data])

  function diaAnterior() {
    const d = new Date(data + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    setData(d.toISOString().slice(0, 10))
  }

  function proximoDia() {
    const d = new Date(data + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    setData(d.toISOString().slice(0, 10))
  }

  function buildLink(os) {
    return `${window.location.origin}/${slug}?os=${os.id}`
  }

  async function copiarLink(os) {
    const link = buildLink(os)
    try { await navigator.clipboard.writeText(link) } catch {
      const el = document.createElement('textarea')
      el.value = link
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopiado(os.id)
    setTimeout(() => setCopiado(null), 2000)
  }

  function whatsapp(os) {
    const tel = (os.tel_segurado || '').replace(/\D/g, '')
    if (!tel) return
    const nomeEmpresa = config?.nome || empresa?.nome || 'AssistHub'
    const hora = os.hora_agendada || ''
    const msg = encodeURIComponent(
      `Olá ${os.nome_segurado}, tudo bem?\n` +
      `Sou da *${nomeEmpresa}*, referente ao atendimento de *${os.servico || 'serviço'}*.\n` +
      `Confirmando seu agendamento para hoje${hora ? ` às *${hora}*` : ''}.\n` +
      `Endereço: ${os.endereco || ''}, ${os.cidade || ''}.\n` +
      `Qualquer dúvida, estamos à disposição!`
    )
    window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank')
  }

  function mapa(os) {
    const addr = encodeURIComponent(`${os.endereco || ''}, ${os.cidade || ''}`)
    window.open(`https://www.google.com/maps/search/?api=1&query=${addr}`, '_blank')
  }

  function tracarRota() {
    const validos = osList.filter(o => o.status !== 'cancelada' && o.endereco)
    if (!validos.length) { alert('Nenhum endereço válido para traçar rota.'); return }
    const enc     = validos.map(o => encodeURIComponent(`${o.endereco}, ${o.cidade}`))
    const origem  = enc[0]
    const destino = enc[enc.length - 1]
    const wps     = enc.length > 2 ? `&waypoints=${enc.slice(1, -1).join('|')}` : ''
    window.open(
      `https://www.google.com/maps/dir/?api=1&origin=${origem}&destination=${destino}${wps}&travelmode=driving`,
      '_blank'
    )
  }

  // Técnicos únicos presentes no dia
  const tecnicosNoDia = useMemo(() => {
    const s = new Set()
    osList.forEach(o => {
      const n = o.tecnico_nome || o.tecnico_nome_manual
      if (n) s.add(n)
    })
    return [...s].sort()
  }, [osList])

  // Lista filtrada por status e técnico
  const filtrada = useMemo(() => {
    return osList.filter(o => {
      const st = o.status || 'pendente'
      if (filtroStatus !== 'todos' && st !== filtroStatus) return false
      if (filtroTecnico !== 'todos') {
        if ((o.tecnico_nome || o.tecnico_nome_manual || '') !== filtroTecnico) return false
      }
      return true
    })
  }, [osList, filtroStatus, filtroTecnico])

  // Contagem por status
  const stats = useMemo(() => {
    const c = { aguardando_tecnico: 0, pendente: 0, processado: 0, enviado: 0 }
    osList.forEach(o => {
      const s = o.status || 'pendente'
      if (s in c) c[s]++
    })
    return c
  }, [osList])

  // Dados da mini barra semanal
  const semana = useMemo(() => {
    const dias = diasDaSemana(data)
    return dias.map((dataISO, i) => ({
      dataISO,
      diaN:  parseInt(dataISO.split('-')[2]),
      abrev: DIAS_SEMANA_SEG[i],
      count: osSemana.filter(o => o.data_agendada === dataISO).length,
    }))
  }, [data, osSemana])

  const hoje = dataHoje()

  if (loadingEmpresa) return <div className="ag-loading">Carregando...</div>

  return (
    <div className="ag-root">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="ag-header">
        <button className="ag-back" onClick={() => navigate(`/${slug}/admin`)}>← Admin</button>
        <div className="ag-header-center">
          <span className="ag-title">📅 Agenda</span>
          {(config?.nome || empresa?.nome) && (
            <span className="ag-empresa-nome">{config?.nome || empresa?.nome}</span>
          )}
        </div>
        <button className="ag-rota-btn" onClick={tracarRota}>🗺️ Rota</button>
      </header>

      {/* ── Navegação de dia ───────────────────────────────────── */}
      <div className="ag-nav">
        <button className="ag-nav-arrow" onClick={diaAnterior} aria-label="Dia anterior">‹</button>
        <div className="ag-nav-center">
          <span className="ag-nav-label">{dataExtenso(data)}</span>
          <label className="ag-nav-date-wrap" title="Ir para data">
            📅
            <input
              type="date"
              className="ag-nav-date"
              value={data}
              onChange={e => setData(e.target.value)}
            />
          </label>
        </div>
        <button className="ag-nav-arrow" onClick={proximoDia} aria-label="Próximo dia">›</button>
      </div>

      {/* ── Mini barra semanal ─────────────────────────────────── */}
      <div className="ag-semana">
        {semana.map(({ dataISO, diaN, abrev, count }) => {
          const isSel  = dataISO === data
          const isHoje = dataISO === hoje && !isSel
          return (
            <button
              key={dataISO}
              className={`ag-semana-dia${isSel ? ' ag-dia-sel' : ''}${isHoje ? ' ag-dia-hoje' : ''}`}
              onClick={() => setData(dataISO)}
            >
              <span className="ag-semana-abrev">{abrev}</span>
              <span className="ag-semana-n">{diaN}</span>
              <span className="ag-semana-count">{count > 0 ? count : '·'}</span>
            </button>
          )
        })}
      </div>

      {/* ── Filtros ────────────────────────────────────────────── */}
      <div className="ag-controls">
        <div className="ag-filtros">
          {['todos', 'aguardando_tecnico', 'pendente', 'processado', 'enviado'].map(s => (
            <button
              key={s}
              className={`ag-filtro-btn ag-f-${s}${filtroStatus === s ? ' active' : ''}`}
              onClick={() => setFiltroStatus(s)}
            >
              {s === 'todos' ? 'Todos' : (STATUS_META[s]?.label ?? s)}
            </button>
          ))}
        </div>
        {tecnicosNoDia.length > 0 && (
          <select
            className="ag-select-tec"
            value={filtroTecnico}
            onChange={e => setFiltroTecnico(e.target.value)}
          >
            <option value="todos">👷 Todos os técnicos</option>
            {tecnicosNoDia.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
      </div>

      {/* ── Stats ──────────────────────────────────────────────── */}
      <div className="ag-stats">
        {[
          { key: 'aguardando_tecnico', label: 'Aguardando'  },
          { key: 'pendente',           label: 'Pendente'    },
          { key: 'processado',         label: 'Processado'  },
          { key: 'enviado',            label: 'Enviado'     },
        ].map(({ key, label }) => (
          <div key={key} className={`ag-stat ag-stat-${key}`}>
            <span className="ag-stat-n">{stats[key]}</span>
            <span className="ag-stat-l">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Lista ──────────────────────────────────────────────── */}
      {loadingDia ? (
        <div className="ag-loading">Carregando OS do dia...</div>
      ) : filtrada.length === 0 ? (
        <div className="ag-empty">
          <span className="ag-empty-icon">📭</span>
          <p>Nenhuma OS agendada para este dia.</p>
          {(filtroStatus !== 'todos' || filtroTecnico !== 'todos') && (
            <button
              className="ag-limpar-filtro"
              onClick={() => { setFiltroStatus('todos'); setFiltroTecnico('todos') }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="ag-lista-header">
            {filtrada.length} OS agendada{filtrada.length !== 1 ? 's' : ''} para este dia
          </div>

          {/* Tabela — visível em desktop */}
          <div className="ag-table-wrap">
            <table className="ag-table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Status</th>
                  <th>Técnico</th>
                  <th>Cliente</th>
                  <th>Serviço</th>
                  <th>Cidade</th>
                  <th>Seguradora</th>
                  <th>Tempo</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrada.map(os => {
                  const st   = os.status || 'pendente'
                  const meta = STATUS_META[st] ?? STATUS_META.pendente
                  return (
                    <tr key={os.id} className={`ag-tr ag-tr-${st}`}>
                      <td className="ag-hora">{os.hora_agendada || '—'}</td>
                      <td className="ag-status-cell">
                        <span className="ag-dot" style={{ background: meta.dot }} />
                        <span>{meta.label}</span>
                      </td>
                      <td>{os.tecnico_nome || os.tecnico_nome_manual || '—'}</td>
                      <td>
                        <span className="ag-td-nome">{os.nome_segurado || '—'}</span>
                        {os.tel_segurado && <span className="ag-td-tel">{os.tel_segurado}</span>}
                      </td>
                      <td>{os.servico || '—'}</td>
                      <td>{os.cidade || '—'}</td>
                      <td>
                        <span
                          className="ag-seg-badge"
                          style={{ background: SEG_CORES[os.seguradora] || 'var(--primary)' }}
                        >
                          {os.seguradora || '—'}
                        </span>
                      </td>
                      <td className="ag-tempo-cell">{tempoDecorrido(os.criado_em)}</td>
                      <td className="ag-acoes">
                        <button className="ag-btn ag-btn-wa"  onClick={() => whatsapp(os)} title="WhatsApp">💬</button>
                        <button className="ag-btn ag-btn-map" onClick={() => mapa(os)}     title="Mapa">📍</button>
                        <button className="ag-btn ag-btn-os"  onClick={() => navigate(`/${slug}/admin`)} title="Ver OS">📋</button>
                        <button
                          className={`ag-btn ag-btn-link${copiado === os.id ? ' ag-btn-copiado' : ''}`}
                          onClick={() => copiarLink(os)}
                          title="Copiar link do técnico"
                        >
                          {copiado === os.id ? '✓' : '📲'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Cards — visível em mobile */}
          <div className="ag-cards">
            {filtrada.map(os => {
              const st    = os.status || 'pendente'
              const meta  = STATUS_META[st] ?? STATUS_META.pendente
              const tec   = os.tecnico_nome || os.tecnico_nome_manual
              const tempo = tempoDecorrido(os.criado_em)
              return (
                <div key={os.id} className={`ag-card ag-card-${st}`}>
                  <div className="ag-card-header">
                    <span className="ag-card-hora">🕐 {os.hora_agendada || 'Sem horário'}</span>
                    <span className="ag-status-badge" style={{ color: meta.dot }}>
                      <span className="ag-dot" style={{ background: meta.dot }} />
                      {meta.label}
                    </span>
                    <span
                      className="ag-seg-badge"
                      style={{ background: SEG_CORES[os.seguradora] || 'var(--primary)' }}
                    >
                      {os.seguradora || '—'}
                    </span>
                  </div>

                  <div className="ag-card-body">
                    <p className="ag-card-cliente">{os.nome_segurado || '—'}</p>
                    {os.tel_segurado && <p className="ag-card-tel">{os.tel_segurado}</p>}
                    {(os.servico || os.cidade) && (
                      <p className="ag-card-info">
                        {os.servico && <>🔧 {os.servico}</>}
                        {os.servico && os.cidade && ' · '}
                        {os.cidade}
                      </p>
                    )}
                    {tec   && <p className="ag-card-tec">👷 {tec}</p>}
                    {tempo && <p className="ag-card-tempo">⏱️ {tempo}</p>}
                  </div>

                  <div className="ag-card-acoes">
                    <button className="ag-btn ag-btn-wa"  onClick={() => whatsapp(os)}>💬</button>
                    <button className="ag-btn ag-btn-map" onClick={() => mapa(os)}>📍</button>
                    <button className="ag-btn ag-btn-os"  onClick={() => navigate(`/${slug}/admin`)}>📋 Ver OS</button>
                    <button
                      className={`ag-btn ag-btn-link${copiado === os.id ? ' ag-btn-copiado' : ''}`}
                      onClick={() => copiarLink(os)}
                    >
                      {copiado === os.id ? '✓ Copiado' : '📲 Link'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
