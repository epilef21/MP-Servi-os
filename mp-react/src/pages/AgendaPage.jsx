// ============================================================
// AGENDA PAGE — Visualização do dia por OS agendada
// Rota: /:slug/agenda (protegida por RotaAdmin)
// ============================================================
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { onSnapshot } from 'firebase/firestore'
import { db, collection, query, where, orderBy } from '../firebase.js'
import { useEmpresa } from '../hooks/useEmpresa.js'
import './AgendaPage.css'

const STATUS_LABELS = {
  pendente:    'Pendente',
  em_execucao: 'Em Execução',
  finalizada:  'Finalizada',
  cancelada:   'Cancelada',
}

const SEG_CORES = {
  'Mapfre':       '#00529b',
  'Porto Seguro': '#003d80',
  'Allianz':      '#003781',
  'Tempo':        '#e8531a',
  'Maxpar':       '#2d8a4e',
  'SulAmérica':   '#e8003d',
}

function dataHoje() {
  return new Date().toISOString().slice(0, 10)
}

export default function AgendaPage() {
  const navigate = useNavigate()
  const { empresa, config, empresaId, slug, loading: loadingEmpresa } = useEmpresa()

  const [data,         setData]         = useState(dataHoje)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [osList,       setOsList]       = useState([])
  const [loading,      setLoading]      = useState(false)

  useEffect(() => {
    if (!empresaId) return
    setLoading(true)
    const q = query(
      collection(db, `empresas/${empresaId}/checklist`),
      where('data_agendada', '==', data),
      orderBy('hora_agendada', 'asc')
    )
    const unsub = onSnapshot(q, snap => {
      setOsList(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [empresaId, data])

  const filtrada = filtroStatus === 'todos'
    ? osList
    : osList.filter(o => o.status === filtroStatus)

  const stats = {
    pendente:    osList.filter(o => o.status === 'pendente').length,
    em_execucao: osList.filter(o => o.status === 'em_execucao').length,
    finalizada:  osList.filter(o => o.status === 'finalizada').length,
    cancelada:   osList.filter(o => o.status === 'cancelada').length,
  }

  function tracarRota() {
    const validos = osList.filter(o => o.status !== 'cancelada' && o.endereco)
    if (!validos.length) { alert('Nenhum endereço válido para traçar rota.'); return }
    const enc = validos.map(o =>
      encodeURIComponent(`${o.endereco}${o.numero ? ', ' + o.numero : ''}, ${o.cidade}`)
    )
    const origem  = enc[0]
    const destino = enc.length > 1 ? enc[enc.length - 1] : enc[0]
    const wps     = enc.length > 2 ? `&waypoints=${enc.slice(1, -1).join('|')}` : ''
    window.open(
      `https://www.google.com/maps/dir/?api=1&origin=${origem}&destination=${destino}${wps}&travelmode=driving`,
      '_blank'
    )
  }

  function whatsapp(os) {
    const tel = (os.tel_segurado || '').replace(/\D/g, '')
    if (!tel) return
    const nomeEmpresa = config?.nome || empresa?.nome || 'AssistHub'
    const hora = os.hora_agendada || os.hora_atend || ''
    const msg = encodeURIComponent(
      `Olá ${os.nome_segurado}, tudo bem?\n` +
      `Sou da *${nomeEmpresa}*, referente ao atendimento de *${os.servico || 'serviço'}*.\n` +
      `Confirmando seu agendamento para hoje${hora ? ` às *${hora}*` : ''}.\n` +
      `Endereço: ${os.endereco}${os.numero ? ', ' + os.numero : ''}, ${os.cidade}.\n` +
      `Qualquer dúvida, estamos à disposição!`
    )
    window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank')
  }

  function mapa(os) {
    const addr = encodeURIComponent(`${os.endereco}${os.numero ? ', ' + os.numero : ''}, ${os.cidade}`)
    window.open(`https://www.google.com/maps/search/?api=1&query=${addr}`, '_blank')
  }

  if (loadingEmpresa) return <div className="ag-loading">Carregando...</div>

  return (
    <div className="ag-root">
      <header className="ag-header">
        <button className="ag-back" onClick={() => navigate(`/${slug}/admin`)}>← Admin</button>
        <h1 className="ag-title">📅 Agenda do Dia</h1>
        <button className="ag-rota-btn" onClick={tracarRota}>🗺️ Traçar Rota do Dia</button>
      </header>

      <div className="ag-controls">
        <input
          type="date"
          className="ag-date"
          value={data}
          onChange={e => setData(e.target.value)}
        />
        <div className="ag-filtros">
          {['todos', 'pendente', 'em_execucao', 'finalizada', 'cancelada'].map(s => (
            <button
              key={s}
              className={`ag-filtro-btn ag-f-${s}${filtroStatus === s ? ' active' : ''}`}
              onClick={() => setFiltroStatus(s)}
            >
              {s === 'todos' ? 'Todos' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="ag-stats">
        {[
          { key: 'pendente',    label: 'Pendentes'   },
          { key: 'em_execucao', label: 'Em Execução' },
          { key: 'finalizada',  label: 'Finalizadas' },
          { key: 'cancelada',   label: 'Canceladas'  },
        ].map(({ key, label }) => (
          <div key={key} className={`ag-stat ag-stat-${key}`}>
            <span className="ag-stat-n">{stats[key]}</span>
            <span className="ag-stat-l">{label}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="ag-loading">Carregando OS do dia...</div>
      ) : filtrada.length === 0 ? (
        <div className="ag-empty">Nenhuma OS agendada para este dia.</div>
      ) : (
        <>
          {/* Tabela — visível em desktop */}
          <div className="ag-table-wrap">
            <table className="ag-table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Técnico</th>
                  <th>Cliente</th>
                  <th>Serviço</th>
                  <th>Cidade</th>
                  <th>Seguradora</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrada.map(os => (
                  <tr key={os.id} className={`ag-tr ag-tr-${os.status}`}>
                    <td className="ag-hora">{os.hora_agendada || os.hora_atend || '—'}</td>
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
                    <td className="ag-status-cell">
                      <span className={`ag-dot ag-dot-${os.status}`} />
                      <span className={`ag-status-label ag-label-${os.status}`}>
                        {STATUS_LABELS[os.status] || os.status}
                      </span>
                    </td>
                    <td className="ag-acoes">
                      <button className="ag-btn ag-btn-wa"  onClick={() => whatsapp(os)} title="WhatsApp">💬</button>
                      <button className="ag-btn ag-btn-map" onClick={() => mapa(os)}     title="Mapa">📍</button>
                      <button className="ag-btn ag-btn-os"  onClick={() => navigate(`/${slug}/admin`)} title="Abrir OS">📋</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards — visível em mobile */}
          <div className="ag-cards">
            {filtrada.map(os => (
              <div key={os.id} className={`ag-card ag-card-${os.status}`}>
                <div className="ag-card-header">
                  <span className="ag-card-hora">{os.hora_agendada || os.hora_atend || '—'}</span>
                  <span className={`ag-dot ag-dot-${os.status}`} />
                  <span className={`ag-status-label ag-label-${os.status}`}>
                    {STATUS_LABELS[os.status] || os.status}
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
                  <p className="ag-card-info">{[os.servico, os.cidade].filter(Boolean).join(' · ')}</p>
                  {(os.tecnico_nome || os.tecnico_nome_manual) && (
                    <p className="ag-card-tec">👷 {os.tecnico_nome || os.tecnico_nome_manual}</p>
                  )}
                </div>
                <div className="ag-card-acoes">
                  <button className="ag-btn ag-btn-wa"  onClick={() => whatsapp(os)}>💬 WhatsApp</button>
                  <button className="ag-btn ag-btn-map" onClick={() => mapa(os)}>📍 Mapa</button>
                  <button className="ag-btn ag-btn-os"  onClick={() => navigate(`/${slug}/admin`)}>📋 OS</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
