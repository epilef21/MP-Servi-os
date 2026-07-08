import { useState, useMemo } from 'react'
import { useAdminContext } from '../../contexts/AdminContext.jsx'
import { fmtBRL, fmtDate } from '../../utils/formatters.js'
import {
  RefreshCw, FileText, CalendarDays, HardHat, Link2, Pencil, Eye, Send, ClipboardList, Rocket, Trash2,
} from 'lucide-react'

export const STATUS_ORC_META = {
  aguardando_tecnico: { label: 'Aguardando',        cls: 'orc-aguardando' },
  em_revisao:         { label: 'Em Revisão',         cls: 'orc-revisao'    },
  enviado_cliente:    { label: 'Enviado ao Cliente',  cls: 'orc-enviado-c'  },
  enviado_seguradora: { label: 'Enviado à Seg.',      cls: 'orc-enviado-s'  },
  aprovado:           { label: 'Aprovado',            cls: 'orc-aprovado'   },
  reprovado:          { label: 'Reprovado',           cls: 'orc-reprovado'  },
  executado:          { label: 'Executado',            cls: 'orc-executado'  },
  cancelado:          { label: 'Cancelado',            cls: 'orc-cancelado'  },
}

function orcCardCls(status) {
  const m = {
    aguardando_tecnico: 'aguardando', em_revisao: 'revisao',
    enviado_cliente: 'enviado', enviado_seguradora: 'enviado',
    aprovado: 'aprovado', reprovado: 'reprovado',
    executado: 'executado', cancelado: 'executado',
  }
  return m[status] || 'aguardando'
}

