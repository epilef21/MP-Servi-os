// ============================================================
// ADMIN PAGE — Painel da empresa (multi-tenant) — AssistHub
// Orquestrador: layout, sidebar, estado de dados e modais.
// A UI de cada aba/modal vive em components/admin/.
// ============================================================
import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  db,
  auth,
  escutarOSdaEmpresa,
  atualizarOS,
  doc,
  collection,
  getDocs,
  deleteDoc,
  arrayUnion,
  query,
  orderBy,
} from '../firebase.js'
import { useAuth }    from '../contexts/AuthContext.jsx'
import { useEmpresa } from '../hooks/useEmpresa.js'
import { AdminContext } from '../contexts/AdminContext.jsx'
import DashboardTab     from '../components/admin/DashboardTab.jsx'
import OrdensServicoTab from '../components/admin/OrdensServicoTab.jsx'
import OrcamentosTab    from '../components/admin/OrcamentosTab.jsx'
import TecnicosTab      from '../components/admin/TecnicosTab.jsx'
import SeguradosTab     from '../components/admin/SeguradosTab.jsx'
import RelatorioTab     from '../components/admin/RelatorioTab.jsx'
import ConfigTab                from '../components/admin/ConfigTab.jsx'
import FinanceiroEmpresaTab    from '../components/admin/FinanceiroEmpresaTab.jsx'
import ImportarMapfreModal   from '../components/admin/ImportarMapfreModal.jsx'
import NovaOSModal           from '../components/admin/NovaOSModal.jsx'
import LinkGeradoModal       from '../components/admin/LinkGeradoModal.jsx'
import LinkRelatorioModal    from '../components/admin/LinkRelatorioModal.jsx'
import DetalheOSModal        from '../components/admin/DetalheOSModal.jsx'
import NovoOrcamentoModal    from '../components/admin/NovoOrcamentoModal.jsx'
import OrcamentoLinksModal   from '../components/admin/OrcamentoLinksModal.jsx'
import RevisarOrcamentoModal from '../components/admin/RevisarOrcamentoModal.jsx'
import ConverterOSModal      from '../components/admin/ConverterOSModal.jsx'
import { generatePDFCliente, generatePDFSeguradora } from '../utils/orcamentoPdfGenerator.js'
import { copyToClipboard } from '../utils/clipboard.js'
import {
  solicitarPermissaoENotificacao,
  escutarNotificacoesEmPrimeiroPlano,
} from '../utils/notificacoes.js'

