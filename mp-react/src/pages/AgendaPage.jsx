// ============================================================
// AGENDA PAGE — Visualização do dia por OS agendada
// Rota: /:slug/agenda (protegida por RotaAdmin)
// ============================================================
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { onSnapshot } from 'firebase/firestore'
import { db, collection, query, where, orderBy, atualizarOS } from '../firebase.js'
import { useEmpresa } from '../hooks/useEmpresa.js'
import './AgendaPage.css'

const STATUS_META = {
  aguardando_tecnico: { label: '🔔 Aguardando',     dot: '#f05a1a' },
  pendente:           { label: '⏳ Pendente',         dot: '#f59e0b' },
  concluido:          { label: '✅ Concluído',        dot: '#2d8a4e' },
  ficou_visita:       { label: '🔄 Retorno',          dot: '#3b82f6' },
  cliente_ausente:    { label: '🚪 C. Ausente',       dot: '#9ca3af' },
  processado:         { label: '📋 Processado',       dot: '#1a3fa8' },
  enviado:            { label: '📤 Enviado',           dot: '#7c3aed' },
}

const SEG_CORES = {
  'Mapfre':       '#00529b',
  'Porto Seguro': '#003d80',
  'Allianz':      '#003781',
  'Tempo':        '#e8531a',
  'Maxpar':       '#2d8a4e',
  'SulAmérica':   '#e8003d',
}

const TEC_PALETA = [
  '#e74c3c', '#2980b9', '#27ae60', '#8e44ad', '#f39c12',
  '#16a085', '#d35400', '#c0392b', '#1abc9c', '#7f8c8d',
]

const DIAS_SEMANA_SEG = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

// ── Helpers ─────────────────────────────────────────────────

function dataHoje() { return new Date().toISOString().slice(0, 10) }

function diasDaSemana(dataISO) {
  const d = new Date(dataISO + 'T12:00:00')
  const dow = d.getDay()
  const diffToMon = dow === 0 ? -6 : 1 - dow
  const seg = new Date(d)
  seg.setDate(d.getDate() + diffToMon)
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(seg)
    dd.setDate(seg.getDate() + i)
    return dd.toISOString().slice(0, 10)
  })
}

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

function corDoTecnico(nome) {
  if (!nome) return '#9ca3af'
  let hash = 0
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash)
  return TEC_PALETA[Math.abs(hash) % TEC_PALETA.length]
}

function horaParaMin(str) {
  if (!str) return -1
  const [h, m] = str.split(':').map(Number)
  return h * 60 + (m || 0)
}

// Classifica a OS em uma das 4 seções visuais
function getSecao(os) {
  const st = os.status || 'pendente'
  if (st === 'ficou_visita') return 'retorno'
  if (st === 'concluido')    return 'respondidas'
  if (['processado', 'enviado', 'cliente_ausente'].includes(st)) return 'finalizadas'
  return 'a_fazer'
}

// ── Componente principal ─────────────────────────────────────

