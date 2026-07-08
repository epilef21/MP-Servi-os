import { useState, useMemo } from 'react'
import { useAdminContext } from '../../contexts/AdminContext.jsx'
import { getLucro, fmtBRL, fmtDate } from '../../utils/formatters.js'
import {
  X, AlertTriangle, Inbox, Wrench, CalendarDays, HardHat, Wallet, Link2, ChevronDown, Check,
  LayoutGrid, List,
} from 'lucide-react'

import { badgeLabel, badgeCls } from './statusMeta.js'

// Quantidade de cards renderizados por vez — evita desenhar centenas de uma vez
const TAMANHO_PAGINA = 30

// Variante semântica do dot de status na visão tabela (cores --st-*)
function statusDotVariant(status) {
  switch (status) {
    case 'concluido':               return 'info'
    case 'cliente_ausente':         return 'critical'
    case 'processado':
    case 'enviado':                 return 'done'
    case 'aguardando_tecnico':
    case 'pendente':
    case 'ficou_visita':
    default:                        return 'progress'
  }
}

export default function OrdensServicoTab() {
  const {
    reports, loading, error,
    changeStatus, updating, setSelected, setGeneratedLink, openLinkRelModal, buildLink,
  } = useAdminContext()

  const [busca,      setBusca]      = useState('')
  const [filtStatus, setFiltStatus] = useState('')
  const [filtData,   setFiltData]   = useState('')
  const [visiveis,   setVisiveis]   = useState(TAMANHO_PAGINA)
  const [visao,      setVisao]      = useState(() => localStorage.getItem('osVisao') || 'cards')

  // Mudou o filtro/busca → volta para a primeira "página"
  function mudarFiltro(setter, valor) {
    setter(valor)
    setVisiveis(TAMANHO_PAGINA)
  }

  function trocarVisao(v) {
    setVisao(v)
    localStorage.setItem('osVisao', v)
  }

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
        <input className="filter-input flex-1" placeholder="Segurado, seguradora, cidade..."
          value={busca} onChange={e => mudarFiltro(setBusca, e.target.value)} />
        <select className="filter-input" value={filtStatus} onChange={e => mudarFiltro(setFiltStatus, e.target.value)}>
          <option value="">Todos os status</option>
          <option value="aguardando_tecnico">Aguardando Técnico</option>
          <option value="pendente">Pendentes</option>
          <option value="concluido">Concluídos pelo técnico</option>
          <option value="ficou_visita">Ficou na Visita</option>
          <option value="cliente_ausente">Cliente Ausente</option>
          <option value="processado">Processados</option>
          <option value="enviado">Enviados</option>
        </select>
        <input type="date" className="filter-input" value={filtData} onChange={e => mudarFiltro(setFiltData, e.target.value)} />
        {(busca || filtStatus || filtData) && (
          <button className="btn-sm btn-view" onClick={() => { setBusca(''); setFiltStatus(''); setFiltData(''); setVisiveis(TAMANHO_PAGINA) }}><X size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 4 }} />Limpar</button>
        )}
        <div className="view-toggle" style={{ marginLeft: 'auto' }}>
          <button
            className={`view-toggle-btn${visao === 'cards' ? ' active' : ''}`}
            onClick={() => trocarVisao('cards')}
            title="Visão em cards"
            aria-label="Visão em cards"
          >
            <LayoutGrid size={16} strokeWidth={2} />
          </button>
          <button
            className={`view-toggle-btn${visao === 'tabela' ? ' active' : ''}`}
            onClick={() => trocarVisao('tabela')}
            title="Visão em tabela"
            aria-label="Visão em tabela"
          >
            <List size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div style={{ fontSize: '.82rem', color: 'var(--muted)', marginBottom: 16, fontWeight: 600 }}>
        {filtered.length > visiveis
          ? `Mostrando ${visiveis} de ${filtered.length} ordens de serviço`
          : `${filtered.length} ordem${filtered.length !== 1 ? 'ns' : ''} de serviço`}
      </div>

      {loading && <div className="loading-state"><div className="spinner" /><div className="loading-text">Carregando...</div></div>}
      {error && !loading && <div className="err-msg"><AlertTriangle size={15} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state"><div className="e-icon"><Inbox size={40} strokeWidth={2} /></div><p>Nenhuma OS encontrada.</p></div>
      )}

      {!loading && !error && filtered.length > 0 && visao === 'tabela' && (
        <div className="table-wrap">
          <table className="data-table os-table">
            <thead>
              <tr>
                <th>Status</th><th>Segurado</th><th>Seguradora</th><th>Serviço</th><th>Data</th><th>Técnico</th><th>Lucro</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, visiveis).map(r => {
                const lucro = getLucro(r)
                return (
                  <tr key={r.id} onClick={() => setSelected(r)} style={{ cursor: 'pointer' }}>
                    <td data-label="Status">
                      <span className={`st-dot st-dot-${statusDotVariant(r.status)}`} />
                      {badgeLabel(r.status)}
                    </td>
                    <td data-label="Segurado">{r.nome_segurado || '—'}</td>
                    <td data-label="Seguradora">{r.seguradora || '—'}</td>
                    <td data-label="Serviço">{r.servico || '—'}</td>
                    <td data-label="Data">{r.data_chegada ? fmtDate(r.data_chegada) : '—'}</td>
                    <td data-label="Técnico">{r.tecnico_nome || '—'}</td>
                    <td data-label="Lucro">
                      {lucro !== null
                        ? <strong style={{ color: lucro >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmtBRL(lucro)}</strong>
                        : '—'}
                    </td>
                    <td data-label="Ações">
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                        <button className="btn-sm btn-view" onClick={() => setSelected(r)}>Ver detalhes</button>
                        {r.status === 'aguardando_tecnico' && (
                          <button className="btn-sm btn-link"
                            onClick={() => setGeneratedLink({ link: buildLink(r), os: r.id, nome: r.nome_segurado, seguradora: r.seguradora, num_assist: r.num_assist })}>
                            <Link2 size={15} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />Link
                          </button>
                        )}
                        {(r.status === 'processado' || r.status === 'enviado') && (
                          <button className="btn-sm" style={{ background: '#1a5276', color: '#fff' }}
                            onClick={() => openLinkRelModal(r)}>
                            <Link2 size={15} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />Link
                          </button>
                        )}
                        {(r.status === 'concluido' || r.status === 'pendente' || !r.status) && (
                          <button className="btn-sm btn-ok" disabled={updating} onClick={() => changeStatus(r.id, 'processado')} title="Marcar como processado"><Check size={15} strokeWidth={2.5} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && visao === 'cards' && (
        <div className="os-cards-grid">
          {filtered.slice(0, visiveis).map(r => {
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
                  {r.servico && <div className="os-card-row"><Wrench size={15} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} /><strong>{r.servico}</strong></div>}
                  {r.data_chegada && <div className="os-card-row"><CalendarDays size={15} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />{fmtDate(r.data_chegada)}</div>}
                  {r.tecnico_nome && <div className="os-card-row"><HardHat size={15} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />{r.tecnico_nome}</div>}
                  {lucro !== null && (
                    <div className="os-card-row">
                      <Wallet size={15} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} /><strong style={{ color: lucro >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmtBRL(lucro)}</strong>
                    </div>
                  )}
                </div>

                <div className="os-card-footer" onClick={e => e.stopPropagation()}>
                  <button className="btn-sm btn-view" onClick={() => setSelected(r)}>Ver detalhes</button>
                  {r.status === 'aguardando_tecnico' && (
                    <button className="btn-sm btn-link"
                      onClick={() => setGeneratedLink({ link: buildLink(r), os: r.id, nome: r.nome_segurado, seguradora: r.seguradora, num_assist: r.num_assist })}>
                      <Link2 size={15} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />Link
                    </button>
                  )}
                  {(r.status === 'processado' || r.status === 'enviado') && (
                    <button className="btn-sm" style={{ background: '#1a5276', color: '#fff' }}
                      onClick={() => openLinkRelModal(r)}>
                      <Link2 size={15} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />Link
                    </button>
                  )}
                  {(r.status === 'concluido' || r.status === 'pendente' || !r.status) && (
                    <button className="btn-sm btn-ok" disabled={updating} onClick={() => changeStatus(r.id, 'processado')} title="Marcar como processado"><Check size={15} strokeWidth={2.5} /></button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && !error && filtered.length > visiveis && (
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <button className="btn-sm btn-view" style={{ padding: '10px 24px' }}
            onClick={() => setVisiveis(v => v + TAMANHO_PAGINA)}>
            <ChevronDown size={15} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />Mostrar mais {Math.min(TAMANHO_PAGINA, filtered.length - visiveis)} ({filtered.length - visiveis} restantes)
          </button>
        </div>
      )}
    </div>
  )
}
