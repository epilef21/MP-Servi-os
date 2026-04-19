// ============================================================
// ADMIN PAGE — Painel da empresa (multi-tenant)
// Acessível em /:slug/admin — protegido por RotaAdmin no App.jsx
// Usa useEmpresa() para isolar dados por empresaId
// ============================================================
import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  db,
  getOSdaEmpresa,
  criarOS,
  atualizarOS,
  contarOSdoMes,
  refChecklist,
  doc,
  serverTimestamp,
} from '../firebase.js'
import { useAuth }    from '../contexts/AuthContext.jsx'
import { useEmpresa } from '../hooks/useEmpresa.js'
import { generatePDF } from '../utils/pdfGenerator.js'
import { generatePNG } from '../utils/pngGenerator.js'

// ── Helpers de formatação ────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—'
  if (typeof d === 'string' && d.includes('-')) {
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }
  return d
}
function fmtDatetime(ts) {
  if (!ts) return '—'
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleString('pt-BR')
  } catch { return '—' }
}
function fmtSN(v) {
  return v === 'sim' ? '✅ Sim' : v === 'nao' ? '❌ Não' : '—'
}
function fmtBRL(v) {
  const n = parseFloat(v)
  if (isNaN(n)) return '—'
  return `R$ ${n.toFixed(2).replace('.', ',')}`
}
function getLucro(r) {
  const mos = parseFloat(r.mo_seguradora)      || 0
  const vpt = parseFloat(r.valor_prestador)    || 0
  const vds = parseFloat(r.valor_deslocamento) || 0
  return (mos || vpt || vds) ? (mos - vpt) + vds : null
}

const STATUS_META = {
  aguardando_tecnico: { label: '🔔 Aguardando Técnico', cls: 'aguardando' },
  pendente:           { label: '⏳ Pendente',            cls: 'pendente'   },
  processado:         { label: '✅ Processado',          cls: 'processado' },
  enviado:            { label: '📤 Enviado',             cls: 'enviado'    },
}
const badgeLabel = s => STATUS_META[s]?.label ?? STATUS_META.pendente.label
const badgeCls   = s => STATUS_META[s]?.cls   ?? 'pendente'

const OS_INITIAL = {
  seguradora: '', num_assist: '', nome_segurado: '',
  tel_segurado: '', cep: '', endereco: '', numero: '', cidade: '',
  data_atend: '', hora_atend: '', servico: '', desc_problema: '',
}

