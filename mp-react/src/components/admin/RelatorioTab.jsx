import { useState } from 'react'
import { useAdminContext } from '../../contexts/AdminContext.jsx'
import { agregarRelatorio, gerarRelatorioMensalPdf } from '../../utils/relatorioMensalPdf.js'
import { fmtBRL } from '../../utils/formatters.js'

const MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function RelatorioTab() {
  const { reports, empresa } = useAdminContext()

  const [relMes,   setRelMes]   = useState(new Date().getMonth() + 1)
  const [relAno,   setRelAno]   = useState(new Date().getFullYear())
  const [relDados, setRelDados] = useState(null)

  function gerarRelatorio() {
    setRelDados(agregarRelatorio(reports, relMes, relAno))
  }

  return (
    <div className="tab-content">
      {/* Seletor de período */}
      <div className="filter-bar" style={{ marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <span className="filter-label">Período:</span>
        <select
          className="filter-input"
          value={`${relMes}-${relAno}`}
          onChange={e => {
            const [m, a] = e.target.value.split('-').map(Number)
            setRelMes(m)
            setRelAno(a)
            setRelDados(null)
          }}
        >
          {(() => {
            const now  = new Date()
            const opts = []
            for (let i = 0; i < 12; i++) {
              const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
              const m = d.getMonth() + 1
              const a = d.getFullYear()
              opts.push(
                <option key={`${m}-${a}`} value={`${m}-${a}`}>
                  {MESES_NOMES[d.getMonth()]} {a}
                </option>
              )
            }
            return opts
          })()}
        </select>
        <button className="btn-primary" onClick={gerarRelatorio} style={{ minWidth: 160 }}>
          📊 Gerar Relatório
        </button>
      </div>

      {/* Estado vazio */}
      {!relDados && (
        <div className="empty-state">
          <div className="e-icon">📊</div>
          <p>Selecione um período e clique em <strong>Gerar Relatório</strong> para ver os dados consolidados.</p>
        </div>
      )}

      {/* Resultados */}
      {relDados && (
        <>
          <div className="metrics-grid" style={{ marginBottom: 24 }}>
            <div className="metric-card blue">
              <div className="metric-icon">📋</div>
              <div className="metric-label">Total de OS</div>
              <div className="metric-value">{relDados.totalOS}</div>
              <div className="metric-sub">no período</div>
            </div>
            <div className="metric-card orange">
              <div className="metric-icon">💼</div>
              <div className="metric-label">Com Financeiro</div>
              <div className="metric-value">{relDados.osComLucro}</div>
              <div className="metric-sub">OS com dados de lucro</div>
            </div>
            <div className="metric-card green">
              <div className="metric-icon">💰</div>
              <div className="metric-label">Lucro Total</div>
              <div className={`metric-value${relDados.lucroTotal >= 0 ? ' green' : ' red'}`}>
                {fmtBRL(relDados.lucroTotal)}
              </div>
              <div className="metric-sub">no período</div>
            </div>
            <div className="metric-card yellow">
              <div className="metric-icon">📈</div>
              <div className="metric-label">Média por OS</div>
              <div className="metric-value">{fmtBRL(relDados.mediaPorOS)}</div>
              <div className="metric-sub">OS com financeiro</div>
            </div>
          </div>

          {/* Por status */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--primary)', marginBottom: 10 }}>📋 OS por Status</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.88rem' }}>
              <thead>
                <tr style={{ background: 'var(--primary)', color: '#fff' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', borderRadius: '6px 0 0 0' }}>Status</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Quantidade</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', borderRadius: '0 6px 0 0' }}>Percentual</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(relDados.porStatus).map(([status, count], idx) => {
                  const pct    = relDados.totalOS > 0 ? ((count / relDados.totalOS) * 100).toFixed(1) : '0.0'
                  const labels = { aguardando_tecnico: '🔔 Aguardando Técnico', pendente: '⏳ Pendente', processado: '✅ Processado', enviado: '📤 Enviado' }
                  return (
                    <tr key={status} style={{ background: idx % 2 === 0 ? 'var(--light)' : '#fff', borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '7px 12px' }}>{labels[status] || status}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700 }}>{count}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: 'var(--muted)' }}>{pct}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Por seguradora */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--primary)', marginBottom: 10 }}>🏢 Por Seguradora</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.88rem' }}>
              <thead>
                <tr style={{ background: 'var(--primary)', color: '#fff' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', borderRadius: '6px 0 0 0' }}>Seguradora</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>OS</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', borderRadius: '0 6px 0 0' }}>Lucro Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(relDados.porSeguradora)
                  .sort((a, b) => b[1].lucro - a[1].lucro)
                  .map(([seg, { count, lucro }], idx) => (
                    <tr key={seg} style={{ background: idx % 2 === 0 ? 'var(--light)' : '#fff', borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '7px 12px' }}>{seg}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700 }}>{count}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: lucro >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>{fmtBRL(lucro)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Por técnico */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--primary)', marginBottom: 10 }}>👷 Por Técnico</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.88rem' }}>
              <thead>
                <tr style={{ background: 'var(--primary)', color: '#fff' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', borderRadius: '6px 0 0 0' }}>Técnico</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>OS</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', borderRadius: '0 6px 0 0' }}>Lucro Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(relDados.porTecnico)
                  .sort((a, b) => b[1].lucro - a[1].lucro)
                  .map(([tec, { count, lucro }], idx) => (
                    <tr key={tec} style={{ background: idx % 2 === 0 ? 'var(--light)' : '#fff', borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '7px 12px' }}>{tec}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700 }}>{count}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', color: lucro >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>{fmtBRL(lucro)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              className="btn-primary"
              onClick={() => gerarRelatorioMensalPdf(relDados, relMes, relAno, empresa?.nome)}
            >
              ⬇️ Baixar PDF
            </button>
            <button className="btn-sm btn-view" onClick={() => setRelDados(null)}>
              ✕ Limpar
            </button>
          </div>
        </>
      )}
    </div>
  )
}
