// ============================================================
// ADMIN PAGE — Painel da empresa (multi-tenant) — AssistHub
// Fase 2: Técnicos, Perfil do Usuário, Minha Empresa
// ============================================================
import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
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
  arrayUnion,
  PLANOS,
  storageRef,
  uploadBytes,
  getDownloadURL,
  getDoc,
  query,
  orderBy,
  limit,
} from '../firebase.js'
import { sendPasswordResetEmail, updateProfile } from 'firebase/auth'
import { useAuth }    from '../contexts/AuthContext.jsx'
import { useEmpresa } from '../hooks/useEmpresa.js'
import { AdminContext } from '../contexts/AdminContext.jsx'
import DashboardTab     from '../components/admin/DashboardTab.jsx'
import OrdensServicoTab from '../components/admin/OrdensServicoTab.jsx'
import OrcamentosTab, { STATUS_ORC_META } from '../components/admin/OrcamentosTab.jsx'
import TecnicosTab      from '../components/admin/TecnicosTab.jsx'
import SeguradosTab     from '../components/admin/SeguradosTab.jsx'
import RelatorioTab     from '../components/admin/RelatorioTab.jsx'
import ConfigTab             from '../components/admin/ConfigTab.jsx'
import ImportarMapfreModal   from '../components/admin/ImportarMapfreModal.jsx'
import { generatePDF } from '../utils/pdfGenerator.js'
import { generatePNG } from '../utils/pngGenerator.js'
import { generatePDFCliente, generatePDFSeguradora } from '../utils/orcamentoPdfGenerator.js'
import { fmtDate, fmtBRL, getLucro, maskPhone } from '../utils/formatters.js'

// ── Helpers de formatação ────────────────────────────────────
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

const STATUS_META = {
  aguardando_tecnico: { label: '🔔 Aguardando',       cls: 'aguardando-t',    dot: '#f05a1a' },
  pendente:           { label: '⏳ Pendente',           cls: 'pendente-y',      dot: '#f59e0b' },
  concluido:          { label: '✅ Concluído',          cls: 'processado-g',    dot: '#2d8a4e' },
  processado:         { label: '📋 Processado',        cls: 'processado-g',    dot: '#1a3fa8' },
  enviado:            { label: '📤 Enviado',            cls: 'enviado-b',       dot: '#7c3aed' },
  ficou_visita:       { label: '🔄 Ficou na Visita',   cls: 'ficou-visita',    dot: '#3b82f6' },
  cliente_ausente:    { label: '🚪 Cliente Ausente',   cls: 'cliente-ausente', dot: '#9ca3af' },
}
const badgeLabel = s => STATUS_META[s]?.label ?? STATUS_META.pendente.label
const badgeCls   = s => STATUS_META[s]?.cls   ?? 'pendente-y'

const OS_INITIAL = {
  seguradora: '', num_assist: '', nome_segurado: '',
  tel_segurado: '', cep: '', endereco: '', numero: '', cidade: '',
  data_atend: '', hora_atend: '', servico: '', desc_problema: '',
  tecnico_id: '', tecnico_nome_manual: '',
  data_agendada: '', hora_agendada: '',
  faixa_horario: '', faixa_horario_custom: '',
}

const ORC_INITIAL = {
  tipo: '', cenario: '', seguradora: '', num_assist: '',
  nome_cliente: '', tel_cliente: '', email_cliente: '',
  endereco: '', cidade: '',
  tipo_equipamento: '', marca: '', modelo: '', voltagem: '', defeito: '',
  tipo_emergencia: '', desc_problema: '',
  validade: '', prazo_execucao: '', garantia: '90 dias',
  forma_pagamento: 'pix', observacoes: '', tecnico_id: '',
}

