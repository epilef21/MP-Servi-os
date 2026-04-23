// ============================================================
// ADMIN PAGE — Painel da empresa (multi-tenant) — AssistHub
// Fase 2: Técnicos, Perfil do Usuário, Minha Empresa
// ============================================================
import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  db,
  storage,
  auth,
  getOSdaEmpresa,
  criarOS,
  atualizarOS,
  contarOSdoMes,
  refConfig,
  refEmpresa,
  updateDoc,
  doc,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  serverTimestamp,
  PLANOS,
  storageRef,
  uploadBytes,
  getDownloadURL,
} from '../firebase.js'
import { sendPasswordResetEmail, updateProfile } from 'firebase/auth'
import { useAuth }    from '../contexts/AuthContext.jsx'
import { useEmpresa } from '../hooks/useEmpresa.js'
import { generatePDF } from '../utils/pdfGenerator.js'
import { generatePNG } from '../utils/pngGenerator.js'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'

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
function maskPhone(v) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
}
function maskCNPJ(v) {
  const d = v.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const AVATAR_COLORS = ['av0','av1','av2','av3']

const STATUS_META = {
  aguardando_tecnico: { label: '🔔 Aguardando',  cls: 'aguardando-t' },
  pendente:           { label: '⏳ Pendente',      cls: 'pendente-y'   },
  processado:         { label: '✅ Processado',    cls: 'processado-g' },
  enviado:            { label: '📤 Enviado',       cls: 'enviado-b'    },
}
const badgeLabel = s => STATUS_META[s]?.label ?? STATUS_META.pendente.label
const badgeCls   = s => STATUS_META[s]?.cls   ?? 'pendente-y'

const OS_INITIAL = {
  seguradora: '', num_assist: '', nome_segurado: '',
  tel_segurado: '', cep: '', endereco: '', numero: '', cidade: '',
  data_atend: '', hora_atend: '', servico: '', desc_problema: '',
  tecnico_id: '', tecnico_nome_manual: '',
}

const PIE_COLORS = {
  aguardando_tecnico: '#f05a1a',
  pendente:           '#f59e0b',
  processado:         '#2d8a4e',
  enviado:            '#1a3fa8',
}

const TECNICO_FORM_INITIAL = {
  nome: '', telefone: '', email: '', especialidade: '', ativo: true,
}

// ── Tooltip customizado para o BarChart ─────────────────────
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
  const { logout, empresaId: empresaIdAuth, emailUsuario } = useAuth()

  const { empresa, config, slug, verificarLimite, loading: loadingEmpresa } = useEmpresa()

  const empresaId   = empresa?.id ?? null
  const seguradoras = config?.seguradoras ?? ['Tempo', 'Mapfre', 'Maxpar', 'Allianz']

  // ── Estado de dados ──────────────────────────────────────
  const [reports,   setReports]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [updating,  setUpdating]  = useState(false)
  const [totalMes,  setTotalMes]  = useState(0)

  // ── Navegação ────────────────────────────────────────────
  const [abaAtiva,     setAbaAtiva]     = useState('dashboard')
  const [sidebarOpen,  setSidebarOpen]  = useState(false)

  // ── Filtros (aba OS) ─────────────────────────────────────
  const [busca,      setBusca]      = useState('')
  const [filtStatus, setFiltStatus] = useState('')
  const [filtData,   setFiltData]   = useState('')
  const [filtMes,    setFiltMes]    = useState(() => new Date().toISOString().slice(0, 7))

  // ── Modais OS ────────────────────────────────────────────
  const [selected,      setSelected]      = useState(null)
  const [showOsForm,    setShowOsForm]    = useState(false)
  const [osForm,        setOsForm]        = useState(OS_INITIAL)
  const [osErrors,      setOsErrors]      = useState({})
  const [osCepLoading,  setOsCepLoading]  = useState(false)
  const [savingOs,      setSavingOs]      = useState(false)
  const osEnderecoRef = useRef(null)
  const [generatedLink, setGeneratedLink] = useState(null)
  const [copied,        setCopied]        = useState(false)
  const [genPng,        setGenPng]        = useState(false)
  // modo de seleção de técnico no form de OS (select | manual)
  const [osTecnicoMode, setOsTecnicoMode] = useState('select')

  // ── Financeiro e Técnico (modal detalhe OS) ──────────────
  const [finForm,       setFinForm]       = useState({ mo_seguradora: '', valor_prestador: '', valor_deslocamento: '' })
  const [savingFin,     setSavingFin]     = useState(false)
  const [tecnicoForm,   setTecnicoForm]   = useState({ nome: '', tel: '' })
  const [savingTecnico, setSavingTecnico] = useState(false)
  // modo técnico no detalhe da OS
  const [detTecnicoMode, setDetTecnicoMode] = useState('select')

  // ── Segurados ────────────────────────────────────────────
  const [selectedSegurado, setSelectedSegurado] = useState(null)

  // ── Técnicos ─────────────────────────────────────────────
  const [tecnicos,          setTecnicos]          = useState([])
  const [loadingTecnicos,   setLoadingTecnicos]   = useState(false)
  const [showTecnicoModal,  setShowTecnicoModal]  = useState(false)
  const [tecnicoEdit,       setTecnicoEdit]       = useState(null)
  const [tecnicoFormData,   setTecnicoFormData]   = useState(TECNICO_FORM_INITIAL)
  const [tecnicoFormErrors, setTecnicoFormErrors] = useState({})
  const [savingTecnicoForm, setSavingTecnicoForm] = useState(false)

  // ── Configurações ────────────────────────────────────────
  const [configAba,    setConfigAba]    = useState('empresa')
  const [configForm,   setConfigForm]   = useState({
    nome: '', telefone: '', whatsapp: '', endereco: '',
    cidade_estado: '', cnpj: '', site: '', seguradoras: [],
  })
  const [savingConfig,    setSavingConfig]     = useState(false)
  const [resetEmailEnviado, setResetEmailEnviado] = useState(false)

  // nome editável do usuário
  const [nomeUsuario,   setNomeUsuario]   = useState('')
  const [savingNome,    setSavingNome]    = useState(false)

  // logo upload
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoPreview,   setLogoPreview]   = useState(null)
  const logoInputRef = useRef(null)

  // ── Toast ────────────────────────────────────────────────
  const [toast, setToast] = useState({ msg: '', visible: false, type: 'success' })
  const toastTimerRef = useRef(null)

  function showToast(msg, type = 'success') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ msg, visible: true, type })
    toastTimerRef.current = setTimeout(() => setToast(p => ({ ...p, visible: false })), 3000)
  }

  // ── Inicializa configForm quando config/empresa carrega ──
  useEffect(() => {
    if (config || empresa) {
      setConfigForm({
        nome:          config?.nome          || empresa?.nome        || '',
        telefone:      config?.telefone      || empresa?.telefone    || '',
        whatsapp:      config?.whatsapp      || empresa?.whatsapp    || '',
        endereco:      config?.endereco      || empresa?.endereco    || '',
        cidade_estado: config?.cidade_estado || empresa?.cidade_estado || '',
        cnpj:          config?.cnpj          || empresa?.cnpj        || '',
        site:          config?.site          || empresa?.site        || '',
        seguradoras:   config?.seguradoras   || ['Tempo','Mapfre','Maxpar','Allianz'],
      })
      if (config?.logoUrl || empresa?.logoUrl) {
        setLogoPreview(config?.logoUrl || empresa?.logoUrl)
      }
    }
  }, [config, empresa])

  // ── Inicializa nome do usuário do Auth ───────────────────
  useEffect(() => {
    if (auth.currentUser?.displayName) {
      setNomeUsuario(auth.currentUser.displayName)
    }
  }, [])

  // ── Segurança: admin pertence à empresa ──────────────────
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

  // Sincroniza forms ao abrir detalhe de OS
  useEffect(() => {
    if (!selected) return
    setFinForm({
      mo_seguradora:      String(selected.mo_seguradora      ?? ''),
      valor_prestador:    String(selected.valor_prestador    ?? ''),
      valor_deslocamento: String(selected.valor_deslocamento ?? ''),
    })
    setTecnicoForm({
      nome: selected.tecnico_nome || '',
      tel:  selected.tecnico_tel  || '',
    })
    // detecta modo: se tem tecnico_id salvo, usa select; senão manual
    setDetTecnicoMode(selected.tecnico_id ? 'select' : 'manual')
  }, [selected?.id])

  // ── Métricas ─────────────────────────────────────────────
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

  // ── Dados do gráfico de barras — últimos 6 meses ─────────
  const chartData = useMemo(() => {
    const now   = new Date()
    const meses = []
    for (let i = 5; i >= 0; i--) {
      const d    = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
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

  // ── Dados do gráfico de pizza — distribuição por status ──
  const pieData = useMemo(() => {
    const counts = { aguardando_tecnico: 0, pendente: 0, processado: 0, enviado: 0 }
    reports.forEach(r => {
      const s = r.status || 'pendente'
      if (s in counts) counts[s]++
    })
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({ name: badgeLabel(key).replace(/\S+ /, ''), value, color: PIE_COLORS[key] }))
  }, [reports])

  // ── OS filtradas para a aba OS ───────────────────────────
  const filtered = useMemo(() => {
    const b = busca.toLowerCase()
    return reports.filter(r => {
      const txt = `${r.nome_segurado || ''} ${r.seguradora || ''} ${r.cidade || ''} ${r.num_assist || ''} ${r.servico || ''}`.toLowerCase()
      return (!b || txt.includes(b))
        && (!filtStatus || (r.status || 'pendente') === filtStatus)
        && (!filtData || r.data_chegada === filtData)
    })
  }, [reports, busca, filtStatus, filtData])

  // ── Segurados únicos ─────────────────────────────────────
  const segurados = useMemo(() => {
    const map = {}
    reports.forEach(r => {
      const key = `${r.nome_segurado || ''}__${r.tel_segurado || ''}`
      if (!map[key]) {
        map[key] = { nome: r.nome_segurado || '—', tel: r.tel_segurado || '', endereco: r.endereco || '', cidade: r.cidade || '', os: [] }
      }
      map[key].os.push(r)
    })
    return Object.values(map).sort((a, b) => b.os.length - a.os.length)
  }, [reports])

  const limite = verificarLimite(totalMes)

  // ── Handlers de OS ───────────────────────────────────────
  async function changeStatus(id, newStatus) {
    setUpdating(true)
    try {
      await atualizarOS(empresaId, id, { status: newStatus })
      setReports(p => p.map(r => r.id === id ? { ...r, status: newStatus } : r))
      if (selected?.id === id) setSelected(p => ({ ...p, status: newStatus }))
    } catch (e) { alert('Erro: ' + e.message) }
    finally { setUpdating(false) }
  }

  function setOsField(k, v) {
    setOsForm(p => ({ ...p, [k]: v }))
    if (osErrors[k]) setOsErrors(p => ({ ...p, [k]: false }))
  }

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

  function validateOs() {
    const required = ['seguradora', 'num_assist', 'nome_segurado', 'endereco', 'cidade', 'servico', 'desc_problema']
    const errs = {}
    required.forEach(f => { if (!osForm[f]?.trim()) errs[f] = true })
    setOsErrors(errs)
    return !Object.keys(errs).length
  }

  // Link curto — só o ID da OS. O FormPage busca os dados do Firestore.
  // Resolve URLs gigantes no WhatsApp que cortavam o texto da mensagem.
  function buildLink(r) {
    return `${window.location.origin}/${slug}?os=${r.id}`
  }

  async function saveOs() {
    if (!validateOs()) return
    if (limite.bloqueado) {
      alert(`Limite de ${limite.limite} OS/mês atingido. Faça upgrade do plano.`)
      return
    }
    setSavingOs(true)
    try {
      const enderecoFinal = osForm.endereco + (osForm.numero ? ', ' + osForm.numero : '')

      // resolve técnico selecionado
      let tecNome = ''
      let tecTel  = ''
      let tecId   = ''
      if (osTecnicoMode === 'select' && osForm.tecnico_id) {
        const tec = tecnicos.find(t => t.id === osForm.tecnico_id)
        if (tec) { tecNome = tec.nome; tecTel = tec.telefone; tecId = tec.id }
      } else if (osTecnicoMode === 'manual') {
        tecNome = osForm.tecnico_nome_manual || ''
      }

      const payload = {
        seguradora: osForm.seguradora, num_assist: osForm.num_assist,
        nome_segurado: osForm.nome_segurado, tel_segurado: osForm.tel_segurado || '',
        endereco: enderecoFinal, cidade: osForm.cidade,
        data_chegada: osForm.data_atend || '', hora_chegada: osForm.hora_atend || '',
        servico: osForm.servico, desc_problema: osForm.desc_problema,
        status: 'aguardando_tecnico', origem: 'admin',
        tecnico_nome: tecNome, tecnico_tel: tecTel, tecnico_id: tecId,
      }
      const ref    = await criarOS(empresaId, payload)
      const newRec = { id: ref.id, ...payload, criado_em: { toDate: () => new Date() } }
      setReports(p => [newRec, ...p])
      setTotalMes(p => p + 1)
      setShowOsForm(false)
      setOsForm(OS_INITIAL)
      setOsErrors({})
      setOsTecnicoMode('select')
      setGeneratedLink({ link: buildLink(newRec), os: ref.id, nome: osForm.nome_segurado, seguradora: osForm.seguradora, num_assist: osForm.num_assist })
    } catch (e) { alert('Erro ao salvar OS: ' + e.message) }
    finally { setSavingOs(false) }
  }

  async function copyLink(link) {
    try { await navigator.clipboard.writeText(link) }
    catch {
      const el = document.createElement('textarea')
      el.value = link; document.body.appendChild(el); el.select()
      document.execCommand('copy'); document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

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
      showToast('💰 Financeiro salvo!')
    } catch (e) { alert('Erro ao salvar financeiro: ' + e.message) }
    finally { setSavingFin(false) }
  }

  async function saveTecnico() {
    setSavingTecnico(true)
    try {
      let tecNome = tecnicoForm.nome.trim() || ''
      let tecTel  = tecnicoForm.tel.trim()  || ''
      let tecId   = selected.tecnico_id     || ''

      if (detTecnicoMode === 'select' && tecnicoForm.nome) {
        const tec = tecnicos.find(t => t.nome === tecnicoForm.nome)
        if (tec) { tecNome = tec.nome; tecTel = tec.telefone; tecId = tec.id }
      }

      const payload = { tecnico_nome: tecNome, tecnico_tel: tecTel, tecnico_id: tecId }
      await atualizarOS(empresaId, selected.id, payload)
      const updated = { ...selected, ...payload }
      setReports(p => p.map(r => r.id === selected.id ? updated : r))
      setSelected(updated)
      showToast('👷 Técnico salvo!')
    } catch (e) { alert('Erro ao salvar técnico: ' + e.message) }
    finally { setSavingTecnico(false) }
  }

  function buildWhatsAppTecnico(os, tecnico) {
    const link = buildLink(os)
    const msg  =
      `Olá ${tecnico.nome || 'Técnico'}! 👋\n\nVocê tem uma nova OS para atender:\n\n` +
      `📋 OS: ${os.num_assist || '—'}\n👤 Segurado: ${os.nome_segurado || '—'}\n` +
      `📍 Endereço: ${os.endereco || '—'} - ${os.cidade || '—'}\n` +
      `🔧 Serviço: ${os.servico || '—'}\n📅 Data: ${fmtDate(os.data_chegada)}\n\n` +
      `Acesse o link abaixo para preencher o checklist:\n🔗 ${link}\n\nQualquer dúvida estou à disposição!`
    const phone = tecnico.tel.replace(/\D/g, '')
    return `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`
  }

  async function handlePNG(r) {
    setGenPng(true)
    try { await generatePNG(r) } catch (e) { alert('Erro ao gerar PNG: ' + e.message) }
    finally { setGenPng(false) }
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  // ── Handlers de técnicos ─────────────────────────────────
  function openTecnicoModal(tec = null) {
    setTecnicoEdit(tec)
    setTecnicoFormData(tec
      ? { nome: tec.nome || '', telefone: tec.telefone || '', email: tec.email || '', especialidade: tec.especialidade || '', ativo: tec.ativo !== false }
      : TECNICO_FORM_INITIAL
    )
    setTecnicoFormErrors({})
    setShowTecnicoModal(true)
  }

  async function saveTecnicoModal() {
    const errs = {}
    if (!tecnicoFormData.nome.trim())     errs.nome     = true
    if (!tecnicoFormData.telefone.trim()) errs.telefone = true
    setTecnicoFormErrors(errs)
    if (Object.keys(errs).length) return

    setSavingTecnicoForm(true)
    try {
      const payload = {
        nome:         tecnicoFormData.nome.trim(),
        telefone:     tecnicoFormData.telefone.trim(),
        email:        tecnicoFormData.email.trim()        || '',
        especialidade: tecnicoFormData.especialidade.trim() || '',
        ativo:        tecnicoFormData.ativo,
      }

      if (tecnicoEdit) {
        await updateDoc(doc(db, 'empresas', empresaId, 'tecnicos', tecnicoEdit.id), payload)
        setTecnicos(p => p.map(t => t.id === tecnicoEdit.id ? { ...t, ...payload } : t))
        showToast('✅ Técnico atualizado!')
      } else {
        const ref = await addDoc(collection(db, 'empresas', empresaId, 'tecnicos'), {
          ...payload, criado_em: serverTimestamp(),
        })
        setTecnicos(p => [...p, { id: ref.id, ...payload }])
        showToast('✅ Técnico cadastrado!')
      }
      setShowTecnicoModal(false)
    } catch (e) { showToast('Erro: ' + e.message, 'error') }
    finally { setSavingTecnicoForm(false) }
  }

  async function toggleAtivoTecnico(tec) {
    try {
      const novoAtivo = !tec.ativo
      await updateDoc(doc(db, 'empresas', empresaId, 'tecnicos', tec.id), { ativo: novoAtivo })
      setTecnicos(p => p.map(t => t.id === tec.id ? { ...t, ativo: novoAtivo } : t))
      showToast(novoAtivo ? '🟢 Técnico ativado' : '⚫ Técnico desativado')
    } catch (e) { showToast('Erro: ' + e.message, 'error') }
  }

  // ── Salva configurações da empresa ───────────────────────
  async function saveConfig() {
    if (!empresaId) return
    setSavingConfig(true)
    try {
      const payload = {
        nome:          configForm.nome.trim(),
        telefone:      configForm.telefone.trim(),
        whatsapp:      configForm.whatsapp.trim()      || '',
        endereco:      configForm.endereco.trim()      || '',
        cidade_estado: configForm.cidade_estado.trim() || '',
        cnpj:          configForm.cnpj.trim()          || '',
        site:          configForm.site.trim()          || '',
        seguradoras:   configForm.seguradoras,
      }
      await updateDoc(refConfig(empresaId), payload)
      showToast('✅ Dados salvos com sucesso!')
    } catch (e) { showToast('Erro ao salvar: ' + e.message, 'error') }
    finally { setSavingConfig(false) }
  }

  // ── Upload de logo ────────────────────────────────────────
  async function handleLogoUpload(file) {
    if (!file || !empresaId) return
    const maxSize = 2 * 1024 * 1024
    if (file.size > maxSize) { showToast('Arquivo muito grande. Máximo 2MB.', 'error'); return }
    const allowed = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
    if (!allowed.includes(file.type)) { showToast('Formato não suportado. Use JPG, PNG ou SVG.', 'error'); return }

    setLogoUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `empresas/${empresaId}/logo.${ext}`
      const ref  = storageRef(storage, path)
      await uploadBytes(ref, file)
      const url  = await getDownloadURL(ref)
      setLogoPreview(url)
      await updateDoc(refConfig(empresaId), { logoUrl: url })
      await updateDoc(refEmpresa(empresaId), { logoUrl: url })
      showToast('🖼️ Logo enviada com sucesso!')
    } catch (e) { showToast('Erro no upload: ' + e.message, 'error') }
    finally { setLogoUploading(false) }
  }

  // ── Salva nome do usuário ────────────────────────────────
  async function saveNomeUsuario() {
    if (!nomeUsuario.trim() || !auth.currentUser) return
    setSavingNome(true)
    try {
      await updateProfile(auth.currentUser, { displayName: nomeUsuario.trim() })
      showToast('✅ Nome atualizado!')
    } catch (e) { showToast('Erro: ' + e.message, 'error') }
    finally { setSavingNome(false) }
  }

  // ── Envia email de redefinição de senha ──────────────────
  async function sendResetEmail() {
    if (!emailUsuario) return
    try {
      await sendPasswordResetEmail(auth, emailUsuario)
      setResetEmailEnviado(true)
      setTimeout(() => setResetEmailEnviado(false), 5000)
    } catch (e) { alert('Erro: ' + e.message) }
  }

  // ── Toggle seguradoras no configForm ────────────────────
  function toggleSeguradora(seg) {
    setConfigForm(p => ({
      ...p,
      seguradoras: p.seguradoras.includes(seg)
        ? p.seguradoras.filter(s => s !== seg)
        : [...p.seguradoras, seg],
    }))
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
  const planoAtual  = empresa?.plano || 'basico'
  const planoInfo   = PLANOS[planoAtual] || PLANOS.basico
  const usagePct    = planoInfo.limiteOS === -1 ? 0 : Math.min(100, Math.round((totalMes / planoInfo.limiteOS) * 100))
  const usageCls    = usagePct >= 90 ? 'danger' : usagePct >= 70 ? 'warn' : ''

  // técnicos ativos para selects
  const tecnicosAtivos = tecnicos.filter(t => t.ativo !== false)

  // ── RENDER ───────────────────────────────────────────────
  return (
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
            { id: 'dashboard', icon: '📊', label: 'Dashboard'         },
            { id: 'os',        icon: '📋', label: 'Ordens de Serviço' },
            { id: 'segurados', icon: '👥', label: 'Segurados'         },
            { id: 'tecnicos',  icon: '👷', label: 'Técnicos'          },
            { id: 'config',    icon: '⚙️', label: 'Configurações'     },
          ].map(item => (
            <button
              key={item.id}
              className={`sidebar-item${abaAtiva === item.id ? ' active' : ''}`}
              onClick={() => { setAbaAtiva(item.id); setSidebarOpen(false) }}
            >
              <span className="si-icon">{item.icon}</span>
              <span className="si-label">{item.label}</span>
              {item.id === 'os' && reports.length > 0 && (
                <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '1px 8px', fontSize: '.72rem', fontWeight: 700 }}>
                  {reports.length}
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
                {{ dashboard: '📊 Dashboard', os: '📋 Ordens de Serviço', segurados: '👥 Segurados', tecnicos: '👷 Técnicos', config: '⚙️ Configurações' }[abaAtiva]}
              </div>
              <div className="page-header-sub">{nomeEmpresa}</div>
            </div>
          </div>
          <div className="page-header-actions">
            <button className="btn-secondary" style={{ fontSize: '.82rem', padding: '7px 14px' }} onClick={loadReports} disabled={loading}>
              🔄 Atualizar
            </button>
            <button
              className="btn-new-os"
              onClick={() => setShowOsForm(true)}
              disabled={limite.bloqueado}
              title={limite.bloqueado ? `Limite de ${limite.limite} OS/mês atingido` : 'Nova OS'}
            >
              + Nova OS
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            ABA: DASHBOARD
        ══════════════════════════════════════════════════ */}
        {abaAtiva === 'dashboard' && (
          <div className="tab-content">
            <div className="metrics-grid">
              <div className="metric-card blue">
                <div className="metric-icon">📋</div>
                <div className="metric-label">Total de OS</div>
                <div className="metric-value">{stats.total}</div>
                <div className="metric-sub">ordens cadastradas</div>
              </div>
              <div className="metric-card orange">
                <div className="metric-icon">📅</div>
                <div className="metric-label">Hoje</div>
                <div className="metric-value">{stats.hoje}</div>
                <div className="metric-sub">registradas hoje</div>
              </div>
              <div className="metric-card yellow">
                <div className="metric-icon">⏳</div>
                <div className="metric-label">Pendentes</div>
                <div className="metric-value">{stats.pendentes}</div>
                <div className="metric-sub">aguardando revisão</div>
              </div>
              <div className="metric-card green">
                <div className="metric-icon">💰</div>
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
                <div className="chart-card-title">📈 Atividade dos Últimos 6 Meses</div>
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
                        <Bar dataKey="criadas"     name="OS Criadas"      fill="#1a3fa8" radius={[4,4,0,0]} />
                        <Bar dataKey="finalizadas" name="OS Finalizadas"  fill="#f05a1a" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )
                }
              </div>

              <div className="chart-card">
                <div className="chart-card-title">🕐 Últimas OS</div>
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
                <div className="chart-card-title">🍩 Distribuição por Status</div>
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
                <div className="chart-card-title">📦 Plano Atual</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <span className="plan-badge" style={{ fontSize: '.9rem', padding: '6px 16px' }}>
                      🏷️ {planoAtual.charAt(0).toUpperCase() + planoAtual.slice(1)}
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
                      ⚠️ {limite.restantes} OS restantes no plano
                    </div>
                  )}
                  {limite.bloqueado && (
                    <div style={{ background: '#fff5f5', borderRadius: 8, padding: '10px 14px', fontSize: '.8rem', color: 'var(--danger)', fontWeight: 600 }}>
                      🚫 Limite atingido — entre em contato para upgrade
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            ABA: ORDENS DE SERVIÇO
        ══════════════════════════════════════════════════ */}
        {abaAtiva === 'os' && (
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
        )}

        {/* ══════════════════════════════════════════════════
            ABA: SEGURADOS
        ══════════════════════════════════════════════════ */}
        {abaAtiva === 'segurados' && (
          <div className="tab-content">
            <div style={{ fontSize: '.82rem', color: 'var(--muted)', marginBottom: 16, fontWeight: 600 }}>
              {segurados.length} segurado{segurados.length !== 1 ? 's' : ''} únicos
            </div>

            {segurados.length === 0 && (
              <div className="empty-state"><div className="e-icon">👥</div><p>Nenhum segurado encontrado.</p></div>
            )}

            <div className="segurados-list">
              {segurados.map((s, idx) => {
                const ultima   = s.os[0]
                const comNota  = s.os.filter(o => o.avaliacao_nota)
                const media    = comNota.length
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
        )}

        {/* ══════════════════════════════════════════════════
            ABA: TÉCNICOS
        ══════════════════════════════════════════════════ */}
        {abaAtiva === 'tecnicos' && (
          <div className="tab-content">
            {/* Header da aba */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ fontFamily: 'Barlow Condensed,sans-serif', fontSize: '1.4rem', fontWeight: 900, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  👷 Técnicos da Equipe
                </h2>
                <p style={{ fontSize: '.82rem', color: 'var(--muted)', marginTop: 2 }}>{nomeEmpresa}</p>
              </div>
              <button className="btn-new-os" onClick={() => openTecnicoModal()}>
                + Adicionar Técnico
              </button>
            </div>

            {loadingTecnicos && (
              <div className="loading-state"><div className="spinner" /><div className="loading-text">Carregando técnicos...</div></div>
            )}

            {!loadingTecnicos && tecnicos.length === 0 && (
              <div className="empty-state" style={{ paddingTop: 60 }}>
                <div className="e-icon">👷</div>
                <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 6 }}>Nenhum técnico cadastrado</p>
                <p style={{ fontSize: '.85rem' }}>Adicione seu primeiro técnico!</p>
                <button className="btn-new-os" style={{ marginTop: 16 }} onClick={() => openTecnicoModal()}>
                  + Adicionar Técnico
                </button>
              </div>
            )}

            {!loadingTecnicos && tecnicos.length > 0 && (
              <div className="tecnico-cards-grid">
                {tecnicos.map((tec, idx) => (
                  <div key={tec.id} className="tecnico-card">
                    <div className={`tecnico-avatar ${AVATAR_COLORS[idx % 4]}`}>
                      {tec.nome ? tec.nome[0].toUpperCase() : '?'}
                    </div>
                    <div className="tecnico-name">{tec.nome}</div>
                    <div className="tecnico-tel">{tec.telefone}</div>
                    {tec.especialidade && (
                      <div className="tecnico-esp">{tec.especialidade}</div>
                    )}
                    <span className={`tecnico-badge ${tec.ativo !== false ? 'ativo' : 'inativo'}`}>
                      {tec.ativo !== false ? '🟢 Ativo' : '⚫ Inativo'}
                    </span>
                    <div className="tecnico-card-actions">
                      <button className="btn-sm btn-view" onClick={() => openTecnicoModal(tec)}>
                        ✏️ Editar
                      </button>
                      <button
                        className="btn-sm"
                        style={{ background: tec.ativo !== false ? '#f5f5f5' : 'var(--success)', color: tec.ativo !== false ? '#666' : '#fff' }}
                        onClick={() => toggleAtivoTecnico(tec)}
                      >
                        {tec.ativo !== false ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            ABA: CONFIGURAÇÕES
        ══════════════════════════════════════════════════ */}
        {abaAtiva === 'config' && (
          <div className="tab-content">
            <div className="config-tabs-bar">
              {[
                { id: 'empresa', label: '🏢 Minha Empresa' },
                { id: 'conta',   label: '👤 Minha Conta'   },
              ].map(t => (
                <button key={t.id} className={`config-tab-btn${configAba === t.id ? ' active' : ''}`}
                  onClick={() => setConfigAba(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Sub-aba: Minha Empresa ── */}
            {configAba === 'empresa' && (
              <div style={{ maxWidth: 620 }}>

                {/* Upload de logo */}
                <h3 className="config-section-title" style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
                  Logo da Empresa
                </h3>
                <div
                  className="logo-upload-area"
                  onClick={() => !logoUploading && logoInputRef.current?.click()}
                  style={{ marginBottom: 24, cursor: logoUploading ? 'not-allowed' : 'pointer', opacity: logoUploading ? .7 : 1 }}
                >
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/svg+xml,image/webp"
                    onChange={e => e.target.files[0] && handleLogoUpload(e.target.files[0])}
                  />
                  {logoPreview
                    ? <img src={logoPreview} alt="Logo atual" className="logo-preview" />
                    : <div className="logo-upload-icon">🖼️</div>
                  }
                  <div className="logo-upload-text">
                    {logoUploading
                      ? '⏳ Enviando...'
                      : <><strong>Clique para enviar</strong> ou arraste a logo<br /><span style={{ fontSize: '.75rem' }}>JPG, PNG ou SVG • Máx. 2MB</span></>
                    }
                  </div>
                </div>

                {/* Dados da empresa */}
                <h3 style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
                  Dados da Empresa
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div className="field">
                    <label className="form-label">Nome da empresa <span style={{ color: '#e53e3e' }}>*</span></label>
                    <input className="form-input"
                      value={configForm.nome}
                      onChange={e => setConfigForm(p => ({ ...p, nome: e.target.value }))}
                      placeholder="Nome da empresa" />
                  </div>
                  <div className="field">
                    <label className="form-label">CNPJ</label>
                    <input className="form-input"
                      value={configForm.cnpj}
                      onChange={e => setConfigForm(p => ({ ...p, cnpj: maskCNPJ(e.target.value) }))}
                      placeholder="00.000.000/0000-00" />
                  </div>
                  <div className="field">
                    <label className="form-label">Telefone principal <span style={{ color: '#e53e3e' }}>*</span></label>
                    <input className="form-input" type="tel"
                      value={configForm.telefone}
                      onChange={e => setConfigForm(p => ({ ...p, telefone: maskPhone(e.target.value) }))}
                      placeholder="(XX) XXXXX-XXXX" />
                  </div>
                  <div className="field">
                    <label className="form-label">WhatsApp (link flutuante)</label>
                    <input className="form-input" type="tel"
                      value={configForm.whatsapp}
                      onChange={e => setConfigForm(p => ({ ...p, whatsapp: maskPhone(e.target.value) }))}
                      placeholder="(XX) XXXXX-XXXX" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div className="field">
                    <label className="form-label">Endereço completo</label>
                    <input className="form-input"
                      value={configForm.endereco}
                      onChange={e => setConfigForm(p => ({ ...p, endereco: e.target.value }))}
                      placeholder="Rua, número, bairro" />
                  </div>
                  <div className="field">
                    <label className="form-label">Cidade / Estado</label>
                    <input className="form-input"
                      value={configForm.cidade_estado}
                      onChange={e => setConfigForm(p => ({ ...p, cidade_estado: e.target.value }))}
                      placeholder="Ex: São Paulo - SP" />
                  </div>
                </div>

                <div className="field" style={{ marginBottom: 24 }}>
                  <label className="form-label">Site (opcional)</label>
                  <input className="form-input" type="url"
                    value={configForm.site}
                    onChange={e => setConfigForm(p => ({ ...p, site: e.target.value }))}
                    placeholder="https://www.suaempresa.com.br" />
                </div>

                {/* Seguradoras */}
                <h3 style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
                  Seguradoras que você atende
                </h3>
                <div className="config-check-grid" style={{ marginBottom: 28 }}>
                  {['Mapfre','Tempo','Maxpar','Allianz','Porto Seguro','Tokio Marine'].map(seg => (
                    <div
                      key={seg}
                      className={`config-check-item${configForm.seguradoras.includes(seg) ? ' checked' : ''}`}
                      onClick={() => toggleSeguradora(seg)}
                    >
                      <div className="config-check-box">
                        {configForm.seguradoras.includes(seg) && <span style={{ color: '#fff', fontSize: '.8rem', fontWeight: 700 }}>✓</span>}
                      </div>
                      <span className="config-check-label">{seg}</span>
                    </div>
                  ))}
                </div>

                <button className="btn-primary" onClick={saveConfig} disabled={savingConfig} style={{ padding: '10px 28px', fontSize: '.9rem' }}>
                  {savingConfig ? '⏳ Salvando...' : '💾 Salvar dados'}
                </button>
              </div>
            )}

            {/* ── Sub-aba: Minha Conta ── */}
            {configAba === 'conta' && (
              <div style={{ maxWidth: 520 }}>

                {/* Avatar + nome */}
                <h3 style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
                  Informações da Conta
                </h3>

                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
                  <div className="config-big-avatar">{inicialUsuario}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>
                      Seu nome
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="form-input"
                        value={nomeUsuario}
                        onChange={e => setNomeUsuario(e.target.value)}
                        placeholder="Seu nome completo"
                        style={{ flex: 1 }}
                      />
                      <button className="btn-sm btn-ok" onClick={saveNomeUsuario} disabled={savingNome} style={{ whiteSpace: 'nowrap' }}>
                        {savingNome ? '⏳' : '💾 Salvar'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="config-info-row">
                  <span className="config-info-label">E-mail</span>
                  <span className="config-info-value">{emailUsuario || '—'}</span>
                </div>

                {auth.currentUser?.metadata?.creationTime && (
                  <div className="config-info-row">
                    <span className="config-info-label">Membro desde</span>
                    <span className="config-info-value">
                      {new Date(auth.currentUser.metadata.creationTime).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                )}

                {/* Informações do plano */}
                <div style={{ marginTop: 28 }}>
                  <h3 style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
                    Plano e Uso
                  </h3>

                  <div className="config-info-row">
                    <span className="config-info-label">Plano atual</span>
                    <span className="plan-badge">{planoAtual.charAt(0).toUpperCase() + planoAtual.slice(1)}</span>
                  </div>

                  <div className="config-info-row">
                    <span className="config-info-label">Limite de OS/mês</span>
                    <span className="config-info-value">
                      {planoInfo.limiteOS === -1 ? '∞ Ilimitado' : planoInfo.limiteOS}
                    </span>
                  </div>

                  <div className="config-info-row" style={{ borderBottom: planoInfo.limiteOS !== -1 ? '1px solid var(--border)' : 'none' }}>
                    <span className="config-info-label">OS usadas este mês</span>
                    <span className="config-info-value">{totalMes}</span>
                  </div>

                  {planoInfo.limiteOS !== -1 && (
                    <div style={{ paddingTop: 10 }}>
                      <div className="usage-bar-wrap">
                        <div className="usage-bar-track">
                          <div className={`usage-bar-fill ${usageCls}`} style={{ width: `${usagePct}%` }} />
                        </div>
                        <div className="usage-bar-labels">
                          <span>{totalMes} de {planoInfo.limiteOS} OS usadas</span>
                          <span>{usagePct}% do limite</span>
                        </div>
                      </div>
                      {usagePct >= 80 && (
                        <div style={{ background: usagePct >= 100 ? '#fff5f5' : '#fff8ec', border: `1px solid ${usagePct >= 100 ? '#fcc' : '#fce4b0'}`, borderRadius: 8, padding: '10px 14px', fontSize: '.82rem', color: usagePct >= 100 ? 'var(--danger)' : 'var(--warn-text)', fontWeight: 600, marginTop: 10 }}>
                          {usagePct >= 100
                            ? '🚫 Limite atingido — entre em contato para fazer upgrade do plano.'
                            : `⚠️ Você usou ${usagePct}% do limite. Considere fazer upgrade do plano.`
                          }
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Segurança */}
                <div style={{ marginTop: 28 }}>
                  <h3 style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', paddingBottom: 10, borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
                    Segurança
                  </h3>
                  {resetEmailEnviado
                    ? (
                      <div style={{ background: 'var(--success-bg)', border: '1px solid #b2dfc5', borderRadius: 10, padding: '12px 16px', fontSize: '.88rem', color: 'var(--success)', fontWeight: 600 }}>
                        ✅ E-mail enviado! Verifique sua caixa de entrada.
                      </div>
                    ) : (
                      <div>
                        <p style={{ fontSize: '.85rem', color: 'var(--muted)', marginBottom: 12 }}>
                          Um link de redefinição será enviado para <strong>{emailUsuario}</strong>.
                        </p>
                        <button className="btn-sm btn-view" onClick={sendResetEmail}>
                          🔑 Enviar link de redefinição de senha
                        </button>
                      </div>
                    )
                  }
                </div>
              </div>
            )}
          </div>
        )}

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

      {/* ══ MODAL: NOVA OS ══ */}
      {showOsForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && (setShowOsForm(false), setOsForm(OS_INITIAL), setOsErrors({}), setOsTecnicoMode('select'))}>
          <div className="modal-box">
            <div className="modal-header">
              <h2>📞 Nova Ordem de Serviço</h2>
              <button className="btn-sm" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }}
                onClick={() => { setShowOsForm(false); setOsForm(OS_INITIAL); setOsErrors({}); setOsTecnicoMode('select') }}>✕ Fechar</button>
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
                        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, border: '2px solid #ccc', borderTopColor: '#1a3fa8', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
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

              <div className="md-section">
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

              {/* Seleção de técnico */}
              <div className="md-section" style={{ marginBottom: 0 }}>
                <h3>👷 Técnico Responsável</h3>
                <div className="field">
                  <label>Selecionar técnico</label>
                  {osTecnicoMode === 'select'
                    ? (
                      <select
                        value={osForm.tecnico_id}
                        onChange={e => {
                          if (e.target.value === '__manual__') { setOsTecnicoMode('manual'); setOsField('tecnico_id', '') }
                          else setOsField('tecnico_id', e.target.value)
                        }}
                      >
                        <option value="">Selecione o técnico...</option>
                        {tecnicosAtivos.map(t => (
                          <option key={t.id} value={t.id}>{t.nome} — {t.telefone}</option>
                        ))}
                        <option value="__manual__">+ Digitar manualmente</option>
                      </select>
                    )
                    : (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          value={osForm.tecnico_nome_manual}
                          onChange={e => setOsField('tecnico_nome_manual', e.target.value)}
                          placeholder="Nome do técnico"
                          style={{ flex: 1 }}
                        />
                        {tecnicosAtivos.length > 0 && (
                          <button className="btn-sm btn-view" onClick={() => setOsTecnicoMode('select')} type="button">
                            ↩ Selecionar
                          </button>
                        )}
                      </div>
                    )
                  }
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-sm" style={{ background: 'var(--light)', color: 'var(--muted)', border: '1px solid var(--border)' }}
                onClick={() => { setShowOsForm(false); setOsForm(OS_INITIAL); setOsErrors({}); setOsTecnicoMode('select') }}>Cancelar</button>
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

              <div className="md-section">
                <h3>👤 Segurado</h3>
                <div className="md-grid">
                  <div className="md-field"><label>Nome</label><p>{selected.nome_segurado || '—'}</p></div>
                  <div className="md-field"><label>Telefone</label><p>{selected.tel_segurado || '—'}</p></div>
                  <div className="md-field"><label>Endereço</label><p>{selected.endereco || '—'}</p></div>
                  <div className="md-field"><label>Cidade</label><p>{selected.cidade || '—'}</p></div>
                </div>
              </div>

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

              {/* Técnico — com select integrado */}
              <div className="md-section" style={{ background: '#f5f8fc', border: '1px solid #c8d8ec', borderRadius: 8, padding: '14px 16px' }}>
                <h3 style={{ color: '#1a3fa8', marginBottom: 12 }}>👷 Técnico Responsável</h3>
                <div className="md-grid">
                  <div className="md-field">
                    <label>Nome do Técnico</label>
                    {detTecnicoMode === 'select'
                      ? (
                        <select
                          value={tecnicoForm.nome}
                          onChange={e => {
                            if (e.target.value === '__manual__') { setDetTecnicoMode('manual'); setTecnicoForm({ nome: '', tel: '' }) }
                            else {
                              const tec = tecnicosAtivos.find(t => t.nome === e.target.value)
                              if (tec) setTecnicoForm({ nome: tec.nome, tel: tec.telefone })
                              else setTecnicoForm(p => ({ ...p, nome: e.target.value }))
                            }
                          }}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, fontFamily: 'Barlow,sans-serif', fontSize: '.9rem' }}
                        >
                          <option value="">Selecione o técnico...</option>
                          {tecnicosAtivos.map(t => (
                            <option key={t.id} value={t.nome}>{t.nome} — {t.telefone}</option>
                          ))}
                          <option value="__manual__">+ Digitar manualmente</option>
                        </select>
                      )
                      : (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            value={tecnicoForm.nome}
                            onChange={e => setTecnicoForm(p => ({ ...p, nome: e.target.value }))}
                            placeholder="Nome completo do técnico"
                            style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, fontFamily: 'Barlow,sans-serif', fontSize: '.9rem' }}
                          />
                          {tecnicosAtivos.length > 0 && (
                            <button className="btn-sm btn-view" onClick={() => setDetTecnicoMode('select')} type="button">↩</button>
                          )}
                        </div>
                      )
                    }
                  </div>
                  <div className="md-field">
                    <label>Telefone do Técnico</label>
                    <input type="tel" value={tecnicoForm.tel} onChange={e => setTecnicoForm(p => ({ ...p, tel: e.target.value }))}
                      placeholder="(XX) XXXXX-XXXX"
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, fontFamily: 'Barlow,sans-serif', fontSize: '.9rem' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <button className="btn-sm btn-ok" disabled={savingTecnico} onClick={saveTecnico}>
                    {savingTecnico ? '⏳ Salvando...' : '💾 Salvar Técnico'}
                  </button>
                  {tecnicoForm.tel && tecnicoForm.nome && (
                    <a className="btn-whatsapp" href={buildWhatsAppTecnico(selected, tecnicoForm)}
                      target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', fontSize: '.82rem' }}>
                      📲 Enviar no WhatsApp
                    </a>
                  )}
                </div>
              </div>

              {selected.avaliacao_nota
                ? (
                  <div className="md-section" style={{ background: '#fffbf0', border: '1px solid #f0d88a', borderRadius: 8, padding: '14px 16px' }}>
                    <h3 style={{ color: '#8a6a00', marginBottom: 8 }}>⭐ Avaliação do Segurado</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {[1,2,3,4,5].map(i => (
                          <span key={i} style={{ fontSize: '1.5rem', color: i <= selected.avaliacao_nota ? '#f0c020' : '#ddd' }}>★</span>
                        ))}
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#8a6a00' }}>{selected.avaliacao_nota}/5</span>
                    </div>
                    {selected.avaliacao_comentario && (
                      <div style={{ marginTop: 8, padding: '8px 12px', background: '#fff8e0', borderRadius: 6, fontSize: '.88rem', color: '#555', fontStyle: 'italic' }}>
                        "{selected.avaliacao_comentario}"
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="md-section" style={{ background: '#fafafa', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
                    <h3 style={{ color: 'var(--muted)', marginBottom: 4 }}>⭐ Avaliação do Segurado</h3>
                    <p style={{ fontSize: '.82rem', color: 'var(--muted)' }}>Ainda não avaliado.</p>
                  </div>
                )
              }

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
                      const lucro   = (mos - vpt) + vds
                      const hasVal  = !!(finForm.mo_seguradora || finForm.valor_prestador || finForm.valor_deslocamento)
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

              {(selected.assinatura_prestador || selected.assinatura_segurado) && (
                <div className="md-section">
                  <h3>✍️ Assinaturas</h3>
                  <div className="md-grid">
                    <div className="md-field"><label>Prestador</label>{selected.assinatura_prestador ? <img className="sig-img" src={selected.assinatura_prestador} alt="" /> : <p style={{ color: 'var(--muted)' }}>Não registrada</p>}</div>
                    <div className="md-field"><label>Segurado</label>{selected.assinatura_segurado ? <img className="sig-img" src={selected.assinatura_segurado} alt="" /> : <p style={{ color: 'var(--muted)' }}>Não registrada</p>}</div>
                  </div>
                </div>
              )}

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

      {/* ══ MODAL: HISTÓRICO DO SEGURADO ══ */}
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
                  const ultima = osOrdem[0]
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
                        <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => { setSelectedSegurado(null); setSelected(o) }}>
                          <td data-label="Data">{fmtDate(o.data_chegada)}</td>
                          <td data-label="Seguradora">{o.seguradora || '—'}</td>
                          <td data-label="Serviço">{o.servico || '—'}</td>
                          <td data-label="Status"><span className={`badge ${badgeCls(o.status)}`}>{badgeLabel(o.status)}</span></td>
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

      {/* ══ MODAL: ADICIONAR / EDITAR TÉCNICO ══ */}
      {showTecnicoModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowTecnicoModal(false)}>
          <div className="modal-box" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2>{tecnicoEdit ? '✏️ Editar Técnico' : '👷 Novo Técnico'}</h2>
              <button className="btn-sm" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }}
                onClick={() => setShowTecnicoModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="field" style={{ gridColumn: '1/-1' }}>
                  <label>Nome completo <span className="req">*</span></label>
                  <input
                    value={tecnicoFormData.nome}
                    onChange={e => setTecnicoFormData(p => ({ ...p, nome: e.target.value }))}
                    className={tecnicoFormErrors.nome ? 'error' : ''}
                    placeholder="Nome completo do técnico"
                  />
                </div>
                <div className="field">
                  <label>Telefone <span className="req">*</span></label>
                  <input
                    type="tel"
                    value={tecnicoFormData.telefone}
                    onChange={e => setTecnicoFormData(p => ({ ...p, telefone: maskPhone(e.target.value) }))}
                    className={tecnicoFormErrors.telefone ? 'error' : ''}
                    placeholder="(XX) XXXXX-XXXX"
                  />
                </div>
                <div className="field">
                  <label>E-mail (opcional)</label>
                  <input
                    type="email"
                    value={tecnicoFormData.email}
                    onChange={e => setTecnicoFormData(p => ({ ...p, email: e.target.value }))}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="field" style={{ gridColumn: '1/-1' }}>
                  <label>Especialidade (opcional)</label>
                  <input
                    value={tecnicoFormData.especialidade}
                    onChange={e => setTecnicoFormData(p => ({ ...p, especialidade: e.target.value }))}
                    placeholder="Ex: Hidráulica, Elétrica"
                  />
                </div>

                <div style={{ gridColumn: '1/-1' }}>
                  <div className="toggle-wrap">
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={tecnicoFormData.ativo}
                        onChange={e => setTecnicoFormData(p => ({ ...p, ativo: e.target.checked }))}
                      />
                      <span className="toggle-slider" />
                    </label>
                    <span className="toggle-label">{tecnicoFormData.ativo ? '🟢 Ativo' : '⚫ Inativo'}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-sm" style={{ background: 'var(--light)', color: 'var(--muted)', border: '1px solid var(--border)' }}
                onClick={() => setShowTecnicoModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={saveTecnicoModal} disabled={savingTecnicoForm} style={{ padding: '9px 22px', fontSize: '.9rem' }}>
                {savingTecnicoForm ? '⏳ Salvando...' : '💾 Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