export default function OrcamentosTab() {
  const {
    orcamentos, loadingOrc, loadOrcamentos,
    openRevisarOrcamento, copyOrcLink, buildLinkTecnicoOrc,
    handlePDFCliente, handlePDFSeguradora, abrirConverterOS, excluirOrcamento,
  } = useAdminContext()

  const [orcBusca,      setOrcBusca]      = useState('')
  const [orcFiltTipo,   setOrcFiltTipo]   = useState('')
  const [orcFiltStatus, setOrcFiltStatus] = useState('')

  const orcFiltered = useMemo(() => {
    const b = orcBusca.toLowerCase()
    return orcamentos.filter(o => {
      const txt = `${o.nome_cliente||''} ${o.numero||''} ${o.tel_cliente||''}`.toLowerCase()
      return (!b || txt.includes(b))
        && (!orcFiltTipo   || o.tipo   === orcFiltTipo)
        && (!orcFiltStatus || o.status === orcFiltStatus)
    })
  }, [orcamentos, orcBusca, orcFiltTipo, orcFiltStatus])

  return (
    <div className="tab-content">
      <div className="filter-bar">
        <input
          className="filter-input flex-1"
          placeholder="Buscar por nome, número..."
          value={orcBusca}
          onChange={e => setOrcBusca(e.target.value)}
        />
        <select className="filter-input" value={orcFiltTipo} onChange={e => setOrcFiltTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          <option value="linha_branca">Linha Branca</option>
          <option value="emergencial">Emergencial</option>
          <option value="particular">Particular</option>
        </select>
        <select className="filter-input" value={orcFiltStatus} onChange={e => setOrcFiltStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="aguardando_tecnico">Aguardando</option>
          <option value="em_revisao">Em Revisão</option>
          <option value="enviado_cliente">Enviado ao Cliente</option>
          <option value="enviado_seguradora">Enviado à Seg.</option>
          <option value="aprovado">Aprovado</option>
          <option value="reprovado">Reprovado</option>
          <option value="executado">Executado</option>
        </select>
        <button
          className="btn-sm btn-view"
          onClick={loadOrcamentos}
          disabled={loadingOrc}
          style={{ whiteSpace: 'nowrap' }}
        >
          <RefreshCw size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 4 }} />Atualizar
        </button>
      </div>

      {loadingOrc && (
        <div className="loading-state"><div className="spinner" /><p className="loading-text">Carregando orçamentos...</p></div>
      )}

      {!loadingOrc && orcFiltered.length === 0 && (
        <div className="empty-state">
          <div className="e-icon"><FileText size={40} strokeWidth={2} /></div>
          <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 6 }}>
            {orcamentos.length === 0 ? 'Nenhum orçamento criado' : 'Nenhum orçamento encontrado'}
          </p>
          <p style={{ fontSize: '.85rem' }}>
            {orcamentos.length === 0
              ? 'Clique em "+ Novo Orçamento" para começar.'
              : 'Tente ajustar os filtros acima.'}
          </p>
        </div>
      )}

      {!loadingOrc && orcFiltered.length > 0 && (
        <div className="orc-cards-grid">
          {orcFiltered.map(orc => {
            const smeta = STATUS_ORC_META[orc.status] || STATUS_ORC_META.aguardando_tecnico
            const totalMostrar = orc.total_geral > 0 ? orc.total_geral : null
            return (
              <div key={orc.id} className={`orc-card ${orcCardCls(orc.status)}`}>
                <div className="orc-card-top">
                  <span className={`badge ${smeta.cls}`}>{smeta.label}</span>
                  <span className="orc-card-numero">{orc.numero}</span>
                </div>
                <div className="orc-card-name">{orc.nome_cliente || '—'}</div>
                <div className="orc-card-tel">{orc.tel_cliente || ''}</div>
                <div className="orc-card-equip">
                  {orc.tipo === 'linha_branca'
                    ? `${orc.tipo_equipamento || ''} ${orc.marca || ''} · ${orc.cidade || ''}`
                    : orc.cidade || ''}
                </div>
                <div className="orc-card-meta">
                  <div className="orc-card-meta-item"><CalendarDays size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 4 }} />{fmtDate(orc.criado_em)}</div>
                  {totalMostrar !== null && <div className="orc-card-meta-item"><strong>{fmtBRL(totalMostrar)}</strong></div>}
                  {orc.tecnico_nome && <div className="orc-card-meta-item"><HardHat size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 4 }} />{orc.tecnico_nome}</div>}
                </div>
                {orc.status === 'aguardando_tecnico' && (
                  <div style={{ marginBottom: 6 }}>
                    <span className="link-disponivel-badge"><Link2 size={13} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 4 }} />Link disponível</span>
                  </div>
                )}
                <div className="orc-card-actions">
                  <button className="btn-sm btn-view" onClick={() => openRevisarOrcamento(orc)}>
                    {orc.status === 'em_revisao'
                      ? <><Pencil size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 4 }} />Revisar</>
                      : <><Eye size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 4 }} />Ver</>}
                  </button>
                  {orc.status === 'aguardando_tecnico' && (
                    <>
                      <a className="btn-sm btn-ok" style={{ textDecoration: 'none' }} target="_blank" rel="noopener noreferrer"
                        href={`https://wa.me/${orc.tecnico_tel ? '55'+orc.tecnico_tel.replace(/\D/g,'') : ''}?text=${encodeURIComponent(`Olá ${orc.tecnico_nome||'Técnico'}! 👷\nNovo orçamento para avaliar no local:\n🔗 ${buildLinkTecnicoOrc(orc.id)}`)}`}>
                        <Send size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 4 }} />Enviar
                      </a>
                      <button className="btn-sm" style={{ background: 'var(--light)', color: 'var(--primary)', border: '1px solid var(--border)' }}
                        onClick={() => copyOrcLink(buildLinkTecnicoOrc(orc.id))}>
                        <ClipboardList size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 4 }} />Copiar
                      </button>
                    </>
                  )}
                  {(orc.total_cliente > 0 || (orc.status === 'aprovado' && orc.total_geral > 0)) && (
                    <button className="btn-sm btn-pdf" onClick={() => handlePDFCliente(orc)}><FileText size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 4 }} />PDF</button>
                  )}
                  {orc.total_seguradora > 0 && (
                    <button className="btn-sm btn-pdf" style={{ background: '#6c3483' }} onClick={() => handlePDFSeguradora(orc)}><ClipboardList size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 4 }} />Seg.</button>
                  )}
                  {orc.status === 'aprovado' && !orc.os_vinculada && (
                    <button className="btn-sm btn-ok" onClick={() => abrirConverterOS(orc)}><Rocket size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 4 }} />OS</button>
                  )}
                  <button className="btn-sm" style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', marginLeft: 'auto' }}
                    title="Excluir orçamento" onClick={() => excluirOrcamento(orc)}><Trash2 size={14} strokeWidth={2} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
