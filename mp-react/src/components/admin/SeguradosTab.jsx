import { useState, useMemo } from 'react'
import { useAdminContext } from '../../contexts/AdminContext.jsx'
import { fmtDate } from '../../utils/formatters.js'

import { badgeLabel, badgeCls } from './statusMeta.js'

export default function SeguradosTab({ onSelectOS }) {
  const { reports } = useAdminContext()

  const [selectedSegurado, setSelectedSegurado] = useState(null)

  const segurados = useMemo(() => {
    const map = {}
    reports.forEach(r => {
      const key = `${r.nome_segurado || ''}__${r.tel_segurado || ''}`
      if (!map[key]) {
        map[key] = {
          nome:     r.nome_segurado || '—',
          tel:      r.tel_segurado  || '',
          endereco: r.endereco      || '',
          cidade:   r.cidade        || '',
          os:       [],
        }
      }
      map[key].os.push(r)
    })
    return Object.values(map).sort((a, b) => b.os.length - a.os.length)
  }, [reports])

  return (
    <>
      {/* ── Lista ── */}
      <div className="tab-content">
        <div style={{ fontSize: '.82rem', color: 'var(--muted)', marginBottom: 16, fontWeight: 600 }}>
          {segurados.length} segurado{segurados.length !== 1 ? 's' : ''} únicos
        </div>

        {segurados.length === 0 && (
          <div className="empty-state">
            <div className="e-icon">👥</div>
            <p>Nenhum segurado encontrado.</p>
          </div>
        )}

        <div className="segurados-list">
          {segurados.map((s, idx) => {
            const ultima  = s.os[0]
            const comNota = s.os.filter(o => o.avaliacao_nota)
            const media   = comNota.length
              ? (comNota.reduce((acc, o) => acc + o.avaliacao_nota, 0) / comNota.length).toFixed(1)
              : null

            return (
              <div key={idx} className="segurado-item" onClick={() => setSelectedSegurado(s)}>
                <div className="segurado-avatar">{s.nome ? s.nome[0].toUpperCase() : '?'}</div>
                <div className="segurado-info">
                  <div className="segurado-name">{s.nome}</div>
                  <div className="segurado-meta">
                    {s.cidade || '—'}
                    {s.tel && ` · ${s.tel}`}
                    {ultima?.data_chegada && ` · Último: ${fmtDate(ultima.data_chegada)}`}
                  </div>
                </div>
                <div className="segurado-stats">
                  <div className="seg-stat">
                    <div className="seg-stat-val">{s.os.length}</div>
                    <div className="seg-stat-label">OS</div>
                  </div>
                  {media && (
                    <div className="seg-stat">
                      <div className="seg-stat-val seg-stars">★ {media}</div>
                      <div className="seg-stat-label">Média</div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Modal detalhe do segurado ── */}
      {selectedSegurado && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedSegurado(null)}>
          <div className="modal-box">
            <div className="modal-header">
              <h2>👤 {selectedSegurado.nome}</h2>
              <button className="btn-sm" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }}
                onClick={() => setSelectedSegurado(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="md-section">
                <h3>📋 Dados do Segurado</h3>
                <div className="md-grid">
                  <div className="md-field"><label>Nome</label><p>{selectedSegurado.nome}</p></div>
                  <div className="md-field"><label>Telefone</label><p>{selectedSegurado.tel || '—'}</p></div>
                  <div className="md-field"><label>Endereço</label><p>{selectedSegurado.endereco || '—'}</p></div>
                  <div className="md-field"><label>Cidade</label><p>{selectedSegurado.cidade || '—'}</p></div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                {(() => {
                  const osOrdem = [...selectedSegurado.os].sort((a, b) => {
                    const da  = a.criado_em?.toDate?.() ?? new Date(0)
                    const db_ = b.criado_em?.toDate?.() ?? new Date(0)
                    return db_ - da
                  })
                  const comNota = selectedSegurado.os.filter(o => o.avaliacao_nota)
                  const media   = comNota.length
                    ? (comNota.reduce((acc, o) => acc + o.avaliacao_nota, 0) / comNota.length).toFixed(1)
                    : null
                  const ultima  = osOrdem[0]
                  return (
                    <>
                      <div style={{ background: '#f0f5fc', borderRadius: 8, padding: '10px 16px', minWidth: 110, textAlign: 'center' }}>
                        <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--primary)' }}>{selectedSegurado.os.length}</div>
                        <div style={{ fontSize: '.75rem', color: 'var(--muted)' }}>atendimentos</div>
                      </div>
                      <div style={{ background: '#f0f5fc', borderRadius: 8, padding: '10px 16px', minWidth: 130, textAlign: 'center' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>{fmtDate(ultima?.data_chegada)}</div>
                        <div style={{ fontSize: '.75rem', color: 'var(--muted)' }}>último atendimento</div>
                      </div>
                      {media && (
                        <div style={{ background: '#fffbf0', border: '1px solid #f0d88a', borderRadius: 8, padding: '10px 16px', minWidth: 110, textAlign: 'center' }}>
                          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#8a6a00' }}>★ {media}</div>
                          <div style={{ fontSize: '.75rem', color: 'var(--muted)' }}>média avaliação</div>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>

              <div className="md-section" style={{ marginBottom: 0 }}>
                <h3>📂 Histórico de Atendimentos</h3>
                <table className="data-table" style={{ marginTop: 8 }}>
                  <thead>
                    <tr>
                      <th>Data</th><th>Seguradora</th><th>Serviço</th><th>Status</th><th>⭐ Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...selectedSegurado.os]
                      .sort((a, b) => {
                        const da  = a.criado_em?.toDate?.() ?? new Date(0)
                        const db_ = b.criado_em?.toDate?.() ?? new Date(0)
                        return db_ - da
                      })
                      .map(o => (
                        <tr
                          key={o.id}
                          style={{ cursor: 'pointer' }}
                          onClick={() => { setSelectedSegurado(null); onSelectOS(o) }}
                        >
                          <td data-label="Data">{fmtDate(o.data_chegada)}</td>
                          <td data-label="Seguradora">{o.seguradora || '—'}</td>
                          <td data-label="Serviço">{o.servico || '—'}</td>
                          <td data-label="Status">
                            <span className={`badge ${badgeCls(o.status)}`}>{badgeLabel(o.status)}</span>
                          </td>
                          <td data-label="⭐ Nota" style={{ textAlign: 'center' }}>
                            {o.avaliacao_nota
                              ? <span style={{ color: '#f0a020', fontWeight: 700 }}>{'★'.repeat(o.avaliacao_nota)}</span>
                              : <span style={{ color: 'var(--muted)' }}>—</span>}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-sm btn-view" onClick={() => setSelectedSegurado(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