export default function AgendaPage() {
  const navigate = useNavigate()
  const { empresa, config, empresaId, slug, loading: loadingEmpresa } = useEmpresa()

  const [data,             setData]            = useState(dataHoje)
  const [filtroSecao,      setFiltroSecao]     = useState('todos')
  const [filtroTecnico,    setFiltroTecnico]   = useState('todos')
  const [filtroSeg,        setFiltroSeg]       = useState('todos')
  const [filtroCidade,     setFiltroCidade]    = useState('todos')
  const [osList,           setOsList]          = useState([])
  const [osSemana,         setOsSemana]        = useState([])
  const [loadingDia,       setLoadingDia]      = useState(false)
  const [copiado,          setCopied]          = useState(null)
  const [reagendarModal,   setReagendarModal]  = useState(null)
  const [reagendarForm,    setReagendarForm]   = useState({ data: '', hora: '' })
  const [reagendarSaving,  setReagendarSaving] = useState(false)
  const [horaAtual,        setHoraAtual]       = useState(() => {
    const n = new Date(); return n.getHours() * 60 + n.getMinutes()
  })

  // Atualiza relógio interno a cada minuto para detectar OS atrasadas
  useEffect(() => {
    const t = setInterval(() => {
      const n = new Date(); setHoraAtual(n.getHours() * 60 + n.getMinutes())
    }, 60000)
    return () => clearInterval(t)
  }, [])

  // Query semanal — alimenta mini barra Seg–Dom
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

  // Query diária: OS agendadas + retornos de "ficou na visita"
  useEffect(() => {
    if (!empresaId) return
    setLoadingDia(true)
    const qPrincipal = query(
      collection(db, `empresas/${empresaId}/checklist`),
      where('data_agendada', '==', data),
      orderBy('hora_agendada', 'asc')
    )
    const qRetorno = query(
      collection(db, `empresas/${empresaId}/checklist`),
      where('resultado_visita', '==', 'ficou_visita'),
      where('data_retorno', '==', data)
    )
    let snapP = null, snapR = null
    function merge() {
      if (snapP === null || snapR === null) return
      const ids = new Set()
      const lista = []
      snapP.docs.forEach(d => { ids.add(d.id); lista.push({ id: d.id, ...d.data() }) })
      snapR.docs.forEach(d => { if (!ids.has(d.id)) lista.push({ id: d.id, ...d.data() }) })
      setOsList(lista)
      setLoadingDia(false)
    }
    const unsubP = onSnapshot(qPrincipal, snap => { snapP = snap; merge() },
      err => { console.error('[Agenda] Erro query diária:', err); setLoadingDia(false) })
    const unsubR = onSnapshot(qRetorno, snap => { snapR = snap; merge() },
      err => console.error('[Agenda] Erro query retorno:', err))
    return () => { unsubP(); unsubR() }
  }, [empresaId, data])

  // ── Navegação de dia
  function diaAnterior() {
    const d = new Date(data + 'T12:00:00'); d.setDate(d.getDate() - 1)
    setData(d.toISOString().slice(0, 10))
  }
  function proximoDia() {
    const d = new Date(data + 'T12:00:00'); d.setDate(d.getDate() + 1)
    setData(d.toISOString().slice(0, 10))
  }

  // ── Ações dos cards
  function buildLink(os) { return `${window.location.origin}/${slug}?os=${os.id}` }

  async function copiarLink(os) {
    const link = buildLink(os)
    try { await navigator.clipboard.writeText(link) } catch {
      const el = document.createElement('textarea')
      el.value = link; document.body.appendChild(el)
      el.select(); document.execCommand('copy'); document.body.removeChild(el)
    }
    setCopied(os.id); setTimeout(() => setCopied(null), 2000)
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
    const enc    = validos.map(o => encodeURIComponent(`${o.endereco}, ${o.cidade}`))
    const origem = enc[0], dest = enc[enc.length - 1]
    const wps    = enc.length > 2 ? `&waypoints=${enc.slice(1, -1).join('|')}` : ''
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${origem}&destination=${dest}${wps}&travelmode=driving`, '_blank')
  }

  // ── Reagendar
  function abrirReagendar(os) {
    setReagendarModal(os)
    setReagendarForm({ data: os.data_agendada || '', hora: os.hora_agendada || '' })
  }

  async function salvarReagendar(comWA = false) {
    if (!reagendarModal || !empresaId) return
    setReagendarSaving(true)
    try {
      await atualizarOS(empresaId, reagendarModal.id, {
        data_agendada: reagendarForm.data,
        hora_agendada: reagendarForm.hora,
      })
      if (comWA) whatsappReagendar(reagendarModal, reagendarForm)
      setReagendarModal(null)
    } catch (e) { alert('Erro ao reagendar: ' + e.message) }
    finally { setReagendarSaving(false) }
  }

  function whatsappReagendar(os, form) {
    const tel = (os.tel_segurado || '').replace(/\D/g, '')
    if (!tel) return
    const nomeEmpresa = config?.nome || empresa?.nome || 'AssistHub'
    const dataFmt = form.data
      ? new Date(form.data + 'T12:00:00').toLocaleDateString('pt-BR') : ''
    const msg = encodeURIComponent(
      `Olá ${os.nome_segurado}! 👋\n` +
      `Seu atendimento foi *reagendado*.\n` +
      `📅 Nova data: *${dataFmt}*${form.hora ? ` às *${form.hora}*` : ''}\n` +
      `Qualquer dúvida, *${nomeEmpresa}* está à disposição!`
    )
    window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank')
  }

  function limparFiltros() {
    setFiltroSecao('todos'); setFiltroTecnico('todos')
    setFiltroSeg('todos'); setFiltroCidade('todos')
  }
  const temFiltroAtivo = filtroSecao !== 'todos' || filtroTecnico !== 'todos' || filtroSeg !== 'todos' || filtroCidade !== 'todos'

  // ── useMemo: listas derivadas

  const tecnicosNoDia = useMemo(() => {
    const s = new Set()
    osList.forEach(o => { const n = o.tecnico_nome || o.tecnico_nome_manual; if (n) s.add(n) })
    return [...s].sort()
  }, [osList])

  const seguradorasNoDia = useMemo(() => {
    const s = new Set(); osList.forEach(o => { if (o.seguradora) s.add(o.seguradora) })
    return [...s].sort()
  }, [osList])

  const cidadesNoDia = useMemo(() => {
    const s = new Set(); osList.forEach(o => { if (o.cidade) s.add(o.cidade) })
    return [...s].sort()
  }, [osList])

  // Detecta conflitos: mesmo técnico com OS a menos de 30 min de diferença
  const idsConflito = useMemo(() => {
    const conflitos = new Set()
    const porTec = {}
    osList.forEach(os => {
      const tec = os.tecnico_nome || os.tecnico_nome_manual
      if (!tec || !os.hora_agendada) return
      if (!porTec[tec]) porTec[tec] = []
      porTec[tec].push(os)
    })
    Object.values(porTec).forEach(lista => {
      for (let i = 0; i < lista.length; i++) {
        for (let j = i + 1; j < lista.length; j++) {
          const diff = Math.abs(horaParaMin(lista[i].hora_agendada) - horaParaMin(lista[j].hora_agendada))
          if (diff < 30) { conflitos.add(lista[i].id); conflitos.add(lista[j].id) }
        }
      }
    })
    return conflitos
  }, [osList])

  // Detecta OS atrasadas: horário passou +15 min e técnico ainda não respondeu (só hoje)
  const idsAtrasada = useMemo(() => {
    if (data !== dataHoje()) return new Set()
    const atrasadas = new Set()
    osList.forEach(os => {
      const st = os.status || 'pendente'
      if (!['aguardando_tecnico', 'pendente'].includes(st)) return
      const min = horaParaMin(os.hora_agendada)
      if (min >= 0 && horaAtual > min + 15) atrasadas.add(os.id)
    })
    return atrasadas
  }, [osList, horaAtual, data])

  // Lista filtrada por todos os filtros
  const filtrada = useMemo(() => osList.filter(o => {
    if (filtroTecnico !== 'todos' && (o.tecnico_nome || o.tecnico_nome_manual || '') !== filtroTecnico) return false
    if (filtroSeg !== 'todos' && (o.seguradora || '') !== filtroSeg) return false
    if (filtroCidade !== 'todos' && (o.cidade || '') !== filtroCidade) return false
    if (filtroSecao !== 'todos' && getSecao(o) !== filtroSecao) return false
    return true
  }), [osList, filtroTecnico, filtroSeg, filtroCidade, filtroSecao])

  // Agrupa em seções e ordena "A fazer" com sem-horário na frente
  const secoes = useMemo(() => {
    const aFazer = [], respondidas = [], retorno = [], finalizadas = []
    filtrada.forEach(os => {
      const s = getSecao(os)
      if (s === 'a_fazer')     aFazer.push(os)
      else if (s === 'respondidas') respondidas.push(os)
      else if (s === 'retorno')     retorno.push(os)
      else                          finalizadas.push(os)
    })
    aFazer.sort((a, b) => {
      const ha = a.hora_agendada || '', hb = b.hora_agendada || ''
      if (!ha && hb) return -1; if (ha && !hb) return 1
      return ha.localeCompare(hb)
    })
    return { aFazer, respondidas, retorno, finalizadas }
  }, [filtrada])

  // Contadores globais (sem filtro de seção) para os stats
  const statsGlobal = useMemo(() => {
    const c = { a_fazer: 0, respondidas: 0, retorno: 0, finalizadas: 0 }
    osList.forEach(os => c[getSecao(os)]++)
    return c
  }, [osList])

  const semana = useMemo(() => {
    const dias = diasDaSemana(data)
    return dias.map((dataISO, i) => ({
      dataISO, diaN: parseInt(dataISO.split('-')[2]),
      abrev: DIAS_SEMANA_SEG[i],
      count: osSemana.filter(o => o.data_agendada === dataISO).length,
    }))
  }, [data, osSemana])

  const hoje = dataHoje()

  // ── Renderiza card individual
  function renderCard(os) {
    const st      = os.status || 'pendente'
    const meta    = STATUS_META[st] ?? STATUS_META.pendente
    const tec     = os.tecnico_nome || os.tecnico_nome_manual
    const tempo   = tempoDecorrido(os.criado_em)
    const semHora = !os.hora_agendada
    const atrasada = idsAtrasada.has(os.id)
    const conflito = idsConflito.has(os.id)
    const corTec   = tec ? corDoTecnico(tec) : null

    return (
      <div key={os.id}
        className={`ag-card ag-card-${st}${semHora ? ' ag-card-sem-hora' : ''}${atrasada ? ' ag-card-atrasada' : ''}`}
      >
        {corTec && <div className="ag-tec-strip" style={{ background: corTec }} />}

        <div className="ag-card-header">
          <span className={`ag-card-hora${semHora ? ' ag-hora-vazia' : ''}`}>
            {semHora ? '⚠️ Sem horário' : `🕐 ${os.hora_agendada}`}
          </span>
          <span className="ag-status-badge" style={{ color: meta.dot }}>
            <span className="ag-dot" style={{ background: meta.dot }} />
            {meta.label}
          </span>
          {atrasada && <span className="ag-badge ag-badge-atrasada">🔴 Atrasada</span>}
          {conflito && <span className="ag-badge ag-badge-conflito">⚡ Conflito</span>}
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
          {tec && (
            <p className="ag-card-tec" style={{ color: corTec || 'var(--muted)' }}>
              👷 {tec}
            </p>
          )}
          {tempo && <p className="ag-card-tempo">⏱️ {tempo}</p>}
        </div>

        <div className="ag-card-acoes">
          <button className="ag-btn ag-btn-wa"        onClick={() => whatsapp(os)}           title="WhatsApp">💬</button>
          <button className="ag-btn ag-btn-map"       onClick={() => mapa(os)}               title="Mapa">📍</button>
          <button className="ag-btn ag-btn-os"        onClick={() => navigate(`/${slug}/admin`, { state: { openOsId: os.id } })} title="Ver OS">📋 Ver OS</button>
          <button className="ag-btn ag-btn-reagendar" onClick={() => abrirReagendar(os)}     title="Reagendar">📅 Reagendar</button>
          <button
            className={`ag-btn ag-btn-link${copiado === os.id ? ' ag-btn-copiado' : ''}`}
            onClick={() => copiarLink(os)}
            title="Copiar link do técnico"
          >
            {copiado === os.id ? '✓ Copiado' : '📲 Link'}
          </button>
        </div>
      </div>
    )
  }

  // Renderiza uma seção com header e lista de cards
  function renderSecao(titulo, cor, lista) {
    if (lista.length === 0) return null
    return (
      <div className="ag-secao">
        <div className="ag-secao-header" style={{ borderLeftColor: cor }}>
          <span className="ag-secao-titulo">{titulo}</span>
          <span className="ag-secao-count" style={{ background: cor }}>{lista.length}</span>
        </div>
        <div className="ag-secao-body">
          {lista.map(os => renderCard(os))}
        </div>
      </div>
    )
  }

  if (loadingEmpresa) return <div className="ag-loading">Carregando...</div>

  const totalFiltrado = filtrada.length

  return (
    <div className="ag-root">

      {/* ── Header ──────────────────────────────────────────── */}
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

      {/* ── Navegação de dia ────────────────────────────────── */}
      <div className="ag-nav">
        <button className="ag-nav-arrow" onClick={diaAnterior} aria-label="Dia anterior">‹</button>
        <div className="ag-nav-center">
          <span className="ag-nav-label">{dataExtenso(data)}</span>
          <label className="ag-nav-date-wrap" title="Ir para data">
            📅
            <input
              type="date" className="ag-nav-date"
              value={data} onChange={e => setData(e.target.value)}
            />
          </label>
        </div>
        <button className="ag-nav-arrow" onClick={proximoDia} aria-label="Próximo dia">›</button>
      </div>

      {/* ── Mini barra semanal ──────────────────────────────── */}
      <div className="ag-semana">
        {semana.map(({ dataISO, diaN, abrev, count }) => {
          const isSel  = dataISO === data
          const isHoje = dataISO === hoje && !isSel
          return (
            <button key={dataISO}
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

      {/* ── Filtros ─────────────────────────────────────────── */}
      <div className="ag-controls">
        <div className="ag-filtros">
          {[
            { key: 'todos',       label: 'Todos'           },
            { key: 'a_fazer',     label: '🔔 A Fazer'      },
            { key: 'respondidas', label: '✅ Respondidas'  },
            { key: 'retorno',     label: '🔄 Retorno'      },
            { key: 'finalizadas', label: '📋 Finalizadas'  },
          ].map(({ key, label }) => (
            <button key={key}
              className={`ag-filtro-btn ag-f-${key}${filtroSecao === key ? ' active' : ''}`}
              onClick={() => setFiltroSecao(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="ag-selects">
          {tecnicosNoDia.length > 0 && (
            <select className="ag-select" value={filtroTecnico} onChange={e => setFiltroTecnico(e.target.value)}>
              <option value="todos">👷 Todos técnicos</option>
              {tecnicosNoDia.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          )}
          {seguradorasNoDia.length > 1 && (
            <select className="ag-select" value={filtroSeg} onChange={e => setFiltroSeg(e.target.value)}>
              <option value="todos">🏢 Todas seguradoras</option>
              {seguradorasNoDia.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {cidadesNoDia.length > 1 && (
            <select className="ag-select" value={filtroCidade} onChange={e => setFiltroCidade(e.target.value)}>
              <option value="todos">📍 Todas cidades</option>
              {cidadesNoDia.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {temFiltroAtivo && (
            <button className="ag-btn-limpar" onClick={limparFiltros}>✕ Limpar</button>
          )}
        </div>
      </div>

      {/* ── Stats — clicáveis para filtrar por seção ─────────── */}
      <div className="ag-stats">
        {[
          { key: 'a_fazer',     label: 'A Fazer',     cor: '#f05a1a' },
          { key: 'respondidas', label: 'Respondidas', cor: '#2d8a4e' },
          { key: 'retorno',     label: 'Retorno',     cor: '#3b82f6' },
          { key: 'finalizadas', label: 'Finalizadas', cor: '#1a3fa8' },
        ].map(({ key, label, cor }) => (
          <div key={key} className={`ag-stat${filtroSecao === key ? ' ag-stat-ativo' : ''}`}
            style={{ borderTopColor: cor, cursor: 'pointer' }}
            onClick={() => setFiltroSecao(filtroSecao === key ? 'todos' : key)}
            title={`Filtrar: ${label}`}
          >
            <span className="ag-stat-n">{statsGlobal[key]}</span>
            <span className="ag-stat-l">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Conteúdo principal ──────────────────────────────── */}
      {loadingDia ? (
        <div className="ag-loading">Carregando OS do dia...</div>
      ) : totalFiltrado === 0 ? (
        <div className="ag-empty">
          <span className="ag-empty-icon">📭</span>
          <p>{temFiltroAtivo ? 'Nenhuma OS encontrada com esses filtros.' : 'Nenhuma OS agendada para este dia.'}</p>
          {temFiltroAtivo && (
            <button className="ag-limpar-filtro" onClick={limparFiltros}>Limpar filtros</button>
          )}
        </div>
      ) : (
        <div className="ag-content">
          <div className="ag-lista-header">
            {totalFiltrado} OS · {dataExtenso(data).split(',')[0]}
          </div>
          {renderSecao('🔔 A Fazer',                   '#f05a1a', secoes.aFazer)}
          {renderSecao('✅ Respondidas pelo técnico',   '#2d8a4e', secoes.respondidas)}
          {renderSecao('🔄 Retorno agendado',           '#3b82f6', secoes.retorno)}
          {renderSecao('📋 Finalizadas',                '#9ca3af', secoes.finalizadas)}
        </div>
      )}

      {/* ── Modal Reagendar ──────────────────────────────────── */}
      {reagendarModal && (
        <div className="ag-modal-overlay" onClick={e => e.target === e.currentTarget && setReagendarModal(null)}>
          <div className="ag-modal">
            <div className="ag-modal-header">
              <h3>📅 Reagendar OS</h3>
              <button className="ag-modal-close" onClick={() => setReagendarModal(null)}>✕</button>
            </div>
            <div className="ag-modal-body">
              <p className="ag-modal-cliente">{reagendarModal.nome_segurado}</p>
              <p className="ag-modal-info">
                🔧 {reagendarModal.servico || '—'} · {reagendarModal.cidade || '—'}
              </p>
              <div className="ag-modal-fields">
                <label className="ag-modal-label">
                  Nova data
                  <input type="date" className="ag-modal-input"
                    value={reagendarForm.data}
                    onChange={e => setReagendarForm(p => ({ ...p, data: e.target.value }))}
                  />
                </label>
                <label className="ag-modal-label">
                  Novo horário
                  <input type="time" className="ag-modal-input"
                    value={reagendarForm.hora}
                    onChange={e => setReagendarForm(p => ({ ...p, hora: e.target.value }))}
                  />
                </label>
              </div>
            </div>
            <div className="ag-modal-footer">
              <button className="ag-btn" onClick={() => setReagendarModal(null)}>Cancelar</button>
              <button className="ag-btn ag-btn-wa"
                disabled={reagendarSaving || !reagendarForm.data}
                onClick={() => salvarReagendar(true)}
              >
                {reagendarSaving ? '⏳' : '💬 Salvar + WA'}
              </button>
              <button className="ag-btn ag-btn-ok"
                disabled={reagendarSaving || !reagendarForm.data}
                onClick={() => salvarReagendar(false)}
              >
                {reagendarSaving ? '⏳' : '💾 Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