// ── Toast component ──────────────────────────────────────────
function Toast({ toast }) {
  return (
    <div className="toast-container">
      <div className={`toast${toast.visible ? ' show' : ''}${toast.type === 'error' ? ' error' : toast.type === 'info' ? ' info' : ''}`}>
        {toast.msg}
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────
export default function AdminPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, empresaId: empresaIdAuth, emailUsuario } = useAuth()

  const { empresa, config, slug, verificarLimite, loading: loadingEmpresa } = useEmpresa()

  const empresaId   = empresa?.id ?? null
  const seguradoras = config?.seguradoras ?? ['Tempo', 'Mapfre', 'Maxpar', 'Allianz']

  // ── Estado de dados ──────────────────────────────────────
  const [reports,    setReports]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [updating,   setUpdating]   = useState(false)
  const [totalMes,   setTotalMes]   = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)

  // ── Navegação ────────────────────────────────────────────
  const [abaAtiva,    setAbaAtiva]    = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // ── Modais OS ────────────────────────────────────────────
  const [selected,           setSelected]           = useState(null)
  const [showOsForm,         setShowOsForm]         = useState(false)
  const [osPrefill,          setOsPrefill]          = useState(null)
  const [showImportarMapfre, setShowImportarMapfre] = useState(false)
  const [generatedLink,      setGeneratedLink]      = useState(null)
  const [linkRelModal,       setLinkRelModal]       = useState(null)

  // ── Técnicos ─────────────────────────────────────────────
  const [tecnicos,        setTecnicos]        = useState([])
  const [loadingTecnicos, setLoadingTecnicos] = useState(false)

  // ── Logo (lida no sidebar, atualizada pelo ConfigTab via contexto) ──
  const [logoPreview, setLogoPreview] = useState(null)

  // ── Orçamentos ───────────────────────────────────────────
  const [orcamentos,      setOrcamentos]      = useState([])
  const [loadingOrc,      setLoadingOrc]      = useState(false)
  const [showNovoOrc,     setShowNovoOrc]     = useState(false)
  const [orcLinks,        setOrcLinks]        = useState(null)
  const [showRevisarOrc,  setShowRevisarOrc]  = useState(false)
  const [revisarOrc,      setRevisarOrc]      = useState(null)
  const [showConverterOS, setShowConverterOS] = useState(false)
  const [converterOrc,    setConverterOrc]    = useState(null)

  // ── Toast ────────────────────────────────────────────────
  const [toast, setToast] = useState({ msg: '', visible: false, type: 'success' })
  const toastTimerRef = useRef(null)

  function showToast(msg, type = 'success') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ msg, visible: true, type })
    toastTimerRef.current = setTimeout(() => setToast(p => ({ ...p, visible: false })), 3000)
  }

  // ── Inicializa logoPreview quando config/empresa carrega ──
  useEffect(() => {
    if (config?.logoUrl || empresa?.logoUrl) {
      setLogoPreview(config?.logoUrl || empresa?.logoUrl)
    }
  }, [config, empresa])

  // ── Segurança: admin pertence à empresa ──────────────────
  useEffect(() => {
    if (!loadingEmpresa && empresaId && empresaIdAuth && empresaId !== empresaIdAuth) {
      navigate('/login', { replace: true })
    }
  }, [loadingEmpresa, empresaId, empresaIdAuth, navigate])

  // ── Escuta OS em tempo real ──────────────────────────────
  useEffect(() => {
    if (!empresaId) return
    setLoading(true)
    setError(null)
    const unsub = escutarOSdaEmpresa(
      empresaId,
      lista => {
        setReports(lista)
        const inicio = new Date(); inicio.setDate(1); inicio.setHours(0, 0, 0, 0)
        setTotalMes(lista.filter(r => {
          try { return r.criado_em?.toDate?.() >= inicio } catch { return false }
        }).length)
        setLoading(false)
      },
      e => { setError(e.message); setLoading(false) }
    )
    return unsub
  }, [empresaId, refreshKey])

  // Abre OS diretamente quando navegado da Agenda com state.openOsId
  useEffect(() => {
    const openId = location.state?.openOsId
    if (!openId || loading || reports.length === 0) return
    const os = reports.find(r => r.id === openId)
    if (os) {
      setSelected(os)
      window.history.replaceState({}, '') // limpa o state para não reabrir na volta
    }
  }, [reports, loading])

  // ── Carrega técnicos da empresa ──────────────────────────
  async function loadTecnicos() {
    if (!empresaId) return
    setLoadingTecnicos(true)
    try {
      const snap = await getDocs(collection(db, 'empresas', empresaId, 'tecnicos'))
      setTecnicos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) {
      showToast('Erro ao carregar técnicos: ' + e.message, 'error')
    } finally {
      setLoadingTecnicos(false)
    }
  }

  useEffect(() => {
    if (empresaId) loadTecnicos()
  }, [empresaId])

  // Solicita permissão de notificação push e registra o token FCM da empresa
  useEffect(() => {
    if (!empresaId) return
    solicitarPermissaoENotificacao(empresaId, emailUsuario)
    escutarNotificacoesEmPrimeiroPlano((payload) => {
      showToast(payload.notification?.body || 'Checklist recebido!', 'success')
    })
  }, [empresaId])

  const limite = verificarLimite(totalMes)

  // Badge da sidebar com quantidade em revisão
  const orcEmRevisaoCount = useMemo(
    () => orcamentos.filter(o => o.status === 'em_revisao').length,
    [orcamentos]
  )

  // ── Handlers de OS ───────────────────────────────────────
  async function changeStatus(id, newStatus) {
    setUpdating(true)
    try {
      const osAtual = reports.find(r => r.id === id)
      const entrada = {
        de: osAtual?.status || 'pendente',
        para: newStatus,
        quando: new Date().toISOString(),
        por: emailUsuario || 'admin',
      }
      await atualizarOS(empresaId, id, {
        status: newStatus,
        status_historico: arrayUnion(entrada),
      })
      setReports(p => p.map(r => r.id === id
        ? { ...r, status: newStatus, status_historico: [...(r.status_historico || []), entrada] }
        : r
      ))
      if (selected?.id === id) setSelected(p => ({
        ...p, status: newStatus,
        status_historico: [...(p.status_historico || []), entrada],
      }))
    } catch (e) { showToast('Erro: ' + e.message, 'error') }
    finally { setUpdating(false) }
  }

  // Link curto — só o ID da OS. O FormPage busca os dados do Firestore.
  // Inclui publicToken quando disponível para validação nas páginas públicas.
  function buildLink(r) {
    const t = r.publicToken ? `&t=${r.publicToken}` : ''
    return `${window.location.origin}/${slug}?os=${r.id}${t}`
  }

  function buildLinkRelatorio(osId, token) {
    const t = token ? `?t=${token}` : ''
    return `${window.location.origin}/relatorio/${slug}/${osId}${t}`
  }

  function openLinkRelModal(r) {
    setLinkRelModal(r)
  }

  async function excluirOrcamento(orc) {
    if (!window.confirm(`Excluir orçamento ${orc.numero}?\nEsta ação não pode ser desfeita.`)) return
    try {
      await deleteDoc(doc(db, `empresas/${empresaId}/orcamentos`, orc.id))
      setOrcamentos(p => p.filter(o => o.id !== orc.id))
      showToast('Orçamento excluído.', 'success')
    } catch (e) {
      showToast('Erro ao excluir orçamento: ' + e.message, 'error')
    }
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  // ── Orçamentos: load ─────────────────────────────────────
  async function loadOrcamentos() {
    if (!empresaId) return
    setLoadingOrc(true)
    try {
      const q = query(
        collection(db, `empresas/${empresaId}/orcamentos`),
        orderBy('criado_em', 'desc')
      )
      const snap = await getDocs(q)
      setOrcamentos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) {
      showToast('Erro ao carregar orçamentos: ' + e.message, 'error')
    } finally {
      setLoadingOrc(false)
    }
  }

  useEffect(() => { if (empresaId) loadOrcamentos() }, [empresaId]) // eslint-disable-line

  function buildLinkTecnicoOrc(orcId) {
    return `${window.location.origin}/orcamento/${slug}/${orcId}`
  }
  function buildLinkClienteOrc(orcId) {
    return `${window.location.origin}/aprovar/${slug}/${orcId}`
  }

  async function copyOrcLink(link) {
    await copyToClipboard(link)
    showToast('📋 Link copiado!')
  }

  // Abre modal de revisão
  function openRevisarOrcamento(orc) {
    setRevisarOrc(orc)
    setShowRevisarOrc(true)
  }

  // Gera PDF do orçamento (versão cliente)
  function handlePDFCliente(orc) {
    const emp = { nome: config?.nome || empresa?.nome || '', telefone: config?.telefone || '', cnpj: config?.cnpj || '', logoUrl: config?.logoUrl || empresa?.logoUrl || '' }
    generatePDFCliente(orc, emp)
  }
  // Gera PDF do orçamento (versão seguradora)
  function handlePDFSeguradora(orc) {
    const emp = { nome: config?.nome || empresa?.nome || '', telefone: config?.telefone || '', cnpj: config?.cnpj || '', logoUrl: config?.logoUrl || empresa?.logoUrl || '' }
    generatePDFSeguradora(orc, emp)
  }

  // Abre modal de conversão em OS
  function abrirConverterOS(orc) {
    setConverterOrc(orc)
    setShowConverterOS(true)
  }

  // ── Loading inicial ──────────────────────────────────────
  if (loadingEmpresa) {
    return (
      <div className="loading-state" style={{ paddingTop: '20vh' }}>
        <div className="spinner" />
        <p className="loading-text">Carregando painel...</p>
      </div>
    )
  }

  const nomeEmpresa    = config?.nome || empresa?.nome || 'Painel Admin'
  const inicialUsuario = auth.currentUser?.displayName
    ? auth.currentUser.displayName[0].toUpperCase()
    : emailUsuario ? emailUsuario[0].toUpperCase() : 'A'
  // técnicos ativos para selects
  const tecnicosAtivos = tecnicos.filter(t => t.ativo !== false)

  // ── RENDER ───────────────────────────────────────────────
  const contextValue = {
    empresa, config, slug, empresaId, seguradoras, nomeEmpresa,
    reports,    setReports,
    tecnicos,   setTecnicos,   loadingTecnicos,
    orcamentos, setOrcamentos,
    totalMes,   setTotalMes,
    abaAtiva,   setAbaAtiva,
    showToast,
    buildLink, buildLinkRelatorio, buildLinkTecnicoOrc, buildLinkClienteOrc,
    logoPreview, setLogoPreview,
    // aba OS
    loading, error, updating, limite,
    changeStatus, setSelected, setGeneratedLink, openLinkRelModal,
    // aba Orçamentos
    loadingOrc, loadOrcamentos,
    openRevisarOrcamento, copyOrcLink,
    handlePDFCliente, handlePDFSeguradora,
    abrirConverterOS, excluirOrcamento,
  }

  return (
    <AdminContext.Provider value={contextValue}>
    <div className="admin-layout">

      {/* ── TOAST ── */}
      <Toast toast={toast} />

      {/* ── OVERLAY MOBILE ── */}
      {sidebarOpen && (
        <div className="sidebar-overlay open" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── SIDEBAR ── */}
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-logo">
          {logoPreview
            ? <img src={logoPreview} alt="Logo" style={{ height: 34, width: 'auto', borderRadius: 6, objectFit: 'contain' }} />
            : <img src="/logo.png" alt="AssistHub" onError={e => { e.target.style.display='none' }} />
          }
          <span>AssistHub</span>
        </div>

        <nav className="sidebar-nav">
          {[
            { id: 'dashboard',  icon: '📊', label: 'Dashboard'         },
            { id: 'agenda',     icon: '📅', label: 'Agenda'            },
            { id: 'os',         icon: '📋', label: 'Ordens de Serviço' },
            { id: 'orcamentos', icon: '📄', label: 'Orçamentos'        },
            { id: 'segurados',  icon: '👥', label: 'Segurados'         },
            { id: 'tecnicos',   icon: '👷', label: 'Técnicos'          },
            { id: 'config',      icon: '⚙️', label: 'Configurações'        },
            { id: 'relatorio',   icon: '📊', label: 'Relatório Mensal'     },
            { id: 'financeiro',  icon: '💰', label: 'Financeiro da Empresa' },
          ].map(item => (
            <button
              key={item.id}
              className={`sidebar-item${abaAtiva === item.id ? ' active' : ''}`}
              onClick={() => {
                if (item.id === 'agenda') { navigate(`/${slug}/agenda`); setSidebarOpen(false) }
                else { setAbaAtiva(item.id); setSidebarOpen(false) }
              }}
            >
              <span className="si-icon">{item.icon}</span>
              <span className="si-label">{item.label}</span>
              {item.id === 'os' && reports.length > 0 && (
                <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '1px 8px', fontSize: '.72rem', fontWeight: 700 }}>
                  {reports.length}
                </span>
              )}
              {item.id === 'orcamentos' && orcEmRevisaoCount > 0 && (
                <span style={{ background: '#d4a017', color: '#fff', borderRadius: 10, padding: '1px 8px', fontSize: '.72rem', fontWeight: 700 }}>
                  {orcEmRevisaoCount}
                </span>
              )}
              {item.id === 'tecnicos' && tecnicos.length > 0 && (
                <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '1px 8px', fontSize: '.72rem', fontWeight: 700 }}>
                  {tecnicosAtivos.length}
                </span>
              )}
            </button>
          ))}

          <div className="sidebar-divider" />

          {limite.aviso && (
            <div style={{ padding: '8px 14px', background: 'rgba(240,90,26,0.12)', borderRadius: 8, fontSize: '.75rem', color: '#ff9966', fontWeight: 600 }}>
              ⚠️ {limite.restantes} OS restantes
            </div>
          )}
          {limite.bloqueado && (
            <div style={{ padding: '8px 14px', background: 'rgba(192,57,43,0.15)', borderRadius: 8, fontSize: '.75rem', color: '#ff9090', fontWeight: 600 }}>
              🚫 Limite atingido
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{inicialUsuario}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{auth.currentUser?.displayName || nomeEmpresa}</div>
              <div className="sidebar-user-email">{emailUsuario || ''}</div>
            </div>
          </div>
          <button className="sidebar-logout" onClick={handleLogout}>
            🚪 Sair da conta
          </button>
        </div>
      </aside>

      {/* ── CONTEÚDO PRINCIPAL ── */}
      <div className="admin-content">

        {/* ── PAGE HEADER ── */}
        <div className="page-header">
          <div className="page-header-left">
            <button className="hamburger-btn" onClick={() => setSidebarOpen(o => !o)}>☰</button>
            <div>
              <div className="page-header-title">
                {{ dashboard: '📊 Dashboard', os: '📋 Ordens de Serviço', orcamentos: '📄 Orçamentos', segurados: '👥 Segurados', tecnicos: '👷 Técnicos', config: '⚙️ Configurações', relatorio: '📊 Relatório Mensal', financeiro: '💰 Financeiro da Empresa' }[abaAtiva]}
              </div>
              <div className="page-header-sub">{nomeEmpresa}</div>
            </div>
          </div>
          <div className="page-header-actions">
            <button className="btn-secondary" style={{ fontSize: '.82rem', padding: '7px 14px' }} onClick={() => setRefreshKey(k => k + 1)} disabled={loading}>
              🔄 Atualizar
            </button>
            {abaAtiva === 'orcamentos'
              ? (
                <button className="btn-new-os" onClick={() => setShowNovoOrc(true)}>
                  + Novo Orçamento
                </button>
              )
              : (
                <>
                  <button
                    className="btn-sm btn-view"
                    onClick={() => setShowImportarMapfre(true)}
                    disabled={limite.bloqueado}
                    title="Importar OS via texto — Mapfre, Juvo/Tempo, Maxpar, Mondial"
                    style={{ fontSize: '.82rem' }}
                  >
                    📋 Importar por Texto
                  </button>
                  <button
                    className="btn-new-os"
                    onClick={() => setShowOsForm(true)}
                    disabled={limite.bloqueado}
                    title={limite.bloqueado ? `Limite de ${limite.limite} OS/mês atingido` : 'Nova OS'}
                  >
                    + Nova OS
                  </button>
                </>
              )
            }
          </div>
        </div>

        {/* ── ABAS ── */}
        {abaAtiva === 'dashboard'  && <DashboardTab />}
        {abaAtiva === 'os'         && <OrdensServicoTab />}
        {abaAtiva === 'orcamentos' && <OrcamentosTab />}
        {abaAtiva === 'segurados'  && <SeguradosTab onSelectOS={setSelected} />}
        {abaAtiva === 'tecnicos'   && <TecnicosTab />}
        {abaAtiva === 'config'     && <ConfigTab />}
        {abaAtiva === 'relatorio'  && <RelatorioTab />}
        {abaAtiva === 'financeiro' && <FinanceiroEmpresaTab />}

      </div>{/* fim admin-content */}

      {/* ── FAB MOBILE: Nova OS ── */}
      <button
        className="fab-nova-os"
        onClick={() => setShowOsForm(true)}
        disabled={limite.bloqueado}
        title="Nova OS"
      >
        +
      </button>

      {/* ══ MODAIS ══ */}
      {showImportarMapfre && (
        <ImportarMapfreModal
          onClose={() => setShowImportarMapfre(false)}
          onImportar={campos => {
            setOsPrefill(campos)
            setShowImportarMapfre(false)
            setShowOsForm(true)
          }}
        />
      )}

      {showOsForm && (
        <NovaOSModal
          prefill={osPrefill}
          onClose={() => { setShowOsForm(false); setOsPrefill(null) }}
        />
      )}

      {generatedLink && (
        <LinkGeradoModal data={generatedLink} onClose={() => setGeneratedLink(null)} />
      )}

      {linkRelModal && (
        <LinkRelatorioModal os={linkRelModal} onClose={() => setLinkRelModal(null)} />
      )}

      {selected && (
        <DetalheOSModal os={selected} onClose={() => setSelected(null)} />
      )}

      {showNovoOrc && (
        <NovoOrcamentoModal
          onClose={() => setShowNovoOrc(false)}
          onCreated={links => { setShowNovoOrc(false); setOrcLinks(links) }}
        />
      )}

      {orcLinks && (
        <OrcamentoLinksModal
          links={orcLinks}
          onClose={() => setOrcLinks(null)}
          onVerLista={() => { setOrcLinks(null); setAbaAtiva('orcamentos') }}
        />
      )}

      {showRevisarOrc && revisarOrc && (
        <RevisarOrcamentoModal
          key={revisarOrc.id}
          orc={revisarOrc}
          onClose={() => { setShowRevisarOrc(false); setRevisarOrc(null) }}
        />
      )}

      {showConverterOS && converterOrc && (
        <ConverterOSModal
          orc={converterOrc}
          onClose={() => setShowConverterOS(false)}
          onConverted={() => {
            setShowConverterOS(false)
            setShowRevisarOrc(false)
            setRevisarOrc(null)
          }}
        />
      )}

    </div>
    </AdminContext.Provider>
  )
}
