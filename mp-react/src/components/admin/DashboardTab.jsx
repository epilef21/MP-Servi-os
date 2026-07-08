import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { useAdminContext } from '../../contexts/AdminContext.jsx'
import { PLANOS } from '../../firebase.js'
import { getLucro, fmtBRL, fmtDate } from '../../utils/formatters.js'
import {
  ClipboardList, CalendarDays, Hourglass, Wallet, TrendingUp, Clock,
  PieChart as PieChartIcon, Package, Tag, AlertTriangle, Ban,
} from 'lucide-react'

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const PIE_COLORS = {
  aguardando_tecnico: '#f05a1a',
  pendente:           '#f59e0b',
  processado:         '#2d8a4e',
  enviado:            '#1a3fa8',
}

import { badgeLabel, badgeCls } from './statusMeta.js'

function CustomBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="custom-tooltip">
      <div className="ct-label">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="ct-row">
          <span className="ct-dot" style={{ background: p.color }} />
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  )
}

export default function DashboardTab() {
  const { reports, loading, empresa, totalMes, limite, setAbaAtiva, setSelected } = useAdminContext()

  const [filtMes, setFiltMes] = useState(() => new Date().toISOString().slice(0, 7))

  const today      = new Date().toISOString().slice(0, 10)
  const planoAtual = empresa?.plano || 'basico'
  const planoInfo  = PLANOS[planoAtual] || PLANOS.basico
  const usagePct   = planoInfo.limiteOS === -1 ? 0 : Math.min(100, Math.round((totalMes / planoInfo.limiteOS) * 100))
  const usageCls   = usagePct >= 90 ? 'danger' : usagePct >= 70 ? 'warn' : ''

  const stats = useMemo(() => {
    const mesReports = filtMes
      ? reports.filter(r => {
          try {
            const d = r.criado_em?.toDate?.()
            return d && d.toISOString().slice(0, 7) === filtMes
          } catch { return false }
        })
      : reports
    const lucroTotal = mesReports.reduce((acc, r) => {
      const l = getLucro(r)
      return l !== null ? acc + l : acc
    }, 0)
    const now = new Date()
    const mesAtual = now.getMonth()
    const anoAtual = now.getFullYear()
    const totalMesCount = reports.filter(r => {
      try {
        const d = r.criado_em?.toDate?.() || new Date(r.criado_em)
        return d.getMonth() === mesAtual && d.getFullYear() === anoAtual
      } catch { return false }
    }).length
    const nomeMes = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    return {
      total: reports.length,
      totalMesCount,
      nomeMes,
      hoje: reports.filter(r => {
        try {
          const d = r.criado_em?.toDate?.()
          return d && d.toISOString().slice(0, 10) === today
        } catch { return false }
      }).length,
      aguardando: reports.filter(r => r.status === 'aguardando_tecnico').length,
      pendentes:  reports.filter(r => (r.status || 'pendente') === 'pendente').length,
      lucroTotal,
      hasLucro:  mesReports.some(r => getLucro(r) !== null),
      mesCount:  mesReports.length,
    }
  }, [reports, filtMes, today])

  const chartData = useMemo(() => {
    const now   = new Date()
    const meses = []
    for (let i = 5; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      meses.push({ key, label: MESES_ABREV[d.getMonth()], criadas: 0, finalizadas: 0 })
    }
    reports.forEach(r => {
      try {
        const d   = r.criado_em?.toDate?.()
        if (!d) return
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const m   = meses.find(m => m.key === key)
        if (!m) return
        m.criadas++
        if (r.status === 'processado' || r.status === 'enviado') m.finalizadas++
      } catch { /* ignora */ }
    })
    return meses.map(({ label, criadas, finalizadas }) => ({ label, criadas, finalizadas }))
  }, [reports])

  const pieData = useMemo(() => {
    const counts = { aguardando_tecnico: 0, pendente: 0, processado: 0, enviado: 0 }
    reports.forEach(r => {
      const s = r.status || 'pendente'
      if (s in counts) counts[s]++
    })
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({ name: badgeLabel(key), value, color: PIE_COLORS[key] }))
  }, [reports])

  // Enquanto as OS não chegaram do Firestore, mostrar carregamento —
  // sem isso o dashboard exibia "0" e "Sem dados" enganosos por alguns segundos
  if (loading) {
    return (
      <div className="tab-content">
        <div className="loading-state" style={{ padding: '60px 0' }}>
          <div className="spinner" />
          <div className="loading-text">Carregando o resumo do mês...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="tab-content">
      <div className="metrics-grid">
        <div className="metric-card blue">
          <div className="metric-icon"><ClipboardList size={24} strokeWidth={2} /></div>
          <div className="metric-label">Total do Mês</div>
          <div className="metric-value">{stats.totalMesCount}</div>
          <div className="metric-sub">{stats.nomeMes}</div>
        </div>
        <div className="metric-card orange">
          <div className="metric-icon"><CalendarDays size={24} strokeWidth={2} /></div>
          <div className="metric-label">Hoje</div>
          <div className="metric-value">{stats.hoje}</div>
          <div className="metric-sub">registradas hoje</div>
        </div>
        <div className="metric-card yellow">
          <div className="metric-icon"><Hourglass size={24} strokeWidth={2} /></div>
          <div className="metric-label">Pendentes</div>
          <div className="metric-value">{stats.pendentes}</div>
          <div className="metric-sub">aguardando revisão</div>
        </div>
        <div className="metric-card green">
          <div className="metric-icon"><Wallet size={24} strokeWidth={2} /></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="metric-label">Lucro do Mês</div>
            <input
              type="month" value={filtMes}
              onChange={e => setFiltMes(e.target.value)}
              style={{ border: '1px solid var(--border)', borderRadius: 5, padding: '2px 6px', fontSize: '.68rem', fontFamily: 'Barlow,sans-serif', background: 'var(--light)', color: 'var(--text)', outline: 'none' }}
            />
          </div>
          {stats.hasLucro
            ? <div className={`metric-value${stats.lucroTotal >= 0 ? ' green' : ' red'}`}>{fmtBRL(stats.lucroTotal)}</div>
            : <div className="metric-value" style={{ fontSize: '1.1rem', color: 'var(--muted)' }}>Sem dados</div>
          }
          <div className="metric-sub">{stats.mesCount} OS com financeiro</div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="chart-card">
          <div className="chart-card-title"><TrendingUp size={19} strokeWidth={2} style={{ verticalAlign: '-3px', marginRight: 6 }} />Atividade dos Últimos 6 Meses</div>
          {reports.length === 0
            ? <div className="chart-empty">Nenhuma OS registrada ainda.</div>
            : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8eef6" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7c93' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#6b7c93' }} allowDecimals={false} />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                  <Bar dataKey="criadas"     name="OS Criadas"     fill="#1a3fa8" radius={[4,4,0,0]} />
                  <Bar dataKey="finalizadas" name="OS Finalizadas" fill="#f05a1a" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>

        <div className="chart-card">
          <div className="chart-card-title"><Clock size={19} strokeWidth={2} style={{ verticalAlign: '-3px', marginRight: 6 }} />Últimas OS</div>
          {reports.length === 0
            ? <div className="chart-empty">Nenhuma OS ainda.</div>
            : (
              <div className="recent-os-list">
                {reports.slice(0, 5).map(r => (
                  <div key={r.id} className="recent-os-item" onClick={() => { setSelected(r); setAbaAtiva('os') }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="recent-os-name">{r.nome_segurado || '—'}</div>
                      <div className="recent-os-meta">{r.cidade || '—'} · {fmtDate(r.data_chegada)}</div>
                    </div>
                    <span className={`badge ${badgeCls(r.status)}`} style={{ fontSize: '.65rem' }}>{badgeLabel(r.status)}</span>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      </div>

      <div className="dashboard-bottom">
        <div className="chart-card">
          <div className="chart-card-title"><PieChartIcon size={19} strokeWidth={2} style={{ verticalAlign: '-3px', marginRight: 6 }} />Distribuição por Status</div>
          {pieData.length === 0
            ? <div className="chart-empty">Sem dados.</div>
            : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pieData.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '.85rem' }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                      <span style={{ color: 'var(--text)', fontWeight: 500 }}>{d.name}</span>
                      <span style={{ fontFamily: 'Barlow Condensed,sans-serif', fontWeight: 900, fontSize: '1.1rem', color: 'var(--text)', marginLeft: 'auto' }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          }
        </div>

        <div className="chart-card">
          <div className="chart-card-title"><Package size={19} strokeWidth={2} style={{ verticalAlign: '-3px', marginRight: 6 }} />Plano Atual</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <span className="plan-badge" style={{ fontSize: '.9rem', padding: '6px 16px' }}>
                <Tag size={15} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />{planoAtual.charAt(0).toUpperCase() + planoAtual.slice(1)}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'OS este mês', value: `${totalMes} / ${planoInfo.limiteOS === -1 ? '∞' : planoInfo.limiteOS}` },
                { label: 'Preço',       value: `R$ ${planoInfo.preco}/mês` },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                  <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>{label}</span>
                  <span style={{ fontSize: '.9rem', fontWeight: 700, color: 'var(--text)' }}>{value}</span>
                </div>
              ))}
            </div>
            {planoInfo.limiteOS !== -1 && (
              <div className="usage-bar-wrap">
                <div className="usage-bar-track">
                  <div className={`usage-bar-fill ${usageCls}`} style={{ width: `${usagePct}%` }} />
                </div>
                <div className="usage-bar-labels">
                  <span>{totalMes} usadas</span>
                  <span>{usagePct}%</span>
                </div>
              </div>
            )}
            {limite.aviso && (
              <div style={{ background: '#fff8ec', borderRadius: 8, padding: '10px 14px', fontSize: '.8rem', color: 'var(--warn-text)', fontWeight: 600 }}>
                <AlertTriangle size={15} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />{limite.restantes} OS restantes no plano
              </div>
            )}
            {limite.bloqueado && (
              <div style={{ background: '#fff5f5', borderRadius: 8, padding: '10px 14px', fontSize: '.8rem', color: 'var(--danger)', fontWeight: 600 }}>
                <Ban size={15} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />Limite atingido — entre em contato para upgrade
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