// ── Componente principal ─────────────────────────────────────
export default function AdminPage() {
  const navigate = useNavigate()
  const { logout, empresaId: empresaIdAuth } = useAuth()

  // Hook que detecta o slug da URL e busca os dados da empresa
  const { empresa, config, slug, verificarLimite, loading: loadingEmpresa } = useEmpresa()

  // empresaId vem do hook useEmpresa (mais confiável — baseado no slug da URL)
  const empresaId = empresa?.id ?? null

  // Seguradoras dinâmicas vindas da config da empresa
  const seguradoras = config?.seguradoras ?? ['Tempo', 'Mapfre', 'Maxpar', 'Allianz']

  // ── Estado de dados ──────────────────────────────────────
  const [reports,   setReports]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [updating,  setUpdating]  = useState(false)
  const [totalMes,  setTotalMes]  = useState(0)

  // ── Filtros ──────────────────────────────────────────────
  const [busca,      setBusca]      = useState('')
  const [filtStatus, setFiltStatus] = useState('')
  const [filtData,   setFiltData]   = useState('')
  const [filtMes,    setFiltMes]    = useState(() => new Date().toISOString().slice(0, 7))

  // ── Modais ───────────────────────────────────────────────
  const [selected,     setSelected]     = useState(null)
  const [showOsForm,   setShowOsForm]   = useState(false)
  const [osForm,       setOsForm]       = useState(OS_INITIAL)
  const [osErrors,     setOsErrors]     = useState({})
  const [osCepLoading, setOsCepLoading] = useState(false)
  const [savingOs,     setSavingOs]     = useState(false)
  const osEnderecoRef = useRef(null)
  const [generatedLink, setGeneratedLink] = useState(null)
  const [copied,        setCopied]        = useState(false)
  const [genPng,        setGenPng]        = useState(false)

  // ── Financeiro (detalhe da OS) ───────────────────────────
  const [finForm,   setFinForm]   = useState({ mo_seguradora: '', valor_prestador: '', valor_deslocamento: '' })
  const [savingFin, setSavingFin] = useState(false)

  // ── Garante que o admin logado pertence a esta empresa ───
  // (segurança extra além da RotaAdmin no App.jsx)
  useEffect(() => {
    if (!loadingEmpresa && empresaId && empresaIdAuth && empresaId !== empresaIdAuth) {
      navigate('/login', { replace: true })
    }
  }, [loadingEmpresa, empresaId, empresaIdAuth, navigate])

  // ── Carrega OS da empresa ────────────────────────────────
  async function loadReports() {
    if (!empresaId) return
    setLoading(true)
    setError(null)
    try {
      const lista = await getOSdaEmpresa(empresaId)
      setReports(lista)

      // Conta OS do mês para exibir limite do plano
      const count = await contarOSdoMes(empresaId)
      setTotalMes(count)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (empresaId) loadReports()
  }, [empresaId])

  // Sincroniza finForm ao abrir detalhe de uma OS diferente
  useEffect(() => {
    if (!selected) return
    setFinForm({
      mo_seguradora:      String(selected.mo_seguradora      ?? ''),
      valor_prestador:    String(selected.valor_prestador    ?? ''),
      valor_deslocamento: String(selected.valor_deslocamento ?? ''),
    })
  }, [selected?.id])

  // ── Estatísticas do dashboard ────────────────────────────
  const today = new Date().toISOString().slice(0, 10)
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

    return {
      total:      reports.length,
      hoje:       reports.filter(r => {
        try {
          const d = r.criado_em?.toDate?.()
          return d && d.toISOString().slice(0, 10) === today
        } catch { return false }
      }).length,
      aguardando: reports.filter(r => r.status === 'aguardando_tecnico').length,
      pendentes:  reports.filter(r => (r.status || 'pendente') === 'pendente').length,
      lucroTotal,
      hasLucro:   mesReports.some(r => getLucro(r) !== null),
      mesCount:   mesReports.length,
    }
  }, [reports, filtMes])

  // ── Tabela filtrada ──────────────────────────────────────
  const filtered = useMemo(() => {
    const b = busca.toLowerCase()
    return reports.filter(r => {
      const txt = `${r.nome_segurado || ''} ${r.seguradora || ''} ${r.cidade || ''} ${r.num_assist || ''} ${r.servico || ''}`.toLowerCase()
      return (!b || txt.includes(b))
        && (!filtStatus || (r.status || 'pendente') === filtStatus)
        && (!filtData || r.data_chegada === filtData)
    })
  }, [reports, busca, filtStatus, filtData])

  // ── Limite do plano ──────────────────────────────────────
  const limite = verificarLimite(totalMes)

  // ── Altera status de uma OS ──────────────────────────────
  async function changeStatus(id, newStatus) {
    setUpdating(true)
    try {
      await atualizarOS(empresaId, id, { status: newStatus })
      setReports(p => p.map(r => r.id === id ? { ...r, status: newStatus } : r))
      if (selected?.id === id) setSelected(p => ({ ...p, status: newStatus }))
    } catch (e) {
      alert('Erro: ' + e.message)
    } finally {
      setUpdating(false)
    }
  }

  // ── Campo do formulário de nova OS ──────────────────────
  function setOsField(k, v) {
    setOsForm(p => ({ ...p, [k]: v }))
    if (osErrors[k]) setOsErrors(p => ({ ...p, [k]: false }))
  }

  // ── Busca CEP no formulário de nova OS ──────────────────
  async function handleOsCEPChange(e) {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 8)
    setOsField('cep', raw)
    if (raw.length !== 8) return
    setOsForm(p => ({ ...p, endereco: '', cidade: '' }))
    setOsCepLoading(true)
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${raw}/json/`)
      const data = await res.json()
      if (data.erro) { setOsCepLoading(false); return }
      const cidade = `${data.localidade} - ${data.uf}`
      if (data.logradouro && data.bairro) {
        setOsForm(p => ({ ...p, endereco: `${data.logradouro} - ${data.bairro}`, cidade }))
        setTimeout(() => osEnderecoRef.current?.nextElementSibling?.focus(), 50)
      } else {
        setOsForm(p => ({ ...p, cidade }))
        setTimeout(() => osEnderecoRef.current?.focus(), 50)
      }
    } catch { /* falha de rede: silencioso */ }
    finally { setOsCepLoading(false) }
  }

  // ── Validação do formulário de nova OS ───────────────────
  function validateOs() {
    const required = ['seguradora', 'num_assist', 'nome_segurado', 'endereco', 'cidade', 'servico', 'desc_problema']
    const errs = {}
    required.forEach(f => { if (!osForm[f]?.trim()) errs[f] = true })
    setOsErrors(errs)
    return !Object.keys(errs).length
  }

  // ── Monta link pré-preenchido para o técnico ─────────────
  // Usa /:slug em vez de / para multi-tenant
  function buildLink(r) {
    const p = new URLSearchParams({
      os: r.id, seguradora: r.seguradora || '', num_assist: r.num_assist || '',
      nome_segurado: r.nome_segurado || '', tel_segurado: r.tel_segurado || '',
      endereco: r.endereco || '', cidade: r.cidade || '',
      data_chegada: r.data_chegada || '', hora_chegada: r.hora_chegada || '',
      servico: r.servico || '', desc_problema: r.desc_problema || '',
    })
    return `${window.location.origin}/${slug}?${p.toString()}`
  }

  // ── Salva nova OS no Firestore da empresa ────────────────
  async function saveOs() {
    if (!validateOs()) return

    // Bloqueia criação se atingiu o limite do plano
    if (limite.bloqueado) {
      alert(`Limite de ${limite.limite} OS/mês atingido. Faça upgrade do plano para continuar.`)
      return
    }

    setSavingOs(true)
    try {
      const enderecoFinal = osForm.endereco + (osForm.numero ? ', ' + osForm.numero : '')
      const payload = {
        seguradora:    osForm.seguradora,
        num_assist:    osForm.num_assist,
        nome_segurado: osForm.nome_segurado,
        tel_segurado:  osForm.tel_segurado || '',
        endereco:      enderecoFinal,
        cidade:        osForm.cidade,
        data_chegada:  osForm.data_atend || '',
        hora_chegada:  osForm.hora_atend || '',
        servico:       osForm.servico,
        desc_problema: osForm.desc_problema,
        status:        'aguardando_tecnico',
        origem:        'admin',
      }

      // criarOS isola a escrita na subcoleção da empresa
      const ref    = await criarOS(empresaId, payload)
      const newRec = { id: ref.id, ...payload, criado_em: { toDate: () => new Date() } }

      setReports(p => [newRec, ...p])
      setTotalMes(p => p + 1)
      setShowOsForm(false)
      setOsForm(OS_INITIAL)
      setOsErrors({})
      setGeneratedLink({
        link:       buildLink(newRec),
        os:         ref.id,
        nome:       osForm.nome_segurado,
        seguradora: osForm.seguradora,
        num_assist: osForm.num_assist,
      })
    } catch (e) {
      alert('Erro ao salvar OS: ' + e.message)
    } finally {
      setSavingOs(false)
    }
  }

  // ── Copia link para a área de transferência ──────────────
  async function copyLink(link) {
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      const el = document.createElement('textarea')
      el.value = link
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // ── Salva fechamento financeiro da OS ────────────────────
  async function saveFin() {
    setSavingFin(true)
    try {
      const payload = {
        mo_seguradora:      parseFloat(finForm.mo_seguradora)      || 0,
        valor_prestador:    parseFloat(finForm.valor_prestador)    || 0,
        valor_deslocamento: parseFloat(finForm.valor_deslocamento) || 0,
      }
      await atualizarOS(empresaId, selected.id, payload)
      const updated = { ...selected, ...payload }
      setReports(p => p.map(r => r.id === selected.id ? updated : r))
      setSelected(updated)
    } catch (e) {
      alert('Erro ao salvar financeiro: ' + e.message)
    } finally {
      setSavingFin(false)
    }
  }

  // ── Gera PNG WhatsApp ────────────────────────────────────
  async function handlePNG(r) {
    setGenPng(true)
    try { await generatePNG(r) } catch (e) { alert('Erro ao gerar PNG: ' + e.message) }
    finally { setGenPng(false) }
  }

  // ── Logout via Firebase Auth ─────────────────────────────
  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  // ── Tela de carregamento da empresa ─────────────────────
  if (loadingEmpresa) {
    return (
      <div className="loading-state" style={{ paddingTop: '20vh' }}>
        <div className="spinner" />
        <p className="loading-text">Carregando painel...</p>
      </div>
    )
  }

  // ── RENDER ───────────────────────────────────────────────
  return (
    <>
      {/* ── TOPBAR ── */}
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-icon">🏠</div>
          <div>
            {/* Nome da empresa vem da config do Firestore */}
            <div className="topbar-title">
              {config?.nome || empresa?.nome || 'Painel Admin'}
              <span className="topbar-sub"> / Admin</span>
            </div>
            {/* Aviso de limite do plano */}
            {limite.aviso && (
              <div style={{ fontSize: '.7rem', color: '#e8a020', fontWeight: 600 }}>
                ⚠️ {limite.restantes} OS restantes no plano
              </div>
            )}
          </div>
        </div>
        <div className="topbar-right">
          <button
            className="btn-new-os"
            onClick={() => setShowOsForm(true)}
            disabled={limite.bloqueado}
            title={limite.bloqueado ? `Limite de ${limite.limite} OS/mês atingido` : 'Nova OS'}
          >
            + Nova OS
          </button>
          <button className="btn-secondary" onClick={loadReports} disabled={loading}>
            🔄 Atualizar
          </button>
          <button className="btn-logout" onClick={handleLogout}>Sair</button>
        </div>
      </div>

      {/* ── Aviso de limite bloqueado ── */}
      {limite.bloqueado && (
        <div style={{
          background: '#fdf0f0', borderBottom: '2px solid var(--danger)',
          color: 'var(--danger)', padding: '10px 20px', fontSize: '.88rem',
          fontWeight: 600, textAlign: 'center',
        }}>
          🚫 Limite de {limite.limite} OS/mês atingido. Entre em contato para fazer upgrade do plano.
        </div>
      )}

      <div className="admin-main">

        {/* ── STATS ── */}
        <div className="stats-grid">
          <div className="stat-card blue">
            <div className="stat-label">Total Geral</div>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-sub">ordens de serviço</div>
          </div>
          <div className="stat-card gold">
            <div className="stat-label">Hoje</div>
            <div className="stat-value">{stats.hoje}</div>
            <div className="stat-sub">registradas hoje</div>
          </div>
          <div className="stat-card orange">
            <div className="stat-label">Aguardando Técnico</div>
            <div className="stat-value">{stats.aguardando}</div>
            <div className="stat-sub">link enviado</div>
          </div>
          <div className="stat-card red">
            <div className="stat-label">Pendentes</div>
            <div className="stat-value">{stats.pendentes}</div>
            <div className="stat-sub">aguardando revisão</div>
          </div>
          <div className="stat-card green" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div className="stat-label">💰 Lucro do Mês</div>
              <input
                type="month"
                value={filtMes}
                onChange={e => setFiltMes(e.target.value)}
                style={{ border: '1px solid var(--border)', borderRadius: 5, padding: '2px 6px', fontSize: '.7rem', fontFamily: 'Barlow,sans-serif', background: 'var(--light)', color: 'var(--text)', outline: 'none' }}
              />
            </div>
            {stats.hasLucro ? (
              <>
                <div className={`stat-value ${stats.lucroTotal >= 0 ? 'green' : 'red'}`}>{fmtBRL(stats.lucroTotal)}</div>
                <div className="stat-sub">{stats.mesCount} OS com financeiro</div>
              </>
            ) : (
              <>
                <div className="stat-value" style={{ fontSize: '1.2rem', color: 'var(--muted)' }}>Sem dados</div>
                <div className="stat-sub">nenhuma OS com financeiro</div>
              </>
            )}
          </div>
        </div>

        {/* ── FILTROS ── */}
        <div className="filter-bar">
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

        {/* ── TABELA ── */}
        <div className="table-wrap">
          <div className="table-head">
            <h3>📋 Ordens de Serviço</h3>
            <span className="table-count">{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</span>
          </div>
          {loading && <div className="loading-state"><div className="spinner" /><div className="loading-text">Carregando...</div></div>}
          {error && !loading && <div style={{ padding: 20 }}><div className="err-msg">⚠️ {error}</div></div>}
          {!loading && !error && filtered.length === 0 && (
            <div className="empty-state"><div className="e-icon">📭</div><p>Nenhuma OS encontrada.</p></div>
          )}
          {!loading && !error && filtered.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th><th>Segurado</th><th>Seguradora</th><th>Cidade</th>
                  <th>Serviço</th><th>Lucro</th><th>Status</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const lucro = getLucro(r)
                  return (
                    <tr key={r.id} onClick={() => setSelected(r)}>
                      <td data-label="Data">{fmtDate(r.data_chegada)}</td>
                      <td data-label="Segurado"><strong>{r.nome_segurado || '—'}</strong></td>
                      <td data-label="Seguradora">{r.seguradora || '—'}</td>
                      <td data-label="Cidade">{r.cidade || '—'}</td>
                      <td data-label="Serviço">{r.servico || '—'}</td>
                      <td data-label="Lucro">
                        {lucro !== null
                          ? <span className={`lucro-cell ${lucro >= 0 ? 'pos' : 'neg'}`}>{fmtBRL(lucro)}</span>
                          : <span className="lucro-cell nd">—</span>}
                      </td>
                      <td data-label="Status">
                        <span className={`badge ${badgeCls(r.status)}`}>{badgeLabel(r.status)}</span>
                      </td>
                      <td data-label="Ações" onClick={e => e.stopPropagation()}>
                        <button className="btn-sm btn-view" onClick={() => setSelected(r)}>Ver</button>
                        {r.status === 'aguardando_tecnico' && (
                          <button className="btn-sm btn-link"
                            onClick={() => setGeneratedLink({ link: buildLink(r), os: r.id, nome: r.nome_segurado, seguradora: r.seguradora, num_assist: r.num_assist })}>
                            🔗
                          </button>
                        )}
                        {(r.status || 'pendente') === 'pendente' && (
                          <button className="btn-sm btn-ok" disabled={updating} onClick={() => changeStatus(r.id, 'processado')}>✓</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ══ MODAL: NOVA OS ══ */}
      {showOsForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && (setShowOsForm(false), setOsForm(OS_INITIAL), setOsErrors({}))}>
          <div className="modal-box">
            <div className="modal-header">
              <h2>📞 Nova Ordem de Serviço</h2>
              <button className="btn-sm" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }}
                onClick={() => { setShowOsForm(false); setOsForm(OS_INITIAL); setOsErrors({}) }}>✕ Fechar</button>
            </div>
            <div className="modal-body">
              <div className="os-callout">
                📞 Preencha os dados recebidos por telefone. Após salvar, um link pré-preenchido será gerado para enviar ao técnico via WhatsApp.
              </div>
              <div className="md-section">
                <h3>📋 Dados do Atendimento</h3>
                <div className="os-grid">
                  <div className="field">
                    <label>Seguradora <span className="req">*</span></label>
                    <select value={osForm.seguradora} onChange={e => setOsField('seguradora', e.target.value)} className={osErrors.seguradora ? 'error' : ''}>
                      <option value="">Selecione...</option>
                      {/* Seguradoras dinâmicas da config da empresa */}
                      {seguradoras.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Nº de Assistência <span className="req">*</span></label>
                    <input value={osForm.num_assist} onChange={e => setOsField('num_assist', e.target.value)} className={osErrors.num_assist ? 'error' : ''} placeholder="Ex: 2024-00001" />
                  </div>
                  <div className="field">
                    <label>Data do Atendimento</label>
                    <input type="date" value={osForm.data_atend} onChange={e => setOsField('data_atend', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Horário</label>
                    <input type="time" value={osForm.hora_atend} onChange={e => setOsField('hora_atend', e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="md-section">
                <h3>👤 Dados do Segurado</h3>
                <div className="os-grid">
                  <div className="field">
                    <label>Nome Completo <span className="req">*</span></label>
                    <input value={osForm.nome_segurado} onChange={e => setOsField('nome_segurado', e.target.value)} className={osErrors.nome_segurado ? 'error' : ''} placeholder="Nome do segurado" />
                  </div>
                  <div className="field">
                    <label>Telefone</label>
                    <input type="tel" value={osForm.tel_segurado} onChange={e => setOsField('tel_segurado', e.target.value)} placeholder="(XX) XXXXX-XXXX" />
                  </div>
                  <div className="field" style={{ maxWidth: 160 }}>
                    <label>CEP</label>
                    <div style={{ position: 'relative' }}>
                      <input value={osForm.cep} onChange={handleOsCEPChange}
                        placeholder="00000-000" maxLength={8} inputMode="numeric"
                        style={{ paddingRight: osCepLoading ? 32 : undefined }} />
                      {osCepLoading && (
                        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, border: '2px solid #ccc', borderTopColor: '#1a3a5c', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                      )}
                    </div>
                  </div>
                  <div className="field">
                    <label>Cidade <span className="req">*</span></label>
                    <input value={osForm.cidade} onChange={e => setOsField('cidade', e.target.value)} className={osErrors.cidade ? 'error' : ''} placeholder="Preenchida pelo CEP" />
                  </div>
                  <div className="field" style={{ flex: 3 }}>
                    <label>Endereço <span className="req">*</span></label>
                    <input ref={osEnderecoRef} value={osForm.endereco} onChange={e => setOsField('endereco', e.target.value)} className={osErrors.endereco ? 'error' : ''} placeholder="Rua, bairro (preenchido pelo CEP)" />
                  </div>
                  <div className="field" style={{ flex: 1, minWidth: 90, maxWidth: 140 }}>
                    <label>Número</label>
                    <input value={osForm.numero} onChange={e => setOsField('numero', e.target.value)} placeholder="Ex: 123" />
                  </div>
                </div>
              </div>
              <div className="md-section" style={{ marginBottom: 0 }}>
                <h3>🔧 Serviço</h3>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>Tipo de Serviço <span className="req">*</span></label>
                  <input value={osForm.servico} onChange={e => setOsField('servico', e.target.value)} className={osErrors.servico ? 'error' : ''} placeholder="Ex: Reparo hidráulico..." />
                </div>
                <div className="field">
                  <label>Descrição do Problema <span className="req">*</span></label>
                  <textarea rows={4} value={osForm.desc_problema} onChange={e => setOsField('desc_problema', e.target.value)} className={osErrors.desc_problema ? 'error' : ''} placeholder="Descreva o problema relatado pelo segurado..." />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-sm" style={{ background: 'var(--light)', color: 'var(--muted)', border: '1px solid var(--border)' }}
                onClick={() => { setShowOsForm(false); setOsForm(OS_INITIAL); setOsErrors({}) }}>Cancelar</button>
              <button className="btn-primary" onClick={saveOs} disabled={savingOs} style={{ padding: '9px 22px', fontSize: '.9rem' }}>
                {savingOs ? '⏳ Salvando...' : '💾 Salvar e Gerar Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: LINK GERADO ══ */}
      {generatedLink && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setGeneratedLink(null)}>
          <div className="modal-box" style={{ maxWidth: 560 }}>
            <div className="modal-header" style={{ background: '#1e6e3e' }}>
              <h2>🔗 Link Gerado!</h2>
              <button className="btn-sm" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={() => setGeneratedLink(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="link-info-cards">
                <div className="link-info-card"><span className="link-info-lbl">Segurado</span><span className="link-info-val">{generatedLink.nome}</span></div>
                <div className="link-info-card"><span className="link-info-lbl">Seguradora</span><span className="link-info-val">{generatedLink.seguradora}</span></div>
                <div className="link-info-card"><span className="link-info-lbl">Nº Assistência</span><span className="link-info-val">{generatedLink.num_assist || '—'}</span></div>
              </div>
              <p style={{ fontSize: '.8rem', color: 'var(--muted)', margin: '14px 0 6px' }}>Link para o técnico — já vem com os dados preenchidos:</p>
              <div className="link-box"><span className="link-text">{generatedLink.link}</span></div>
              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                <button className={`btn-copy${copied ? ' copied' : ''}`} onClick={() => copyLink(generatedLink.link)}>
                  {copied ? '✅ Copiado!' : '📋 Copiar Link'}
                </button>
                <a className="btn-whatsapp"
                  href={`https://wa.me/?text=${encodeURIComponent(`Olá! Segue o link para preencher o checklist da OS:\n\n🔗 ${generatedLink.link}\n\nAbra, confira os dados, preencha o serviço realizado e assine. Obrigado!`)}`}
                  target="_blank" rel="noopener noreferrer">
                  📲 Enviar pelo WhatsApp
                </a>
              </div>
              <div className="link-tip">💡 Quando o técnico abrir esse link, o formulário já estará com os dados do cliente preenchidos. Ele só precisará descrever o serviço realizado e assinar.</div>
            </div>
            <div className="modal-footer">
              <button className="btn-sm btn-view" onClick={() => setGeneratedLink(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: DETALHE DA OS ══ */}
      {selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal-box">
            <div className="modal-header">
              <h2>OS — {selected.nome_segurado || ''}</h2>
              <div className="modal-header-btns">
                {selected.status === 'aguardando_tecnico' && (
                  <button className="btn-sm btn-link"
                    onClick={() => setGeneratedLink({ link: buildLink(selected), os: selected.id, nome: selected.nome_segurado, seguradora: selected.seguradora, num_assist: selected.num_assist })}>
                    🔗 Reenviar Link
                  </button>
                )}
                <button className="btn-sm btn-png" disabled={genPng} onClick={() => handlePNG(selected)}>
                  {genPng ? '⏳' : '📱 PNG WhatsApp'}
                </button>
                <button className="btn-sm btn-pdf" onClick={() => generatePDF(selected)}>🖨️ PDF</button>
                <button className="btn-sm" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={() => setSelected(null)}>✕</button>
              </div>
            </div>

            <div className="modal-body">
              {selected.origem === 'admin' && (
                <div style={{ marginBottom: 14 }}>
                  <span className="badge" style={{ background: '#f0f5ff', color: '#1a3a8c', border: '1px solid #b0c4f0' }}>📞 OS Cadastrada Manualmente</span>
                </div>
              )}

              {/* Atendimento */}
              <div className="md-section">
                <h3>📋 Atendimento</h3>
                <div className="md-grid">
                  <div className="md-field"><label>Seguradora</label><p>{selected.seguradora || '—'}</p></div>
                  <div className="md-field"><label>Nº Assistência</label><p>{selected.num_assist || '—'}</p></div>
                  <div className="md-field"><label>Data</label><p>{fmtDate(selected.data_chegada)}</p></div>
                  <div className="md-field"><label>Horários</label><p>{selected.hora_chegada || '—'} → {selected.hora_saida || '—'}</p></div>
                  <div className="md-field span-2"><label>Serviço</label><p>{selected.servico || '—'}</p></div>
                </div>
              </div>

              {/* Segurado */}
              <div className="md-section">
                <h3>👤 Segurado</h3>
                <div className="md-grid">
                  <div className="md-field"><label>Nome</label><p>{selected.nome_segurado || '—'}</p></div>
                  <div className="md-field"><label>Telefone</label><p>{selected.tel_segurado || '—'}</p></div>
                  <div className="md-field"><label>Endereço</label><p>{selected.endereco || '—'}</p></div>
                  <div className="md-field"><label>Cidade</label><p>{selected.cidade || '—'}</p></div>
                </div>
              </div>

              {/* Descrições */}
              {(selected.desc_problema || selected.desc_servico) && (
                <div className="md-section">
                  <h3>📝 Descrições</h3>
                  <div className="md-grid col-1">
                    {selected.desc_problema && <div className="md-field"><label>Descrição do Problema</label><div className="md-text">{selected.desc_problema}</div></div>}
                    {selected.avarias && <div className="md-field"><label>Avarias Pré-Existentes</label><div className="md-text">{selected.avarias}</div></div>}
                    {selected.desc_servico && <div className="md-field"><label>Serviço Realizado</label><div className="md-text">{selected.desc_servico}</div></div>}
                    {selected.pecas && <div className="md-field"><label>Peças / Materiais</label><div className="md-text">{selected.pecas}</div></div>}
                  </div>
                </div>
              )}

              {/* Checkup */}
              {selected.checkup?.length > 0 && (
                <div className="md-section">
                  <h3>✅ Chek-Up</h3>
                  <div className="tags-wrap">
                    {selected.checkup.map((c, i) => (
                      <span key={i} className="tag">✅ {typeof c === 'object' ? `${c.item}${c.quant ? ` (Qtd: ${c.quant})` : ''}` : c}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Conclusão */}
              {selected.problema_solucionado && (
                <div className="md-section">
                  <h3>🏁 Conclusão</h3>
                  <div className="md-grid">
                    <div className="md-field"><label>Problema Solucionado</label><p>{fmtSN(selected.problema_solucionado)}</p></div>
                    <div className="md-field"><label>Haverá Retorno</label><p>{fmtSN(selected.havera_retorno)}</p></div>
                    <div className="md-field"><label>Garantia (90 dias)</label><p>{fmtSN(selected.garantia)}</p></div>
                    <div className="md-field"><label>Excedente</label><p>{selected.excedente || '—'}</p></div>
                  </div>
                </div>
              )}

              {/* Fechamento Financeiro — admin only */}
              <div className="md-section" style={{ background: '#f0f7f0', border: '1px solid #b8ddb8', borderRadius: 8, padding: '14px 16px' }}>
                <h3 style={{ color: '#1e6e3e', marginBottom: 4 }}>🔒 Fechamento Financeiro Interno</h3>
                <p style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: 12 }}>
                  Esses valores não aparecem no formulário do prestador nem no PDF.
                </p>
                <div className="md-grid">
                  {[
                    { key: 'mo_seguradora',      label: 'MO Seguradora (R$)' },
                    { key: 'valor_prestador',    label: 'Valor Prestador (R$)' },
                    { key: 'valor_deslocamento', label: 'Valor Deslocamento (R$)' },
                  ].map(({ key, label }) => (
                    <div className="md-field" key={key}>
                      <label>{label}</label>
                      <input type="number" step="0.01" min="0"
                        value={finForm[key]}
                        onChange={e => setFinForm(p => ({ ...p, [key]: e.target.value }))}
                        placeholder="0,00"
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, fontFamily: 'Barlow,sans-serif', fontSize: '.9rem' }} />
                    </div>
                  ))}
                  <div className="md-field">
                    <label>Lucro Real</label>
                    {(() => {
                      const mos = parseFloat(finForm.mo_seguradora)      || 0
                      const vpt = parseFloat(finForm.valor_prestador)    || 0
                      const vds = parseFloat(finForm.valor_deslocamento) || 0
                      const lucro = (mos - vpt) + vds
                      const hasVal = !!(finForm.mo_seguradora || finForm.valor_prestador || finForm.valor_deslocamento)
                      return hasVal
                        ? <p style={{ fontFamily: 'Barlow Condensed,sans-serif', fontSize: '1.4rem', fontWeight: 900, color: lucro >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmtBRL(lucro)}</p>
                        : <p style={{ color: 'var(--muted)' }}>—</p>
                    })()}
                  </div>
                </div>
                <div style={{ marginTop: 12, textAlign: 'right' }}>
                  <button className="btn-sm btn-ok" disabled={savingFin} onClick={saveFin}>
                    {savingFin ? '⏳ Salvando...' : '💾 Salvar Financeiro'}
                  </button>
                </div>
              </div>

              {/* Fotos */}
              {selected.fotos?.length > 0 && (
                <div className="md-section">
                  <h3>📷 Fotos do Atendimento</h3>
                  <div className="foto-viewer-grid">
                    {selected.fotos.map((url, i) => (
                      <img key={i} src={url} alt={`foto ${i + 1}`} className="foto-viewer-img"
                        onClick={() => window.open(url, '_blank')} />
                    ))}
                  </div>
                </div>
              )}

              {/* Assinaturas */}
              {(selected.assinatura_prestador || selected.assinatura_segurado) && (
                <div className="md-section">
                  <h3>✍️ Assinaturas</h3>
                  <div className="md-grid">
                    <div className="md-field"><label>Prestador</label>{selected.assinatura_prestador ? <img className="sig-img" src={selected.assinatura_prestador} alt="" /> : <p style={{ color: 'var(--muted)' }}>Não registrada</p>}</div>
                    <div className="md-field"><label>Segurado</label>{selected.assinatura_segurado ? <img className="sig-img" src={selected.assinatura_segurado} alt="" /> : <p style={{ color: 'var(--muted)' }}>Não registrada</p>}</div>
                  </div>
                </div>
              )}

              {/* Meta */}
              <div className="meta-row">
                <div className="meta-item"><label>ID</label><p>{selected.id}</p></div>
                <div className="meta-item"><label>Criado em</label><p>{fmtDatetime(selected.criado_em)}</p></div>
                <div className="meta-item"><label>Status</label><p><span className={`badge ${badgeCls(selected.status)}`}>{badgeLabel(selected.status)}</span></p></div>
              </div>
            </div>

            <div className="modal-footer">
              <span className={`badge ${badgeCls(selected.status)}`} style={{ marginRight: 'auto' }}>{badgeLabel(selected.status)}</span>
              {(selected.status || 'pendente') === 'pendente' && (
                <button className="btn-sm btn-ok" disabled={updating} onClick={() => changeStatus(selected.id, 'processado')}>✓ Processado</button>
              )}
              {selected.status === 'processado' && (
                <button className="btn-sm" style={{ background: '#1a3a8c', color: '#fff' }} disabled={updating} onClick={() => changeStatus(selected.id, 'enviado')}>📤 Enviado</button>
              )}
              <button className="btn-sm btn-png" disabled={genPng} onClick={() => handlePNG(selected)}>
                {genPng ? '⏳ Gerando...' : '📱 PNG WhatsApp'}
              </button>
              <button className="btn-sm btn-pdf" onClick={() => generatePDF(selected)}>🖨️ Baixar PDF</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
