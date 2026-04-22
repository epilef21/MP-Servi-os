// ============================================================
// SUPERADMIN — /superadmin
// Painel geral: lista todas as empresas, ativa/desativa,
// troca plano manualmente. Acessível apenas pelo superadmin.
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  db,
  listarTodasEmpresas,
  refEmpresa,
  refChecklist,
  updateDoc,
  getDocs,
  query,
  where,
  PLANOS,
} from '../firebase'
import { useAuth } from '../contexts/AuthContext'

// Formata data Firestore Timestamp ou string para exibição
function formatarData(valor) {
  if (!valor) return '—'
  const d = valor?.toDate ? valor.toDate() : new Date(valor)
  return d.toLocaleDateString('pt-BR')
}

// Conta OS do mês atual para uma empresa
async function contarOSMes(empresaId) {
  try {
    const inicio = new Date()
    inicio.setDate(1)
    inicio.setHours(0, 0, 0, 0)
    const q = query(refChecklist(empresaId), where('criado_em', '>=', inicio))
    const snap = await getDocs(q)
    return snap.size
  } catch {
    return 0
  }
}

export default function SuperAdminPage() {
  const navigate = useNavigate()
  const { logout, isSuperAdmin, loadingAuth } = useAuth()

  const [empresas,      setEmpresas]      = useState([])
  const [osPoEmpresa,   setOsPorEmpresa]  = useState({})
  const [loading,       setLoading]       = useState(true)
  const [erro,          setErro]          = useState('')
  const [filtro,        setFiltro]        = useState('')
  const [salvando,      setSalvando]      = useState(null) // empresaId sendo salvo

  // Redireciona se não for superadmin após auth resolver
  useEffect(() => {
    if (!loadingAuth && !isSuperAdmin) {
      navigate('/login', { replace: true })
    }
  }, [loadingAuth, isSuperAdmin, navigate])

  // Carrega lista de empresas e contagem de OS do mês
  const carregarEmpresas = useCallback(async () => {
    setLoading(true)
    setErro('')
    try {
      const lista = await listarTodasEmpresas()
      setEmpresas(lista)

      // Conta OS do mês para cada empresa em paralelo
      const contagens = await Promise.all(
        lista.map(async (e) => ({ id: e.id, total: await contarOSMes(e.id) }))
      )
      const mapa = {}
      contagens.forEach(({ id, total }) => { mapa[id] = total })
      setOsPorEmpresa(mapa)
    } catch (err) {
      console.error('[SuperAdmin] Erro ao carregar empresas:', err)
      setErro('Erro ao carregar empresas. Tente recarregar a página.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isSuperAdmin) carregarEmpresas()
  }, [isSuperAdmin, carregarEmpresas])

  // Ativa ou desativa uma empresa
  async function toggleAtivo(empresa) {
    setSalvando(empresa.id)
    try {
      await updateDoc(refEmpresa(empresa.id), { ativo: !empresa.ativo })
      setEmpresas(prev =>
        prev.map(e => e.id === empresa.id ? { ...e, ativo: !e.ativo } : e)
      )
    } catch (err) {
      console.error('[SuperAdmin] Erro ao alterar status:', err)
      alert('Erro ao alterar status da empresa.')
    } finally {
      setSalvando(null)
    }
  }

  // Altera o plano de uma empresa
  async function alterarPlano(empresa, novoPlano) {
    if (empresa.plano === novoPlano) return
    setSalvando(empresa.id)
    try {
      await updateDoc(refEmpresa(empresa.id), { plano: novoPlano })
      setEmpresas(prev =>
        prev.map(e => e.id === empresa.id ? { ...e, plano: novoPlano } : e)
      )
    } catch (err) {
      console.error('[SuperAdmin] Erro ao alterar plano:', err)
      alert('Erro ao alterar plano da empresa.')
    } finally {
      setSalvando(null)
    }
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  // Filtra empresas pelo nome ou slug
  const empresasFiltradas = empresas.filter(e => {
    if (!filtro) return true
    const t = filtro.toLowerCase()
    return (
      e.nome?.toLowerCase().includes(t) ||
      e.slug?.toLowerCase().includes(t) ||
      e.email?.toLowerCase().includes(t)
    )
  })

  // Totalizadores do painel
  const totalAtivas   = empresas.filter(e => e.ativo).length
  const totalInativas = empresas.filter(e => !e.ativo).length
  const totalOSMes    = Object.values(osPoEmpresa).reduce((a, b) => a + b, 0)

  if (loadingAuth) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--light)' }}>

      {/* ── Topbar ── */}
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-icon" style={{ background: 'transparent', padding: 0 }}>
            <img src="/logo.png" height="32" alt="AssistHub" style={{ display: 'block' }} />
          </div>
          <div>
            <div className="topbar-title">AssistHub <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>SuperAdmin</span></div>
            <div className="topbar-sub">Painel geral de empresas</div>
          </div>
        </div>
        <div className="topbar-right">
          <button className="btn-logout" onClick={handleLogout}>Sair</button>
        </div>
      </div>

      <div className="admin-main" style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 20px' }}>

        {erro && (
          <div className="alert alert-danger" style={{ marginBottom: '16px' }}>{erro}</div>
        )}

        {/* ── Cards de resumo ── */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: '22px' }}>
          <div className="stat-card blue">
            <div className="stat-label">Total de empresas</div>
            <div className="stat-value">{empresas.length}</div>
          </div>
          <div className="stat-card green">
            <div className="stat-label">Ativas</div>
            <div className="stat-value green">{totalAtivas}</div>
          </div>
          <div className="stat-card red">
            <div className="stat-label">Inativas</div>
            <div className="stat-value red">{totalInativas}</div>
          </div>
          <div className="stat-card gold">
            <div className="stat-label">OS no mês (total)</div>
            <div className="stat-value">{totalOSMes}</div>
          </div>
        </div>

        {/* ── Barra de filtro ── */}
        <div className="filter-bar">
          <span className="filter-label">Buscar</span>
          <input
            className="filter-input flex-1"
            type="text"
            placeholder="Nome, slug ou e-mail..."
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
          />
          <button
            className="btn-new-os"
            onClick={carregarEmpresas}
            disabled={loading}
            style={{ padding: '8px 16px', fontSize: '.85rem' }}
          >
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>

        {/* ── Tabela de empresas ── */}
        <div className="table-wrap">
          <div className="table-head">
            <h3>Empresas cadastradas</h3>
            <span className="table-count">{empresasFiltradas.length} empresa(s)</span>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner" />
              <p className="loading-text">Carregando empresas...</p>
            </div>
          ) : empresasFiltradas.length === 0 ? (
            <div className="empty-state">
              <div className="e-icon">🏢</div>
              <p>Nenhuma empresa encontrada.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Slug / Link</th>
                  <th>E-mail</th>
                  <th>Plano</th>
                  <th>OS do mês</th>
                  <th>Cadastro</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {empresasFiltradas.map(empresa => {
                  const osMes     = osPoEmpresa[empresa.id] ?? '—'
                  const planoInfo = PLANOS[empresa.plano] ?? PLANOS.basico
                  const limite    = planoInfo.limiteOS === -1 ? '∞' : planoInfo.limiteOS
                  const bloqueado = salvando === empresa.id

                  return (
                    <tr key={empresa.id}>
                      {/* Nome */}
                      <td data-label="Empresa">
                        <strong style={{ color: 'var(--primary)' }}>{empresa.nome}</strong>
                      </td>

                      {/* Slug */}
                      <td data-label="Slug">
                        <span style={{ fontFamily: 'monospace', fontSize: '.82rem', color: '#555' }}>
                          /{empresa.slug}
                        </span>
                      </td>

                      {/* E-mail */}
                      <td data-label="E-mail" style={{ fontSize: '.83rem' }}>
                        {empresa.email || '—'}
                      </td>

                      {/* Plano — select editável */}
                      <td data-label="Plano">
                        <select
                          value={empresa.plano || 'basico'}
                          onChange={e => alterarPlano(empresa, e.target.value)}
                          disabled={bloqueado}
                          style={{
                            border: '1.5px solid var(--border)',
                            borderRadius: '5px',
                            padding: '4px 8px',
                            fontSize: '.82rem',
                            fontFamily: 'Barlow, sans-serif',
                            cursor: 'pointer',
                            background: '#fff',
                          }}
                        >
                          {Object.keys(PLANOS).map(p => (
                            <option key={p} value={p}>
                              {p.charAt(0).toUpperCase() + p.slice(1)}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* OS do mês */}
                      <td data-label="OS do mês" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1rem', fontWeight: 700 }}>
                        {osMes}
                        <span style={{ color: 'var(--muted)', fontSize: '.72rem', fontWeight: 400, marginLeft: '3px' }}>
                          /{limite}
                        </span>
                      </td>

                      {/* Data de cadastro */}
                      <td data-label="Cadastro" style={{ fontSize: '.82rem', color: 'var(--muted)' }}>
                        {formatarData(empresa.criadoEm)}
                      </td>

                      {/* Badge de status */}
                      <td data-label="Status">
                        <span className={`badge ${empresa.ativo ? 'processado' : 'pendente'}`}>
                          {empresa.ativo ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>

                      {/* Ações */}
                      <td data-label="Ações">
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {/* Ativar / Desativar */}
                          <button
                            className={`btn-sm ${empresa.ativo ? 'btn-pdf' : 'btn-ok'}`}
                            onClick={() => toggleAtivo(empresa)}
                            disabled={bloqueado}
                            title={empresa.ativo ? 'Desativar empresa' : 'Ativar empresa'}
                          >
                            {bloqueado ? '...' : empresa.ativo ? 'Desativar' : 'Ativar'}
                          </button>

                          {/* Ir para o painel da empresa */}
                          <button
                            className="btn-sm btn-view"
                            onClick={() => navigate(`/${empresa.slug}/admin`)}
                            title="Abrir painel da empresa"
                          >
                            Painel
                          </button>

                          {/* Abrir formulário do técnico */}
                          <button
                            className="btn-sm btn-link"
                            onClick={() => window.open(`/${empresa.slug}`, '_blank')}
                            title="Abrir formulário do técnico"
                          >
                            Form
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}
