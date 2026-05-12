import { useState, useMemo } from 'react'
import { useAdminContext } from '../../contexts/AdminContext.jsx'
import { getLucro, fmtBRL, fmtDate } from '../../utils/formatters.js'

const STATUS_META = {
  aguardando_tecnico: { label: '🔔 Aguardando',     cls: 'aguardando-t'    },
  pendente:           { label: '⏳ Pendente',         cls: 'pendente-y'      },
  processado:         { label: '✅ Processado',       cls: 'processado-g'    },
  enviado:            { label: '📤 Enviado',          cls: 'enviado-b'       },
  ficou_visita:       { label: '🔄 Ficou na Visita', cls: 'ficou-visita'    },
  cliente_ausente:    { label: '🚪 Cliente Ausente', cls: 'cliente-ausente' },
}
const badgeLabel = s => STATUS_META[s]?.label ?? STATUS_META.pendente.label
const badgeCls   = s => STATUS_META[s]?.cls   ?? 'pendente-y'

export default function OrdensServicoTab() {
  const {
    reports, loading, error,
    changeStatus, updating, setSelected, setGeneratedLink, openLinkRelModal, buildLink,
  } = useAdminContext()

  const [busca,      setBusca]      = useState('')
  const [filtStatus, setFiltStatus] = useState('')
  const [filtData,   setFiltData]   = useState('')

  const filtered = useMemo(() => {
    const b = busca.toLowerCase()
    return reports.filter(r => {
      const txt = `${r.nome_segurado || ''} ${r.seguradora || ''} ${r.cidade || ''} ${r.num_assist || ''} ${r.servico || ''}`.toLowerCase()
      return (!b || txt.includes(b))
        && (!filtStatus || (r.status || 'pendente') === filtStatus)
        && (!filtData || r.data_chegada === filtData)
    })
  }, [reports, busca, filtStatus, filtData])

  return (
    <div className="tab-content">
      <div className="filter-bar" style={{ marginBottom: 20 }}>
        <span className="filter-label">Filtrar:</span>
        <input className="filter-input flex-1" placeholder="🔍 Segurado, seguradora, cidade..."
          value={busca} onChange={e => setBusca(e.target.value)} />
        <select className="filter-input" value={filtStatus} onChange={e => setFiltStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="aguardando_tecnico">🔔 Aguardando Técnico</option>
          <option value="pendente">⏳ Pendentes</option>
          <option value="processado">✅ Processados</option>
          <option value="enviado">📤 Enviados</option>
        </select>
        <input type="date" className="filter-input" value={filtData} onChange={e => setFiltData(e.target.value)} />
        {(busca || filtStatus || filtData) && (
          <button className="btn-sm btn-view" onClick={() => { setBusca(''); setFiltStatus(''); setFiltData('') }}>✕ Limpar</button>
        )}
      </div>

      <div style={{ fontSize: '.82rem', color: 'var(--muted)', marginBottom: 16, fontWeight: 600 }}>
        {filtered.length} ordem{filtered.length !== 1 ? 'ns' : ''} de serviço
      </div>

      {loading && <div className="loading-state"><div className="spinner" /><div className="loading-text">Carregando...</div></div>}
      {error && !loading && <div className="err-msg">⚠️ {error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state"><div className="e-icon">📭</div><p>Nenhuma OS encontrada.</p></div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="os-cards-grid">
          {filtered.map(r => {
            const lucro = getLucro(r)
            return (
              <div key={r.id} className="os-card" onClick={() => setSelected(r)}>
                <div className="os-card-header">
                  <span className={`badge ${badgeCls(r.status)}`}>{badgeLabel(r.status)}</span>
                  {r.avaliacao_nota && (
                    <span style={{ color: '#f0a020', fontWeight: 700, fontSize: '.85rem' }}>{'★'.repeat(r.avaliacao_nota)}</span>
                  )}
                </div>

                <div className="os-card-name">{r.nome_segurado || '—'}</div>
                <div className="os-card-seg">{r.seguradora || '—'}{r.cidade ? ` · ${r.cidade}` : ''}</div>

                <div className="os-card-body" style={{ marginTop: 10 }}>
                  {r.servico && <div className="os-card-row">🔧 <strong>{r.servico}</strong></div>}
                  {r.data_chegada && <div className="os-card-row">📅 {fmtDate(r.data_chegada)}</div>}
                  {r.tecnico_nome && <div className="os-card-row">👷 {r.tecnico_nome}</div>}
                  {lucro !== null && (
                    <div className="os-card-row">
                      💰 <strong style={{ color: lucro >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmtBRL(lucro)}</strong>
                    </div>
                  )}
                </div>

                <div className="os-card-footer" onClick={e => e.stopPropagation()}>
                  <button className="btn-sm btn-view" onClick={() => setSelected(r)}>Ver detalhes</button>
                  {r.status === 'aguardando_tecnico' && (
                    <button className="btn-sm btn-link"
                      onClick={() => setGeneratedLink({ link: buildLink(r), os: r.id, nome: r.nome_segurado, seguradora: r.seguradora, num_assist: r.num_assist })}>
                      🔗 Link
                    </button>
                  )}
                  {(r.status === 'processado' || r.status === 'enviado') && (
                    <button className="btn-sm" style={{ background: '#1a5276', color: '#fff' }}
                      onClick={() => openLinkRelModal(r)}>
                      🔗 Link
                    </button>
                  )}
                  {(r.status || 'pendente') === 'pendente' && (
                    <button className="btn-sm btn-ok" disabled={updating} onClick={() => changeStatus(r.id, 'processado')}>✓</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