function novoItemOrc() {
  return {
    id: `item_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    descricao: '', quantidade: 1,
    valor_unit: 0, valor_total: 0,
    paga_seguradora: 0, paga_cliente: 0,
  }
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
  const location = useLocation()
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
  const [abaAtiva,    setAbaAtiva]    = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // ── Modais OS ────────────────────────────────────────────
  const [selected,           setSelected]           = useState(null)
  const [showOsForm,         setShowOsForm]         = useState(false)
  const [showImportarMapfre, setShowImportarMapfre] = useState(false)
  const [osForm,        setOsForm]        = useState(OS_INITIAL)
  const [osErrors,      setOsErrors]      = useState({})
  const [osCepLoading,  setOsCepLoading]  = useState(false)
  const [savingOs,      setSavingOs]      = useState(false)
  const osEnderecoRef = useRef(null)
  const [generatedLink, setGeneratedLink] = useState(null)
  const [copied,        setCopied]        = useState(false)

  // ── Link Relatório (modal de compartilhamento com seguradora) ──
  const [linkRelModal,  setLinkRelModal]  = useState(null)
  const [linkRelCopied, setLinkRelCopied] = useState(false)
  const [genPng,        setGenPng]        = useState(false)
  // modo de seleção de técnico no form de OS (select | manual)
  const [osTecnicoMode, setOsTecnicoMode] = useState('select')

  // ── Financeiro e Técnico (modal detalhe OS) ──────────────
  const [finForm,       setFinForm]       = useState({ mo_seguradora: '', valor_prestador: '', valor_deslocamento: '' })
  const [savingFin,     setSavingFin]     = useState(false)
  const [tecnicoForm,   setTecnicoForm]   = useState({ nome: '', tel: '' })
  const [savingTecnico, setSavingTecnico] = useState(false)
  const [editAtend,     setEditAtend]     = useState(false)
  const [atendForm,     setAtendForm]     = useState({})
  const [savingAtend,   setSavingAtend]   = useState(false)
  // modo técnico no detalhe da OS
  const [detTecnicoMode, setDetTecnicoMode] = useState('select')

  // ── Anotações internas (visível só pelo admin, nunca vai ao PDF/PNG) ──
  const [anotacaoInterna, setAnotacaoInterna] = useState('')
  const [savingAnotacao,  setSavingAnotacao]  = useState(false)

  // ── Técnicos ─────────────────────────────────────────────
  const [tecnicos,        setTecnicos]        = useState([])
  const [loadingTecnicos, setLoadingTecnicos] = useState(false)

  // ── Logo (lida no sidebar, atualizada pelo ConfigTab via contexto) ──
  const [logoPreview, setLogoPreview] = useState(null)

  // ── Orçamentos ───────────────────────────────────────────
  const [orcamentos,      setOrcamentos]      = useState([])
  const [loadingOrc,      setLoadingOrc]      = useState(false)

  // Modal novo orçamento (3 etapas)
  const [showNovoOrc,     setShowNovoOrc]     = useState(false)
  const [orcEtapa,        setOrcEtapa]        = useState(1)
  const [orcForm,         setOrcForm]         = useState({ ...ORC_INITIAL })
  const [orcErrors,       setOrcErrors]       = useState({})
  const [savingOrc,       setSavingOrc]       = useState(false)

  // Modal links gerados (orçamento)
  const [orcLinks,        setOrcLinks]        = useState(null)
  const [orcLinkCopied,   setOrcLinkCopied]   = useState(false)

  // Modal revisar orçamento
  const [showRevisarOrc,  setShowRevisarOrc]  = useState(false)
  const [revisarOrc,      setRevisarOrc]      = useState(null)
  const [revisarItens,    setRevisarItens]    = useState([])
  const [savingRevisar,   setSavingRevisar]   = useState(false)
  const [orcGarantiaObs,  setOrcGarantiaObs]  = useState('')

  // Modal converter em OS
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
    // carrega anotação interna (campo exclusivo do admin)
    setAnotacaoInterna(selected.anotacao_interna || '')
  }, [selected?.id])

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
    setLinkRelCopied(false)
    setLinkRelModal(r)
  }

  function copyLinkRel(link) {
    navigator.clipboard.writeText(link).then(() => {
      setLinkRelCopied(true)
      setTimeout(() => setLinkRelCopied(false), 2000)
    })
  }

  async function excluirOS(os) {
    if (!window.confirm(`Excluir OS de "${os.nome_segurado}"?\nEsta ação não pode ser desfeita.`)) return
    try {
      await deleteDoc(doc(db, `empresas/${empresaId}/checklist`, os.id))
      setReports(p => p.filter(r => r.id !== os.id))
      setSelected(null)
      showToast('OS excluída.', 'success')
    } catch (e) {
      showToast('Erro ao excluir OS: ' + e.message, 'error')
    }
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
        data_chegada: '', hora_chegada: '',
        data_agendada: osForm.data_agendada || '', hora_agendada: '',
        faixa_horario: osForm.faixa_horario || '', faixa_horario_custom: osForm.faixa_horario_custom || '',
        servico: osForm.servico, desc_problema: osForm.desc_problema,
        status: 'aguardando_tecnico', origem: 'admin',
        tecnico_nome: tecNome, tecnico_tel: tecTel, tecnico_id: tecId,
        publicToken: crypto.randomUUID(),
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

  function abrirEditAtend() {
    setAtendForm({
      seguradora:    selected.seguradora    || '',
      num_assist:    selected.num_assist    || '',
      data_chegada:  selected.data_chegada  || '',
      hora_chegada:  selected.hora_chegada  || '',
      hora_saida:    selected.hora_saida    || '',
      servico:       selected.servico       || '',
      nome_segurado: selected.nome_segurado || '',
      tel_segurado:  selected.tel_segurado  || '',
      endereco:      selected.endereco      || '',
      numero:        selected.numero        || '',
      bairro:        selected.bairro        || '',
      cidade:        selected.cidade        || '',
      cep:           selected.cep           || '',
      desc_problema: selected.desc_problema || '',
    })
    setEditAtend(true)
  }

  async function saveAtend() {
    setSavingAtend(true)
    try {
      await atualizarOS(empresaId, selected.id, atendForm)
      const updated = { ...selected, ...atendForm }
      setReports(p => p.map(r => r.id === selected.id ? updated : r))
      setSelected(updated)
      setEditAtend(false)
      showToast('✅ OS atualizada!')
    } catch (e) {
      showToast('Erro: ' + e.message, 'error')
    } finally {
      setSavingAtend(false)
    }
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

  // ── Salva anotação interna da OS (nunca vai ao PDF nem PNG) ──
  async function saveAnotacao() {
    if (!empresaId || !selected) return
    setSavingAnotacao(true)
    try {
      await updateDoc(doc(db, 'empresas', empresaId, 'checklist', selected.id), {
        anotacao_interna: anotacaoInterna,
      })
      setReports(p => p.map(r => r.id === selected.id ? { ...r, anotacao_interna: anotacaoInterna } : r))
      showToast('✅ Anotação salva!')
    } catch (e) { showToast('Erro ao salvar: ' + e.message, 'error') }
    finally { setSavingAnotacao(false) }
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

  // Gera número sequencial do orçamento (ORC-AAAA-NNNN)
  async function gerarNumeroOrcamento() {
    if (!empresaId) return `ORC-${new Date().getFullYear()}-0001`
    try {
      const q = query(
        collection(db, `empresas/${empresaId}/orcamentos`),
        orderBy('criado_em', 'desc'),
        limit(1)
      )
      const snap = await getDocs(q)
      if (snap.empty) return `ORC-${new Date().getFullYear()}-0001`
      const ultimo = snap.docs[0].data().numero || 'ORC-2026-0000'
      const seq = parseInt(ultimo.split('-')[2] || '0') + 1
      return `ORC-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`
    } catch {
      return `ORC-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
    }
  }

  function buildLinkTecnicoOrc(orcId) {
    return `${window.location.origin}/orcamento/${slug}/${orcId}`
  }
  function buildLinkClienteOrc(orcId) {
    return `${window.location.origin}/aprovar/${slug}/${orcId}`
  }

  async function copyOrcLink(link) {
    try { await navigator.clipboard.writeText(link) } catch {
      const el = document.createElement('textarea')
      el.value = link; document.body.appendChild(el); el.select()
      document.execCommand('copy'); document.body.removeChild(el)
    }
    setOrcLinkCopied(true)
    setTimeout(() => setOrcLinkCopied(false), 2500)
  }

  // Valida e salva novo orçamento
  async function saveNovoOrcamento() {
    const e = {}
    if (!orcForm.tipo)                      e.tipo           = true
    if (!orcForm.nome_cliente?.trim())      e.nome_cliente   = true
    if (!orcForm.tel_cliente?.trim())       e.tel_cliente    = true
    if (!orcForm.endereco?.trim())          e.endereco       = true
    if (!orcForm.cidade?.trim())            e.cidade         = true
    if (orcForm.tipo === 'linha_branca') {
      if (!orcForm.tipo_equipamento)        e.tipo_equipamento = true
      if (!orcForm.defeito?.trim())         e.defeito          = true
    }
    if (orcForm.tipo === 'emergencial') {
      if (!orcForm.tipo_emergencia)         e.tipo_emergencia = true
      if (!orcForm.desc_problema?.trim())   e.desc_problema  = true
    }
    if (Object.keys(e).length) { setOrcErrors(e); return }

    setSavingOrc(true)
    try {
      const numero  = await gerarNumeroOrcamento()
      const cenario = orcForm.tipo === 'particular' ? 'particular' : (orcForm.cenario || 'particular')
      let tecNome = ''
      let tecTel  = ''
      if (orcForm.tecnico_id) {
        const tec = tecnicos.find(t => t.id === orcForm.tecnico_id)
        if (tec) { tecNome = tec.nome; tecTel = tec.telefone }
      }

      // Padrão validade: +30 dias
      const validade = orcForm.validade || (() => {
        const d = new Date(); d.setDate(d.getDate() + 30)
        return d.toISOString().slice(0, 10)
      })()

      const payload = {
        numero,
        tipo:             orcForm.tipo || '',
        status:           'aguardando_tecnico',
        criado_em:        serverTimestamp(),
        validade,
        os_vinculada:     null,
        seguradora:       orcForm.tipo !== 'particular' ? (orcForm.seguradora || '') : '',
        num_assist:       orcForm.tipo !== 'particular' ? (orcForm.num_assist  || '') : '',
        cenario,
        nome_cliente:     orcForm.nome_cliente?.trim()     || '',
        tel_cliente:      orcForm.tel_cliente?.trim()      || '',
        email_cliente:    orcForm.email_cliente?.trim()    || '',
        endereco:         orcForm.endereco?.trim()         || '',
        cidade:           orcForm.cidade?.trim()           || '',
        tipo_equipamento: orcForm.tipo_equipamento         || '',
        marca:            orcForm.marca?.trim()            || '',
        modelo:           orcForm.modelo?.trim()           || '',
        voltagem:         orcForm.voltagem                 || '',
        defeito:          orcForm.defeito?.trim()          || '',
        tipo_emergencia:  orcForm.tipo_emergencia          || '',
        desc_problema:    orcForm.desc_problema?.trim()    || '',
        itens:            [],
        total_geral:      0, total_seguradora: 0, total_cliente: 0,
        desconto_pct:     0, desconto_valor:   0,
        forma_pagamento:  orcForm.forma_pagamento          || 'pix',
        prazo_execucao:   orcForm.prazo_execucao           || '',
        garantia:         orcForm.garantia                 || '90 dias',
        garantia_obs:     '',
        observacoes:      orcForm.observacoes?.trim()      || '',
        tecnico_id:       orcForm.tecnico_id               || '',
        tecnico_nome:     tecNome,
        diagnostico:      '',
        preenchido_em:    null,
        aprovado_por:     '', assinatura_cliente: '',
        aprovado_em:      null, motivo_reprovacao: '',
        aprovado_seguradora_em: null,
      }

      const ref    = await addDoc(collection(db, `empresas/${empresaId}/orcamentos`), payload)
      const newOrc = { id: ref.id, ...payload, criado_em: { toDate: () => new Date() } }
      setOrcamentos(p => [newOrc, ...p])
      setShowNovoOrc(false)
      setOrcForm({ ...ORC_INITIAL })
      setOrcErrors({})
      setOrcEtapa(1)
      setOrcLinks({ id: ref.id, numero, tecnico: buildLinkTecnicoOrc(ref.id), tecnicoNome: tecNome, tecnicoTel: tecTel, payload })
      showToast('✅ Orçamento criado!')
    } catch (e) {
      showToast('Erro ao criar orçamento: ' + e.message, 'error')
    } finally {
      setSavingOrc(false)
    }
  }

  // Abre modal de revisão
  function openRevisarOrcamento(orc) {
    setRevisarOrc(orc)
    setRevisarItens((orc.itens?.length ? orc.itens : [novoItemOrc()]).map(it => ({ ...it })))
    setOrcGarantiaObs(orc.garantia_obs || '')
    setShowRevisarOrc(true)
  }

  function addItemRevisar() {
    setRevisarItens(p => [...p, novoItemOrc()])
  }
  function removeItemRevisar(id) {
    setRevisarItens(p => { const n = p.filter(it => it.id !== id); return n.length ? n : [novoItemOrc()] })
  }
  function updateItemRevisar(id, campo, valor) {
    setRevisarItens(prev => prev.map(it => {
      if (it.id !== id) return it
      const updated = { ...it, [campo]: valor }
      if (campo === 'quantidade' || campo === 'valor_unit') {
        const qtd  = parseInt(updated.quantidade) || 1
        const unit = parseFloat(String(updated.valor_unit).replace(',', '.')) || 0
        updated.valor_total = qtd * unit
        const cenario = revisarOrc?.cenario || 'particular'
        if (cenario === 'particular' || cenario === 'fora_contrato') {
          updated.paga_cliente    = updated.valor_total
          updated.paga_seguradora = 0
        }
      }
      return updated
    }))
  }

  // Salva revisão (admin edita itens e divisão)
  async function saveRevisarOrcamento() {
    if (!revisarOrc) return
    setSavingRevisar(true)
    try {
      const itensNorm = revisarItens.map(it => ({
        id:              it.id || `item_${Date.now()}`,
        descricao:       it.descricao       || '',
        quantidade:      parseInt(it.quantidade) || 1,
        valor_unit:      parseFloat(it.valor_unit)      || 0,
        valor_total:     parseFloat(it.valor_total)     || 0,
        paga_seguradora: parseFloat(it.paga_seguradora) || 0,
        paga_cliente:    parseFloat(it.paga_cliente)    || 0,
      }))
      const totalGeral = itensNorm.reduce((acc, it) => acc + it.valor_total, 0)
      const totalSeg   = itensNorm.reduce((acc, it) => acc + it.paga_seguradora, 0)
      const totalCli   = itensNorm.reduce((acc, it) => acc + it.paga_cliente, 0)
      const payload = { itens: itensNorm, total_geral: totalGeral, total_seguradora: totalSeg, total_cliente: totalCli, garantia_obs: orcGarantiaObs || '' }
      await updateDoc(doc(db, `empresas/${empresaId}/orcamentos`, revisarOrc.id), payload)
      setOrcamentos(p => p.map(o => o.id === revisarOrc.id ? { ...o, ...payload } : o))
      setRevisarOrc(p => ({ ...p, ...payload }))
      showToast('✅ Orçamento salvo!')
    } catch (e) { showToast('Erro: ' + e.message, 'error') }
    finally { setSavingRevisar(false) }
  }

  // Envia link do orçamento para o cliente via WhatsApp
  async function enviarLinkCliente(orc) {
    try {
      await updateDoc(doc(db, `empresas/${empresaId}/orcamentos`, orc.id), { status: 'enviado_cliente' })
      setOrcamentos(p => p.map(o => o.id === orc.id ? { ...o, status: 'enviado_cliente' } : o))
      if (revisarOrc?.id === orc.id) setRevisarOrc(p => ({ ...p, status: 'enviado_cliente' }))

      const link       = buildLinkClienteOrc(orc.id)
      const telCliente = (orc.tel_cliente || '').replace(/\D/g, '')
      const nomeEmp    = config?.nome || empresa?.nome || 'AssistHub'
      const msg = `Olá ${orc.nome_cliente || ''}! 😊\nSeu orçamento está pronto para análise.\n\n📋 Orçamento: ${orc.numero}\n🔧 Serviço: ${orc.tipo_equipamento || orc.tipo || '—'} ${orc.marca || ''}\n💰 Valor: ${fmtBRL(orc.total_cliente || orc.total_geral || 0)}\n✅ Garantia: ${orc.garantia || '—'}\n⏱️ Prazo: ${orc.prazo_execucao || '—'}\n\nPara visualizar e aprovar, clique no link:\n🔗 ${link}\n\nDúvidas? Entre em contato:\n📞 ${config?.telefone || ''}`
      const waUrl = telCliente
        ? `https://wa.me/55${telCliente}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`
      window.open(waUrl, '_blank')
      showToast('📤 Link enviado ao cliente!')
    } catch (e) { showToast('Erro: ' + e.message, 'error') }
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

  // Converte orçamento aprovado em Ordem de Serviço
  async function converterEmOS(orc) {
    setSavingOrc(true)
    try {
      const servicoDesc = orc.tipo === 'linha_branca'
        ? `${orc.tipo_equipamento || ''} ${orc.marca || ''} ${orc.modelo || ''}`.trim()
        : orc.tipo_emergencia || orc.tipo || ''
      const payload = {
        seguradora:    orc.seguradora    || '',
        num_assist:    orc.num_assist    || '',
        nome_segurado: orc.nome_cliente  || '',
        tel_segurado:  orc.tel_cliente   || '',
        endereco:      orc.endereco      || '',
        cidade:        orc.cidade        || '',
        servico:       servicoDesc,
        desc_problema: orc.diagnostico   || orc.defeito || orc.desc_problema || '',
        status:        'pendente',
        origem:        'orcamento',
        tecnico_nome:  orc.tecnico_nome  || '',
        tecnico_id:    orc.tecnico_id    || '',
        data_chegada:  '',
        publicToken:   crypto.randomUUID(),
      }
      const ref    = await criarOS(empresaId, payload)
      const newRec = { id: ref.id, ...payload, criado_em: { toDate: () => new Date() } }
      await updateDoc(doc(db, `empresas/${empresaId}/orcamentos`, orc.id), { os_vinculada: ref.id, status: 'executado' })
      setOrcamentos(p => p.map(o => o.id === orc.id ? { ...o, os_vinculada: ref.id, status: 'executado' } : o))
      setReports(p => [newRec, ...p])
      setTotalMes(p => p + 1)
      setShowConverterOS(false)
      setShowRevisarOrc(false)
      setRevisarOrc(null)
      setGeneratedLink({ link: buildLink(newRec), os: ref.id, nome: orc.nome_cliente, seguradora: orc.seguradora, num_assist: orc.num_assist })
      showToast('🎉 OS criada com sucesso!')
    } catch (e) { showToast('Erro ao criar OS: ' + e.message, 'error') }
    finally { setSavingOrc(false) }
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
            { id: 'config',     icon: '⚙️', label: 'Configurações'     },
            { id: 'relatorio',  icon: '📊', label: 'Relatório Mensal'  },
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
                {{ dashboard: '📊 Dashboard', os: '📋 Ordens de Serviço', orcamentos: '📄 Orçamentos', segurados: '👥 Segurados', tecnicos: '👷 Técnicos', config: '⚙️ Configurações' }[abaAtiva]}
              </div>
              <div className="page-header-sub">{nomeEmpresa}</div>
            </div>
          </div>
          <div className="page-header-actions">
            <button className="btn-secondary" style={{ fontSize: '.82rem', padding: '7px 14px' }} onClick={loadReports} disabled={loading}>
              🔄 Atualizar
            </button>
            {abaAtiva === 'orcamentos'
              ? (
                <button className="btn-new-os" onClick={() => { setShowNovoOrc(true); setOrcEtapa(1); setOrcForm({ ...ORC_INITIAL }) }}>
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

        {/* ══════════════════════════════════════════════════
            ABA: DASHBOARD
        ══════════════════════════════════════════════════ */}
        {abaAtiva === 'dashboard' && <DashboardTab />}

        {/* ══════════════════════════════════════════════════
            ABA: ORDENS DE SERVIÇO
        ══════════════════════════════════════════════════ */}
        {abaAtiva === 'os' && <OrdensServicoTab />}

        {/* ══════════════════════════════════════════════════
            ABA: ORÇAMENTOS
        ══════════════════════════════════════════════════ */}
        {abaAtiva === 'orcamentos' && <OrcamentosTab />}

        {/* ══════════════════════════════════════════════════
            ABA: SEGURADOS
        ══════════════════════════════════════════════════ */}
        {abaAtiva === 'segurados' && <SeguradosTab onSelectOS={setSelected} />}

        {/* ══════════════════════════════════════════════════
            ABA: TÉCNICOS
        ══════════════════════════════════════════════════ */}
        {abaAtiva === 'tecnicos' && <TecnicosTab />}

        {/* ══════════════════════════════════════════════════
            ABA: CONFIGURAÇÕES
        ══════════════════════════════════════════════════ */}
        {abaAtiva === 'config' && <ConfigTab />}

        {/* ══ RELATÓRIO MENSAL ══════════════════════════════════════ */}
        {abaAtiva === 'relatorio' && <RelatorioTab />}

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

      {/* ══ MODAL: IMPORTAR MAPFRE ══ */}
      {showImportarMapfre && (
        <ImportarMapfreModal
          onClose={() => setShowImportarMapfre(false)}
          onImportar={campos => {
            setOsForm(prev => ({ ...prev, ...campos }))
            setShowImportarMapfre(false)
            setShowOsForm(true)
          }}
        />
      )}

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
                    <label>Data Agendada <span className="req" title="Usado na Agenda Visual">📅</span></label>
                    <input type="date" value={osForm.data_agendada} onChange={e => setOsField('data_agendada', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Faixa de Horário</label>
                    <select value={osForm.faixa_horario} onChange={e => setOsField('faixa_horario', e.target.value)}>
                      <option value="">Selecione...</option>
                      <option value="manha">🌅 Manhã — 08:00 às 12:00</option>
                      <option value="tarde">☀️ Tarde — 13:00 às 17:00</option>
                      <option value="dia_todo">📅 Manhã e Tarde — 08:00 às 17:00</option>
                      <option value="a_combinar">🤝 A Combinar</option>
                    </select>
                  </div>
                  {osForm.faixa_horario && (
                  <div className="field" style={{ marginTop: 8 }}>
                    <label>Detalhar horário (opcional)</label>
                    <input
                      value={osForm.faixa_horario_custom}
                      onChange={e => setOsField('faixa_horario_custom', e.target.value)}
                      placeholder="Ex: 14:00, após 15h, antes do meio-dia..."
                    />
                  </div>
                  )}
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

      {/* ══ MODAL: LINK DO RELATÓRIO ══ */}
      {linkRelModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setLinkRelModal(null)}>
          <div className="modal-box" style={{ maxWidth: 520 }}>
            <div className="modal-header" style={{ background: '#1a5276' }}>
              <h2>🔗 Link do Relatório</h2>
              <button className="btn-sm" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={() => setLinkRelModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '.82rem', color: 'var(--muted)', marginBottom: 10 }}>
                Envie este link para a seguradora
              </p>
              <div className="link-info-cards">
                <div className="link-info-card"><span className="link-info-lbl">Segurado</span><span className="link-info-val">{linkRelModal.nome_segurado || '—'}</span></div>
                <div className="link-info-card"><span className="link-info-lbl">Nº Assistência</span><span className="link-info-val">{linkRelModal.num_assist || '—'}</span></div>
                <div className="link-info-card"><span className="link-info-lbl">Seguradora</span><span className="link-info-val">{linkRelModal.seguradora || '—'}</span></div>
              </div>
              <div className="link-box" style={{ marginTop: 14 }}>
                <span className="link-text">{buildLinkRelatorio(linkRelModal.id, linkRelModal.publicToken)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                <button
                  className={`btn-copy${linkRelCopied ? ' copied' : ''}`}
                  onClick={() => copyLinkRel(buildLinkRelatorio(linkRelModal.id, linkRelModal.publicToken))}>
                  {linkRelCopied ? '✅ Copiado!' : '📋 Copiar Link'}
                </button>
                <a className="btn-whatsapp"
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Olá! Segue o relatório técnico do atendimento:\n\n` +
                    `📋 OS: ${linkRelModal.num_assist || '—'}\n` +
                    `👤 Segurado: ${linkRelModal.nome_segurado || '—'}\n` +
                    `📍 ${linkRelModal.cidade || '—'}\n` +
                    `🔧 ${linkRelModal.servico || '—'}\n` +
                    `📅 ${linkRelModal.data_chegada || '—'}\n\n` +
                    `🔗 Acesse o relatório completo:\n${buildLinkRelatorio(linkRelModal.id, linkRelModal.publicToken)}\n\n` +
                    `O relatório contém fotos, checklist e assinaturas do prestador e do segurado.`
                  )}`}
                  target="_blank" rel="noopener noreferrer">
                  📲 Enviar no WhatsApp
                </a>
                <button className="btn-sm" style={{ background: '#1a5276', color: '#fff', fontSize: '.85rem', padding: '8px 14px', width: '100%' }}
                  onClick={() => window.open(buildLinkRelatorio(linkRelModal.id, linkRelModal.publicToken), '_blank')}>
                  🔗 Abrir Relatório
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-sm btn-view" onClick={() => setLinkRelModal(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: DETALHE DA OS ══ */}
      {selected && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setSelected(null); setEditAtend(false) } }}>
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
                <button className="btn-sm" style={{ background: '#1a5276', color: '#fff' }} onClick={() => openLinkRelModal(selected)}>🔗 Link Relatório</button>
                <button className="btn-sm" style={{ background: 'rgba(220,38,38,.35)', color: '#fff' }} title="Excluir OS" onClick={() => excluirOS(selected)}>🗑️</button>
                <button className="btn-sm" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={() => { setSelected(null); setEditAtend(false) }}>✕</button>
              </div>
            </div>

            <div className="modal-body">
              {selected.origem === 'admin' && (
                <div style={{ marginBottom: 14 }}>
                  <span className="badge" style={{ background: '#f0f5ff', color: '#1a3a8c', border: '1px solid #b0c4f0' }}>📞 OS Cadastrada Manualmente</span>
                </div>
              )}

              <div className="md-section">
                <h3 style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span>📋 Atendimento</span>
                  {!editAtend
                    ? <button className="btn-sm" style={{ fontSize:'11px', padding:'3px 10px' }} onClick={abrirEditAtend}>✏️ Editar</button>
                    : <div style={{ display:'flex', gap:6 }}>
                        <button className="btn-sm" style={{ fontSize:'11px', padding:'3px 10px', background:'var(--muted)', color:'#fff' }} onClick={() => setEditAtend(false)}>Cancelar</button>
                        <button className="btn-sm btn-ok" style={{ fontSize:'11px', padding:'3px 10px' }} disabled={savingAtend} onClick={saveAtend}>{savingAtend ? '⏳' : '💾 Salvar'}</button>
                      </div>
                  }
                </h3>
                {!editAtend ? (
                  <div className="md-grid">
                    <div className="md-field"><label>Seguradora</label><p>{selected.seguradora || '—'}</p></div>
                    <div className="md-field"><label>Nº Assistência</label><p>{selected.num_assist || '—'}</p></div>
                    <div className="md-field"><label>Data</label><p>{fmtDate(selected.data_chegada)}</p></div>
                    <div className="md-field"><label>Horários</label><p>{selected.hora_chegada || '—'} → {selected.hora_saida || '—'}</p></div>
                    <div className="md-field span-2"><label>Serviço</label><p>{selected.servico || '—'}</p></div>
                  </div>
                ) : (
                  <div className="md-grid">
                    <div className="md-field"><label>Seguradora</label><input className="inline-input" value={atendForm.seguradora} onChange={e => setAtendForm(p=>({...p, seguradora: e.target.value}))} /></div>
                    <div className="md-field"><label>Nº Assistência</label><input className="inline-input" value={atendForm.num_assist} onChange={e => setAtendForm(p=>({...p, num_assist: e.target.value}))} /></div>
                    <div className="md-field"><label>Data (DD/MM/AAAA)</label><input className="inline-input" placeholder="DD/MM/AAAA" value={atendForm.data_chegada} onChange={e => setAtendForm(p=>({...p, data_chegada: e.target.value}))} /></div>
                    <div className="md-field"><label>Hora chegada</label><input className="inline-input" placeholder="08:00" value={atendForm.hora_chegada} onChange={e => setAtendForm(p=>({...p, hora_chegada: e.target.value}))} /></div>
                    <div className="md-field"><label>Hora saída</label><input className="inline-input" placeholder="12:00" value={atendForm.hora_saida} onChange={e => setAtendForm(p=>({...p, hora_saida: e.target.value}))} /></div>
                    <div className="md-field"><label>Serviço</label><input className="inline-input" value={atendForm.servico} onChange={e => setAtendForm(p=>({...p, servico: e.target.value}))} /></div>
                  </div>
                )}
              </div>

              <div className="md-section">
                <h3>👤 Segurado</h3>
                {!editAtend ? (
                  <div className="md-grid">
                    <div className="md-field"><label>Nome</label><p>{selected.nome_segurado || '—'}</p></div>
                    <div className="md-field"><label>Telefone</label><p>{selected.tel_segurado || '—'}</p></div>
                    <div className="md-field"><label>Endereço</label><p>{selected.endereco ? `${selected.endereco}${selected.numero ? `, ${selected.numero}` : ''}` : '—'}</p></div>
                    <div className="md-field"><label>Cidade</label><p>{selected.cidade || '—'}</p></div>
                  </div>
                ) : (
                  <div className="md-grid">
                    <div className="md-field"><label>Nome</label><input className="inline-input" value={atendForm.nome_segurado} onChange={e => setAtendForm(p=>({...p, nome_segurado: e.target.value}))} /></div>
                    <div className="md-field"><label>Telefone</label><input className="inline-input" value={atendForm.tel_segurado} onChange={e => setAtendForm(p=>({...p, tel_segurado: e.target.value}))} /></div>
                    <div className="md-field"><label>Endereço</label><input className="inline-input" value={atendForm.endereco} onChange={e => setAtendForm(p=>({...p, endereco: e.target.value}))} /></div>
                    <div className="md-field"><label>Número</label><input className="inline-input" value={atendForm.numero} onChange={e => setAtendForm(p=>({...p, numero: e.target.value}))} /></div>
                    <div className="md-field"><label>Bairro</label><input className="inline-input" value={atendForm.bairro} onChange={e => setAtendForm(p=>({...p, bairro: e.target.value}))} /></div>
                    <div className="md-field"><label>Cidade</label><input className="inline-input" value={atendForm.cidade} onChange={e => setAtendForm(p=>({...p, cidade: e.target.value}))} /></div>
                    <div className="md-field"><label>CEP</label><input className="inline-input" value={atendForm.cep} onChange={e => setAtendForm(p=>({...p, cep: e.target.value}))} /></div>
                  </div>
                )}
              </div>

              {(editAtend || selected.desc_problema || selected.desc_servico) && (
                <div className="md-section">
                  <h3>📝 Descrições</h3>
                  <div className="md-grid col-1">
                    {editAtend
                      ? <div className="md-field"><label>Descrição do Problema</label><textarea className="inline-input" rows={3} style={{ resize:'vertical', width:'100%' }} value={atendForm.desc_problema} onChange={e => setAtendForm(p=>({...p, desc_problema: e.target.value}))} placeholder="Descreva o problema..." /></div>
                      : (selected.desc_problema && <div className="md-field"><label>Descrição do Problema</label><div className="md-text">{selected.desc_problema}</div></div>)
                    }
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

              {selected.resultado_visita && (
                <div className="md-section">
                  <h3>📍 Resultado da Visita</h3>
                  <div className="md-grid">
                    <div className="md-field">
                      <label>Resultado</label>
                      <p>
                        {selected.resultado_visita === 'concluido'       && '✅ Serviço Concluído'}
                        {selected.resultado_visita === 'ficou_visita'    && '🔄 Ficou na Visita'}
                        {selected.resultado_visita === 'cliente_ausente' && '🚪 Cliente Ausente'}
                      </p>
                    </div>
                    {selected.data_retorno && (
                      <div className="md-field">
                        <label>Data Prevista Retorno</label>
                        <p>{fmtDate(selected.data_retorno)}</p>
                      </div>
                    )}
                    {selected.ficou_pendente && (
                      <div className="md-field span-2">
                        <label>O que ficou pendente</label>
                        <div className="md-text">{selected.ficou_pendente}</div>
                      </div>
                    )}
                    {selected.motivo_retorno && (
                      <div className="md-field">
                        <label>Motivo do Retorno</label>
                        <p>{{
                          aguardando_peca:      '⚙️ Aguardando Peça',
                          aprovacao_cliente:    '👤 Aprovação do Cliente',
                          aprovacao_seguradora: '🏢 Aprovação da Seguradora',
                          outro: `📝 ${selected.motivo_outro || 'Outro'}`,
                        }[selected.motivo_retorno]}</p>
                      </div>
                    )}
                    {selected.tentativa_contato && (
                      <div className="md-field span-2">
                        <label>Tentativa de Contato</label>
                        <div className="md-text">{selected.tentativa_contato}</div>
                      </div>
                    )}
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

              {/* Anotações internas — visível só pelo admin, não vai ao PDF nem PNG */}
              <div className="md-section" style={{ background: '#fffbf0', border: '1.5px solid #f0d080', borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <h3 style={{ color: '#8a6a00', margin: 0 }}>📝 Anotações Internas</h3>
                  <span style={{ fontSize: '.72rem', color: '#aaa', fontWeight: 600 }}>🔒 Só você vê isso</span>
                </div>
                <textarea
                  rows={4}
                  value={anotacaoInterna}
                  onChange={e => setAnotacaoInterna(e.target.value)}
                  placeholder="Anotações internas, observações, lembretes... Visível apenas para você."
                  style={{
                    width: '100%', resize: 'none', border: '1.5px solid #f0d080',
                    borderRadius: 6, padding: '9px 12px', fontSize: '.88rem',
                    fontFamily: 'Barlow,sans-serif', background: '#fffdf5',
                    color: 'var(--text)', outline: 'none', lineHeight: 1.55,
                  }}
                />
                <div style={{ marginTop: 10, textAlign: 'right' }}>
                  <button className="btn-sm btn-ok" disabled={savingAnotacao} onClick={saveAnotacao}>
                    {savingAnotacao ? '⏳ Salvando...' : '💾 Salvar Anotação'}
                  </button>
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

              {selected.status_historico?.length > 0 && (
                <div className="md-section" style={{ background: '#f8f9fb', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
                  <h3 style={{ color: 'var(--text)', marginBottom: 10 }}>🕐 Histórico de Status</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[...selected.status_historico].reverse().map((h, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{
                          display: 'inline-block', width: 10, height: 10, borderRadius: '50%', marginTop: 4, flexShrink: 0,
                          background: STATUS_META[h.para]?.dot || '#999',
                        }} />
                        <div style={{ lineHeight: 1.4 }}>
                          <span style={{ fontWeight: 700, fontSize: '.85rem' }}>
                            {STATUS_META[h.para]?.label || h.para}
                          </span>
                          {h.de && <span style={{ fontSize: '.78rem', color: 'var(--muted)' }}> ← {STATUS_META[h.de]?.label || h.de}</span>}
                          <br />
                          <span style={{ fontSize: '.75rem', color: 'var(--muted)' }}>
                            {h.por} · {new Date(h.quando).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    ))}
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
              {(selected.status === 'concluido' || selected.status === 'pendente' || !selected.status) && (
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

      {/* ══ MODAL: NOVO ORÇAMENTO (3 etapas) ══ */}
      {showNovoOrc && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowNovoOrc(false)}>
          <div className="modal-box" style={{ maxWidth: 680 }}>
            <div className="modal-header">
              <h2>📄 Novo Orçamento</h2>
              <button className="btn-sm" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={() => setShowNovoOrc(false)}>✕</button>
            </div>
            <div className="modal-body">

              {/* Navegador de etapas */}
              <div className="etapas-nav">
                {['Tipo', 'Cliente', 'Condições'].map((lbl, idx) => (
                  <div key={idx} className={`etapa-step ${orcEtapa === idx+1 ? 'ativa' : orcEtapa > idx+1 ? 'concluida' : ''}`}>
                    {orcEtapa > idx+1 ? '✓ ' : `${idx+1}. `}{lbl}
                  </div>
                ))}
              </div>

              {/* ── ETAPA 1 ── */}
              {orcEtapa === 1 && (
                <>
                  <p style={{ fontSize:'.82rem', color:'var(--muted)', marginBottom:14 }}>Selecione o tipo de atendimento:</p>
                  <div className="tipo-selector">
                    {[
                      { v:'linha_branca', icon:'🏠', label:'Linha Branca / Marrom' },
                      { v:'emergencial',  icon:'⚡', label:'Emergencial'           },
                      { v:'particular',   icon:'👤', label:'Particular'            },
                    ].map(op => (
                      <div
                        key={op.v}
                        className={`tipo-card${orcForm.tipo === op.v ? ' selected' : ''}`}
                        onClick={() => { setOrcForm(p => ({ ...p, tipo: op.v, cenario: op.v === 'particular' ? 'particular' : '' })); setOrcErrors(p => ({ ...p, tipo: false })) }}
                      >
                        <div className="tipo-icon">{op.icon}</div>
                        <div className="tipo-label">{op.label}</div>
                      </div>
                    ))}
                  </div>
                  {orcErrors.tipo && <div className="err-msg">Selecione um tipo</div>}

                  {orcForm.tipo && orcForm.tipo !== 'particular' && (
                    <>
                      <p style={{ fontSize:'.82rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.5px', margin:'16px 0 8px' }}>Cenário</p>
                      <div className="cenario-group">
                        {[
                          { v:'seguradora_cobre_tudo', label:'Seguradora cobre tudo',             desc:'Todos os custos são da seguradora' },
                          { v:'material_cliente',      label:'Material por conta do cliente',      desc:'Serviço coberto, peças não' },
                          { v:'fora_contrato',         label:'Fora do contrato da seguradora',     desc:'Cliente paga tudo, mas há vinculação' },
                        ].map(op => (
                          <div
                            key={op.v}
                            className={`cenario-item${orcForm.cenario === op.v ? ' selected' : ''}`}
                            onClick={() => setOrcForm(p => ({ ...p, cenario: op.v }))}
                          >
                            <div className="rdot"><div className={`rdot-i${orcForm.cenario === op.v ? '' : ' hidden'}`} style={{ display: orcForm.cenario === op.v ? 'block' : 'none' }} /></div>
                            <div>
                              <div className="cenario-label">{op.label}</div>
                              <div className="cenario-desc">{op.desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="os-grid" style={{ marginTop: 16 }}>
                        <div className="field">
                          <label>Seguradora</label>
                          <select value={orcForm.seguradora} onChange={e => setOrcForm(p => ({ ...p, seguradora: e.target.value }))}>
                            <option value="">Selecione...</option>
                            {seguradoras.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div className="field">
                          <label>Nº Assistência</label>
                          <input value={orcForm.num_assist} onChange={e => setOrcForm(p => ({ ...p, num_assist: e.target.value }))} placeholder="Código da assistência" />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ── ETAPA 2 ── */}
              {orcEtapa === 2 && (
                <>
                  <p style={{ fontSize:'.82rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:14 }}>Dados do cliente</p>
                  <div className="os-grid">
                    <div className={`field${orcErrors.nome_cliente ? ' error' : ''}`}>
                      <label>Nome <span className="req">*</span></label>
                      <input className={orcErrors.nome_cliente ? 'error' : ''} value={orcForm.nome_cliente} onChange={e => { setOrcForm(p => ({ ...p, nome_cliente: e.target.value })); setOrcErrors(p => ({ ...p, nome_cliente: false })) }} />
                    </div>
                    <div className="field">
                      <label>Telefone <span className="req">*</span></label>
                      <input className={orcErrors.tel_cliente ? 'error' : ''} value={orcForm.tel_cliente} onChange={e => { setOrcForm(p => ({ ...p, tel_cliente: maskPhone(e.target.value) })); setOrcErrors(p => ({ ...p, tel_cliente: false })) }} placeholder="(XX) XXXXX-XXXX" />
                    </div>
                    <div className="field os-span2">
                      <label>E-mail (opcional)</label>
                      <input type="email" value={orcForm.email_cliente} onChange={e => setOrcForm(p => ({ ...p, email_cliente: e.target.value }))} placeholder="cliente@email.com" />
                    </div>
                    <div className="field os-span2">
                      <label>Endereço <span className="req">*</span></label>
                      <input className={orcErrors.endereco ? 'error' : ''} value={orcForm.endereco} onChange={e => { setOrcForm(p => ({ ...p, endereco: e.target.value })); setOrcErrors(p => ({ ...p, endereco: false })) }} placeholder="Rua, número, bairro" />
                    </div>
                    <div className="field os-span2">
                      <label>Cidade <span className="req">*</span></label>
                      <input className={orcErrors.cidade ? 'error' : ''} value={orcForm.cidade} onChange={e => { setOrcForm(p => ({ ...p, cidade: e.target.value })); setOrcErrors(p => ({ ...p, cidade: false })) }} placeholder="Cidade - UF" />
                    </div>
                  </div>

                  {orcForm.tipo === 'linha_branca' && (
                    <>
                      <p style={{ fontSize:'.82rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.5px', margin:'16px 0 10px' }}>Equipamento</p>
                      <div className="os-grid">
                        <div className="field">
                          <label>Tipo <span className="req">*</span></label>
                          <select className={orcErrors.tipo_equipamento ? 'error' : ''} value={orcForm.tipo_equipamento} onChange={e => { setOrcForm(p => ({ ...p, tipo_equipamento: e.target.value })); setOrcErrors(p => ({ ...p, tipo_equipamento: false })) }}>
                            <option value="">Selecione...</option>
                            {['Refrigerador','Fogão','Máquina de Lavar','Lava-louça','TV','Microondas','Ar Condicionado','Outro'].map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div className="field os-span2">
                          <label>Defeito relatado <span className="req">*</span></label>
                          <textarea rows={2} className={orcErrors.defeito ? 'error' : ''} value={orcForm.defeito} onChange={e => { setOrcForm(p => ({ ...p, defeito: e.target.value })); setOrcErrors(p => ({ ...p, defeito: false })) }} placeholder="Descreva o defeito relatado pelo cliente..." />
                        </div>
                      </div>
                      <div className="info-tecnico-note">
                        ℹ️ Marca, modelo, voltagem e número de série serão preenchidos pelo técnico no local.
                      </div>
                    </>
                  )}

                  {orcForm.tipo === 'emergencial' && (
                    <>
                      <p style={{ fontSize:'.82rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.5px', margin:'16px 0 10px' }}>Tipo de emergência</p>
                      <div className="os-grid">
                        <div className="field">
                          <label>Tipo <span className="req">*</span></label>
                          <select className={orcErrors.tipo_emergencia ? 'error' : ''} value={orcForm.tipo_emergencia} onChange={e => { setOrcForm(p => ({ ...p, tipo_emergencia: e.target.value })); setOrcErrors(p => ({ ...p, tipo_emergencia: false })) }}>
                            <option value="">Selecione...</option>
                            {['Hidráulico','Elétrico','Chaveiro','Vidro','Estrutural','Outro'].map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div className="field os-span2">
                          <label>Descrição <span className="req">*</span></label>
                          <textarea rows={2} className={orcErrors.desc_problema ? 'error' : ''} value={orcForm.desc_problema} onChange={e => { setOrcForm(p => ({ ...p, desc_problema: e.target.value })); setOrcErrors(p => ({ ...p, desc_problema: false })) }} placeholder="Descreva o problema..." />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ── ETAPA 3 ── */}
              {orcEtapa === 3 && (
                <>
                  <div className="os-grid">
                    <div className="field">
                      <label>Validade do orçamento</label>
                      <input type="date" value={orcForm.validade} onChange={e => setOrcForm(p => ({ ...p, validade: e.target.value }))} min={new Date().toISOString().slice(0,10)} />
                    </div>
                    <div className="field">
                      <label>Garantia</label>
                      <select value={orcForm.garantia} onChange={e => setOrcForm(p => ({ ...p, garantia: e.target.value }))}>
                        {['90 dias','6 meses','1 ano','Sem garantia'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="field os-span2">
                      <label>Observações</label>
                      <textarea rows={2} value={orcForm.observacoes} onChange={e => setOrcForm(p => ({ ...p, observacoes: e.target.value }))} placeholder="Observações adicionais..." />
                    </div>
                  </div>
                  <div className="info-tecnico-note" style={{ marginTop:12 }}>
                    ℹ️ Prazo de execução e forma de pagamento serão definidos pelo técnico no local.
                  </div>

                  <div className="md-section" style={{ marginTop:16 }}>
                    <h3>👷 Técnico Responsável</h3>
                    <div className="field">
                      <label>Selecionar técnico (opcional)</label>
                      <select value={orcForm.tecnico_id} onChange={e => setOrcForm(p => ({ ...p, tecnico_id: e.target.value }))}>
                        <option value="">Sem técnico definido</option>
                        {tecnicosAtivos.map(t => <option key={t.id} value={t.id}>{t.nome} — {t.telefone}</option>)}
                      </select>
                    </div>
                    <p style={{ fontSize:'.8rem', color:'var(--muted)', marginTop:8 }}>
                      💡 Ao salvar, um link será gerado para o técnico preencher o diagnóstico e os valores no local.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              {orcEtapa > 1 && (
                <button className="btn-sm" style={{ background:'var(--light)', color:'var(--muted)', border:'1px solid var(--border)', marginRight:'auto' }}
                  onClick={() => setOrcEtapa(p => p - 1)}>← Voltar</button>
              )}
              <button className="btn-sm" style={{ background:'var(--light)', color:'var(--muted)', border:'1px solid var(--border)' }}
                onClick={() => setShowNovoOrc(false)}>Cancelar</button>
              {orcEtapa < 3
                ? (
                  <button className="btn-primary" style={{ padding:'9px 22px', fontSize:'.9rem' }}
                    onClick={() => {
                      if (orcEtapa === 1 && !orcForm.tipo) { setOrcErrors({ tipo: true }); return }
                      if (orcEtapa === 2) {
                        const e = {}
                        if (!orcForm.nome_cliente?.trim()) e.nome_cliente = true
                        if (!orcForm.tel_cliente?.trim())  e.tel_cliente  = true
                        if (!orcForm.endereco?.trim())     e.endereco     = true
                        if (!orcForm.cidade?.trim())       e.cidade       = true
                        if (Object.keys(e).length) { setOrcErrors(e); return }
                      }
                      setOrcEtapa(p => p + 1)
                    }}>
                    Próximo →
                  </button>
                )
                : (
                  <button className="btn-primary" onClick={saveNovoOrcamento} disabled={savingOrc} style={{ padding:'9px 22px', fontSize:'.9rem' }}>
                    {savingOrc ? '⏳ Salvando...' : '💾 Criar Orçamento'}
                  </button>
                )
              }
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: LINKS GERADOS (orçamento) ══ */}
      {orcLinks && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOrcLinks(null)}>
          <div className="modal-box" style={{ maxWidth: 520 }}>
            <div className="modal-header" style={{ background:'#1e6e3e' }}>
              <h2>✅ Orçamento {orcLinks.numero} criado!</h2>
              <button className="btn-sm" style={{ background:'rgba(255,255,255,.15)', color:'#fff' }} onClick={() => setOrcLinks(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="orc-link-section">
                <h4>👷 Link do Técnico</h4>
                <p>Para o técnico preencher o diagnóstico e os valores no local</p>
                <div className="link-box"><span className="link-text">{orcLinks.tecnico}</span></div>
                <div style={{ display:'flex', gap:10, marginTop:12, flexWrap:'wrap' }}>
                  <button className={`btn-copy${orcLinkCopied ? ' copied' : ''}`} onClick={() => copyOrcLink(orcLinks.tecnico)}>
                    {orcLinkCopied ? '✅ Copiado!' : '📋 Copiar'}
                  </button>
                  {orcLinks.tecnicoTel && (
                    <a className="btn-whatsapp" target="_blank" rel="noopener noreferrer"
                      href={`https://wa.me/55${orcLinks.tecnicoTel.replace(/\D/g,'')}?text=${encodeURIComponent(`Olá ${orcLinks.tecnicoNome || 'Técnico'}! 👷\nVocê tem um novo orçamento para avaliar no local.\n\nAcesse o link para preencher o diagnóstico e os valores:\n🔗 ${orcLinks.tecnico}`)}`}>
                      📲 WhatsApp Técnico
                    </a>
                  )}
                  {!orcLinks.tecnicoTel && (
                    <a className="btn-whatsapp" target="_blank" rel="noopener noreferrer"
                      href={`https://wa.me/?text=${encodeURIComponent(`Novo orçamento para preencher:\n🔗 ${orcLinks.tecnico}`)}`}>
                      📲 Enviar pelo WhatsApp
                    </a>
                  )}
                </div>
              </div>
              <div className="orc-link-aviso">
                ⚠️ O link do cliente só ficará disponível após o técnico preencher e você revisar o orçamento.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-sm" style={{ background:'var(--light)', color:'var(--muted)', border:'1px solid var(--border)' }}
                onClick={() => setOrcLinks(null)}>Fechar</button>
              <button className="btn-sm btn-view"
                onClick={() => { setOrcLinks(null); setAbaAtiva('orcamentos') }}>
                📋 Ver na lista
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: REVISAR ORÇAMENTO ══ */}
      {showRevisarOrc && revisarOrc && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowRevisarOrc(false)}>
          <div className="modal-box" style={{ maxWidth:760 }}>
            <div className="modal-header">
              <h2>{revisarOrc.status === 'em_revisao' ? '✏️ Revisão' : '👁️ Orçamento'} — {revisarOrc.numero}</h2>
              <div className="modal-header-btns">
                <span className={`badge ${STATUS_ORC_META[revisarOrc.status]?.cls || 'orc-aguardando'}`}>
                  {STATUS_ORC_META[revisarOrc.status]?.label || ''}
                </span>
                {revisarOrc.status === 'aprovado' && !revisarOrc.os_vinculada && (
                  <button className="btn-sm btn-ok" onClick={() => abrirConverterOS(revisarOrc)}>🚀 Converter em OS</button>
                )}
                {(revisarOrc.status === 'aprovado' || revisarOrc.status === 'executado') && (
                  <button className="btn-sm btn-pdf" onClick={() => handlePDFCliente(revisarOrc)}>📄 PDF Cliente</button>
                )}
                {revisarOrc.total_seguradora > 0 && (
                  <button className="btn-sm btn-pdf" style={{ background:'#6c3483' }} onClick={() => handlePDFSeguradora(revisarOrc)}>📋 PDF Seg.</button>
                )}
                <button className="btn-sm" style={{ background:'rgba(255,255,255,.15)', color:'#fff' }} onClick={() => setShowRevisarOrc(false)}>✕</button>
              </div>
            </div>
            <div className="modal-body">

              {/* Banner aprovado */}
              {revisarOrc.status === 'aguardando_tecnico' && (
                <div className="link-tecnico-box">
                  <div className="ltb-title">👷 Link do Técnico</div>
                  <div className="ltb-url">{buildLinkTecnicoOrc(revisarOrc.id)}</div>
                  <div className="ltb-btns">
                    <button className="btn-copy" onClick={() => copyOrcLink(buildLinkTecnicoOrc(revisarOrc.id))}>
                      {orcLinkCopied ? '✅ Copiado!' : '📋 Copiar link'}
                    </button>
                    {revisarOrc.tecnico_tel && (
                      <a className="btn-whatsapp" target="_blank" rel="noopener noreferrer"
                        href={`https://wa.me/55${revisarOrc.tecnico_tel.replace(/\D/g,'')}?text=${encodeURIComponent(`Olá ${revisarOrc.tecnico_nome||'Técnico'}! 👷\nNovo orçamento para avaliar no local:\n🔗 ${buildLinkTecnicoOrc(revisarOrc.id)}`)}`}>
                        📲 WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              )}

              {revisarOrc.status === 'aprovado' && (
                <div className="orc-aprovado-banner">
                  <h3>🎉 Aprovado por {revisarOrc.aprovado_por}!</h3>
                  <p>Assinado em: {fmtDate(revisarOrc.aprovado_em)}</p>
                </div>
              )}

              {/* Dados do cliente */}
              <div className="md-section">
                <h3>👤 Cliente</h3>
                <div className="md-grid">
                  <div className="md-field"><label>Nome</label><p>{revisarOrc.nome_cliente || '—'}</p></div>
                  <div className="md-field"><label>Telefone</label><p>{revisarOrc.tel_cliente || '—'}</p></div>
                  <div className="md-field"><label>Endereço</label><p>{revisarOrc.endereco || '—'}</p></div>
                  <div className="md-field"><label>Cidade</label><p>{revisarOrc.cidade || '—'}</p></div>
                </div>
              </div>

              {/* Diagnóstico do técnico */}
              {revisarOrc.diagnostico && (
                <div className="md-section">
                  <h3>🔍 Diagnóstico do Técnico</h3>
                  <div className="md-text">{revisarOrc.diagnostico}</div>
                </div>
              )}

              {/* Itens (editável se em_revisao) */}
              <div className="md-section">
                <h3>📋 Itens</h3>
                <div style={{ overflowX:'auto' }}>
                  <table className="itens-table">
                    <thead>
                      <tr>
                        <th style={{ width:'44%' }}>Descrição</th>
                        <th style={{ width:'9%' }}>Qtd</th>
                        <th style={{ width:'17%' }}>Vlr Unit.</th>
                        <th style={{ width:'17%' }}>Total</th>
                        {revisarOrc.status === 'em_revisao' && <th style={{ width:'8%' }}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {revisarItens.map(it => (
                        <tr key={it.id}>
                          <td>
                            {revisarOrc.status === 'em_revisao'
                              ? <input type="text" value={it.descricao} onChange={e => updateItemRevisar(it.id, 'descricao', e.target.value)} placeholder="Descrição" />
                              : it.descricao}
                          </td>
                          <td>
                            {revisarOrc.status === 'em_revisao'
                              ? <input type="number" min="1" style={{ width:60 }} value={it.quantidade} onChange={e => updateItemRevisar(it.id, 'quantidade', e.target.value)} />
                              : it.quantidade}
                          </td>
                          <td>
                            {revisarOrc.status === 'em_revisao'
                              ? <input type="text" inputMode="decimal" value={it.valor_unit} onChange={e => updateItemRevisar(it.id, 'valor_unit', e.target.value)} placeholder="0,00" />
                              : fmtBRL(it.valor_unit)}
                          </td>
                          <td style={{ fontWeight:700 }}>{fmtBRL(it.valor_total || (parseFloat(it.valor_unit)||0) * (parseInt(it.quantidade)||1))}</td>
                          {revisarOrc.status === 'em_revisao' && (
                            <td><button className="btn-remove-item" onClick={() => removeItemRevisar(it.id)}>✕</button></td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {revisarOrc.status === 'em_revisao' && (
                  <button className="btn-add-item" onClick={addItemRevisar}>＋ Adicionar item</button>
                )}

                <div className="orc-subtotal">
                  Total: {fmtBRL(revisarItens.reduce((acc,it) => acc + (parseFloat(it.valor_total) || parseFloat(it.valor_unit)||0 * parseInt(it.quantidade)||1), 0))}
                </div>
              </div>

              {/* Divisão seguradora/cliente (se cenario != particular) */}
              {revisarOrc.status === 'em_revisao' && revisarOrc.cenario && revisarOrc.cenario !== 'particular' && revisarItens.length > 0 && (
                <div className="md-section">
                  <h3>💰 Divisão de Responsabilidade</h3>
                  <div style={{ overflowX:'auto' }}>
                    <table className="divisao-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Seguradora</th>
                          <th>Cliente</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revisarItens.map(it => (
                          <tr key={it.id}>
                            <td style={{ fontSize:'.88rem' }}>{it.descricao || '—'}</td>
                            <td>
                              <input
                                type="text" inputMode="decimal"
                                value={it.paga_seguradora}
                                onChange={e => {
                                  const val = parseFloat(String(e.target.value).replace(',','.')) || 0
                                  const total = parseFloat(it.valor_total) || 0
                                  updateItemRevisar(it.id, 'paga_seguradora', val)
                                  setRevisarItens(prev => prev.map(i => i.id === it.id ? { ...i, paga_seguradora: val, paga_cliente: Math.max(0, total - val) } : i))
                                }}
                                placeholder="0,00"
                              />
                            </td>
                            <td>
                              <input type="text" inputMode="decimal"
                                value={it.paga_cliente}
                                onChange={e => {
                                  const val = parseFloat(String(e.target.value).replace(',','.')) || 0
                                  const total = parseFloat(it.valor_total) || 0
                                  setRevisarItens(prev => prev.map(i => i.id === it.id ? { ...i, paga_cliente: val, paga_seguradora: Math.max(0, total - val) } : i))
                                }}
                                placeholder="0,00"
                              />
                            </td>
                          </tr>
                        ))}
                        <tr className="totais-row">
                          <td style={{ fontWeight:800 }}>TOTAIS</td>
                          <td style={{ fontWeight:800 }}>{fmtBRL(revisarItens.reduce((acc,it) => acc + (parseFloat(it.paga_seguradora)||0), 0))}</td>
                          <td style={{ fontWeight:800 }}>{fmtBRL(revisarItens.reduce((acc,it) => acc + (parseFloat(it.paga_cliente)||0), 0))}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Condições */}
              <div className="md-section">
                <h3>📋 Condições</h3>
                <div className="md-grid">
                  <div className="md-field"><label>Garantia</label><p>{revisarOrc.garantia || '—'}</p></div>
                  <div className="md-field"><label>Prazo</label><p>{revisarOrc.prazo_execucao || '—'}</p></div>
                  <div className="md-field"><label>Pagamento</label><p>{revisarOrc.forma_pagamento || '—'}</p></div>
                  <div className="md-field"><label>Válido até</label><p>{fmtDate(revisarOrc.validade)}</p></div>
                </div>
              </div>

              {/* Nota de garantia (editável) */}
              {revisarOrc.status === 'em_revisao' && (
                <div className="md-section">
                  <h3>📝 Nota de Garantia</h3>
                  <div className="field">
                    <label>Texto que aparecerá no PDF para o cliente</label>
                    <textarea rows={3} value={orcGarantiaObs} onChange={e => setOrcGarantiaObs(e.target.value)}
                      placeholder="A garantia é válida somente para peças e materiais fornecidos por nossa empresa..." />
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-sm" style={{ background:'var(--light)', color:'var(--muted)', border:'1px solid var(--border)' }}
                onClick={() => setShowRevisarOrc(false)}>Fechar</button>
              {revisarOrc.status === 'em_revisao' && (
                <>
                  <button className="btn-sm btn-view" onClick={saveRevisarOrcamento} disabled={savingRevisar}>
                    {savingRevisar ? '⏳...' : '💾 Salvar'}
                  </button>
                  <button className="btn-sm btn-ok" onClick={() => enviarLinkCliente(revisarOrc)}>
                    📲 Enviar ao Cliente
                  </button>
                  <button className="btn-sm btn-pdf" style={{ background:'#6c3483' }} onClick={() => handlePDFSeguradora(revisarOrc)}>
                    🖨️ PDF Seguradora
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: CONVERTER ORÇAMENTO EM OS ══ */}
      {showConverterOS && converterOrc && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowConverterOS(false)}>
          <div className="modal-box" style={{ maxWidth:520 }}>
            <div className="modal-header" style={{ background:'#1e7040' }}>
              <h2>🚀 Converter em OS</h2>
              <button className="btn-sm" style={{ background:'rgba(255,255,255,.15)', color:'#fff' }} onClick={() => setShowConverterOS(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="orc-aprovado-banner" style={{ marginBottom:16 }}>
                <h3>🎉 Orçamento aprovado por {converterOrc.aprovado_por}!</h3>
                <p>Assinado em: {fmtDate(converterOrc.aprovado_em)}</p>
              </div>
              <p style={{ fontSize:'.88rem', color:'var(--muted)', marginBottom:16 }}>
                Os dados abaixo serão pré-preenchidos na Ordem de Serviço:
              </p>

              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                {[
                  { l:'Nome',      v: converterOrc.nome_cliente },
                  { l:'Telefone',  v: converterOrc.tel_cliente  },
                  { l:'Endereço',  v: converterOrc.endereco     },
                  { l:'Cidade',    v: converterOrc.cidade       },
                  { l:'Serviço',   v: converterOrc.tipo === 'linha_branca'
                      ? `${converterOrc.tipo_equipamento||''} ${converterOrc.marca||''} + manutenção`.trim()
                      : converterOrc.tipo_emergencia || converterOrc.tipo || '—' },
                ].map((f,i) => (
                  <div key={i} style={{ display:'flex', gap:12, padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:'.88rem' }}>
                    <span style={{ color:'var(--muted)', minWidth:80 }}>{f.l}</span>
                    <span style={{ fontWeight:600 }}>{f.v || '—'} ✅</span>
                  </div>
                ))}
              </div>

              {converterOrc.tipo !== 'particular' && (
                <div className="os-grid">
                  <div className="field">
                    <label>Seguradora</label>
                    <input defaultValue={converterOrc.seguradora || ''} readOnly className="locked" />
                  </div>
                  <div className="field">
                    <label>Nº Assistência</label>
                    <input defaultValue={converterOrc.num_assist || ''} readOnly className="locked" />
                  </div>
                </div>
              )}

              <div className="os-callout" style={{ marginTop:12 }}>
                💡 A OS será criada como "Pendente" e ficará disponível no painel para acompanhamento.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-sm" style={{ background:'var(--light)', color:'var(--muted)', border:'1px solid var(--border)' }}
                onClick={() => setShowConverterOS(false)}>Cancelar</button>
              <button className="btn-primary" onClick={() => converterEmOS(converterOrc)} disabled={savingOrc} style={{ padding:'9px 22px', fontSize:'.9rem' }}>
                {savingOrc ? '⏳ Criando...' : '🚀 Criar OS Agora'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </AdminContext.Provider>
  )
}
