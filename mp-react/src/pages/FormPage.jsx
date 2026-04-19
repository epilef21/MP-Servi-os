// ============================================================
// FORM PAGE — Formulário público do técnico (multi-tenant)
// Acessível em /:slug — detecta empresa pelo slug da URL
// ============================================================
import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import SignatureCanvas from 'react-signature-canvas'
import {
  db, criarOS, atualizarOS,
  doc, serverTimestamp, uploadFoto,
} from '../firebase.js'
import { useEmpresa } from '../hooks/useEmpresa.js'

// ── Chave do rascunho inclui o slug para isolar por empresa ─
const getDraftKey = (slug) => `mp_form_draft_${slug}`

const CHECKUP_ITEMS = [
  { id: 'rev_eletrica',   label: '⚡ Rev. Elétrica',       quant: false },
  { id: 'rev_hidraulica', label: '💧 Rev. Hidráulica',      quant: false },
  { id: 'lub_fechaduras', label: '🔐 Lub. de Fechaduras',   quant: true  },
  { id: 'limp_caixas',    label: '📦 Limp. de Caixas',      quant: true  },
  { id: 'fix_objetos',    label: '🔧 Fix. de Objetos',      quant: true  },
  { id: 'limp_calhas',    label: '🏗️ Limp. de Calhas',      quant: true  },
  { id: 'troca_vidros',   label: '🪟 Troca de Vidros',      quant: true  },
  { id: 'troca_lampadas', label: '💡 Troca de Lâmpadas',    quant: true  },
  { id: 'olho_magico',    label: '👁️ Inst. Olho Mágico',    quant: false },
  { id: 'cacamba',        label: '🗑️ Caçamba',              quant: false },
]

const REQUIRED_FIELDS = [
  'seguradora', 'num_assist', 'data_chegada', 'servico',
  'nome_segurado', 'endereco', 'cidade', 'desc_problema', 'desc_servico',
]

const INITIAL = {
  seguradora: '', num_assist: '', data_chegada: '', hora_chegada: '',
  hora_saida: '', servico: '', nome_segurado: '', tel_segurado: '',
  cep: '', endereco: '', numero: '', cidade: '', desc_problema: '', avarias: '',
  desc_servico: '', pecas: '', problema_solucionado: '', especifique: '',
  havera_retorno: '', garantia: '', excedente: '',
  data_atend: '', tel_contato: '',
}

function sanitizePayload(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    out[k] = (v === undefined || v === null) ? '' : v
  }
  return out
}

// ── Componente principal ─────────────────────────────────────
export default function FormPage() {
  const [searchParams] = useSearchParams()

  // Dados da empresa detectados pelo slug na URL
  const { empresa, config, empresaId, slug, loading: loadingEmpresa, erro: erroEmpresa } = useEmpresa()

  // Seguradoras e personalização vindas da config da empresa
  const nomeEmpresa  = config?.nome     || empresa?.nome || 'Checklist'
  const telefoneRodape = config?.telefone || ''
  const corPrimaria  = config?.corPrimaria || '#1a3a5c'

  // ── Modo OS pré-preenchida (link do admin) ───────────────
  const osId       = searchParams.get('os') || null
  const isPrefilled = !!osId
  const LOCKED = isPrefilled
    ? ['seguradora', 'num_assist', 'nome_segurado', 'tel_segurado',
       'endereco', 'cidade', 'data_chegada', 'hora_chegada', 'servico', 'desc_problema']
    : []

  function buildFromParams() {
    if (!osId) return null
    return {
      seguradora:    searchParams.get('seguradora')    || '',
      num_assist:    searchParams.get('num_assist')    || '',
      nome_segurado: searchParams.get('nome_segurado') || '',
      tel_segurado:  searchParams.get('tel_segurado')  || '',
      endereco:      searchParams.get('endereco')      || '',
      cidade:        searchParams.get('cidade')        || '',
      data_chegada:  searchParams.get('data_chegada')  || '',
      hora_chegada:  searchParams.get('hora_chegada')  || '',
      servico:       searchParams.get('servico')       || '',
      desc_problema: searchParams.get('desc_problema') || '',
    }
  }

  // ── Estado do formulário ─────────────────────────────────
  const DRAFT_KEY = getDraftKey(slug || 'default')

  const [form, setForm] = useState(() => {
    if (osId) return { ...INITIAL, ...buildFromParams() }
    try {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (saved) return { ...INITIAL, ...JSON.parse(saved) }
    } catch {}
    return INITIAL
  })

  const [checkup,      setCheckup]      = useState({})
  const [errors,       setErrors]       = useState({})
  const [submitting,   setSubmitting]   = useState(false)
  const [submitted,    setSubmitted]    = useState(false)
  const [submitId,     setSubmitId]     = useState('')
  const [progress,     setProgress]     = useState(0)
  const [hasDraft,     setHasDraft]     = useState(false)
  const [isOnline,     setIsOnline]     = useState(navigator.onLine)

  // Fotos
  const [fotos,         setFotos]         = useState([])
  const [fotosUrls,     setFotosUrls]     = useState([])
  const [uploadingFoto, setUploadingFoto] = useState(false)

  // CEP
  const [cepLoading, setCepLoading] = useState(false)
  const enderecoRef = useRef(null)

  // Assinaturas
  const sigPrestRef = useRef(null)
  const sigSegRef   = useRef(null)
  const [hasSigPrest,  setHasSigPrest]  = useState(false)
  const [hasSigSeg,    setHasSigSeg]    = useState(false)
  const [sigPrestData, setSigPrestData] = useState('')
  const [sigSegData,   setSigSegData]   = useState('')

  // ── Aplica cor primária da empresa via CSS variable ──────
  useEffect(() => {
    if (corPrimaria) {
      document.documentElement.style.setProperty('--primary', corPrimaria)
    }
    return () => {
      document.documentElement.style.removeProperty('--primary')
    }
  }, [corPrimaria])

  // ── Online/offline ───────────────────────────────────────
  useEffect(() => {
    const on  = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  // ── Auto-save do rascunho (isolado por slug/empresa) ─────
  useEffect(() => {
    if (osId || !slug) return
    try {
      const isEmpty = REQUIRED_FIELDS.every(f => !form[f]?.trim())
      if (!isEmpty) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(form))
        setHasDraft(true)
      }
    } catch {}
  }, [form, osId, slug])

  // ── Verifica rascunho existente ──────────────────────────
  useEffect(() => {
    if (osId || !slug) return
    try {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (saved) setHasDraft(true)
    } catch {}
  }, [osId, slug])

  // ── Barra de progresso ───────────────────────────────────
  useEffect(() => {
    const filled = REQUIRED_FIELDS.filter(f => form[f]?.trim()).length
    setProgress(Math.round((filled / REQUIRED_FIELDS.length) * 100))
  }, [form])

  // ── Helpers de campo ─────────────────────────────────────
  function setField(k, v) {
    setForm(p => ({ ...p, [k]: v }))
    if (errors[k]) setErrors(p => ({ ...p, [k]: false }))
  }
  const isLocked = k => LOCKED.includes(k)

  function toggleCheckup(id) {
    setCheckup(p => ({ ...p, [id]: { checked: !p[id]?.checked, quant: p[id]?.quant || '' } }))
  }
  function setCheckupQuant(id, v) {
    setCheckup(p => ({ ...p, [id]: { ...p[id], quant: v } }))
  }

  // ── Busca CEP via ViaCEP ─────────────────────────────────
  async function handleCEPChange(e) {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 8)
    setField('cep', raw)
    if (raw.length !== 8) return
    setForm(p => ({ ...p, endereco: '', cidade: '' }))
    setCepLoading(true)
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${raw}/json/`)
      const data = await res.json()
      if (data.erro) { setCepLoading(false); return }
      const cidade = `${data.localidade} - ${data.uf}`
      if (data.logradouro && data.bairro) {
        setForm(p => ({ ...p, endereco: `${data.logradouro} - ${data.bairro}`, cidade }))
      } else {
        setForm(p => ({ ...p, cidade }))
        setTimeout(() => enderecoRef.current?.focus(), 50)
      }
    } catch { /* falha de rede: silencioso */ }
    finally { setCepLoading(false) }
  }

  // ── Fotos ────────────────────────────────────────────────
  function handleFotoSelect(e) {
    const files = Array.from(e.target.files)
    const newFotos = files.map(f => ({ file: f, preview: URL.createObjectURL(f) }))
    setFotos(p => [...p, ...newFotos])
    e.target.value = ''
  }
  function removeFoto(idx) {
    setFotos(p => {
      const n = [...p]
      URL.revokeObjectURL(n[idx].preview)
      n.splice(idx, 1)
      return n
    })
  }

  // ── Validação ────────────────────────────────────────────
  function validate() {
    const errs = {}
    REQUIRED_FIELDS.forEach(f => { if (!form[f]?.trim()) errs[f] = true })
    if (!hasSigPrest) errs.sig_prest = true
    if (!hasSigSeg)   errs.sig_seg   = true
    setErrors(errs)
    return !Object.keys(errs).length
  }

  // ── Submit ───────────────────────────────────────────────
  async function handleSubmit() {
    if (!validate()) {
      const el = document.querySelector('.error, .error-sig')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (!empresaId) {
      alert('Empresa não identificada. Tente recarregar a página.')
      return
    }

    setSubmitting(true)

    // Upload das fotos para a pasta da empresa no Storage
    let photoUrls = [...fotosUrls]
    if (fotos.length > 0) {
      setUploadingFoto(true)
      const tempId = osId || `temp_${Date.now()}`
      try {
        const timeout  = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))
        // uploadFoto agora recebe empresaId para isolar no Storage
        const uploaded = await Promise.race([
          Promise.all(fotos.map(f => uploadFoto(f.file, empresaId, tempId))),
          timeout,
        ])
        photoUrls = [...photoUrls, ...uploaded]
      } catch (e) {
        console.warn('Foto upload falhou, continuando sem fotos:', e.message)
      }
      setUploadingFoto(false)
    }

    const checkupList = CHECKUP_ITEMS
      .filter(i => checkup[i.id]?.checked)
      .map(i => ({ item: i.label, quant: checkup[i.id]?.quant || '' }))

    const base = sanitizePayload({
      ...form,
      endereco:             form.endereco + (form.numero ? ', ' + form.numero : ''),
      checkup:              checkupList,
      fotos:                photoUrls,
      assinatura_prestador: sigPrestData,
      assinatura_segurado:  sigSegData,
      status:               'pendente',
    })

    try {
      let id
      if (osId) {
        // Atualiza OS existente da empresa (modo pré-preenchido)
        await atualizarOS(empresaId, osId, {
          ...base,
          status:        'pendente',
          finalizado_em: serverTimestamp(),
        })
        id = osId
      } else {
        // Cria nova OS na subcoleção da empresa
        const ref = await criarOS(empresaId, {
          ...base,
          finalizado_em: serverTimestamp(),
        })
        id = ref.id
      }

      localStorage.removeItem(DRAFT_KEY)
      setSubmitId(id.slice(0, 8).toUpperCase())
      setSubmitted(true)
    } catch (err) {
      console.error(err)
      alert('Erro ao enviar. Verifique sua conexão e tente novamente.\n' + err.message)
      setSubmitting(false)
    }
  }

  // ── Descarta rascunho ────────────────────────────────────
  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY)
    setForm(INITIAL)
    setHasDraft(false)
  }

  // ── Reset após envio ─────────────────────────────────────
  function reset() {
    setForm(INITIAL); setCheckup({}); setFotos([]); setFotosUrls([])
    setSubmitted(false); setSubmitting(false); setProgress(0)
    setHasSigPrest(false); setHasSigSeg(false)
    setSigPrestData(''); setSigSegData('')
    sigPrestRef.current?.clear(); sigSegRef.current?.clear()
  }

  // ── Tela de carregamento da empresa ─────────────────────
  if (loadingEmpresa) {
    return (
      <div className="loading-state" style={{ paddingTop: '30vh' }}>
        <div className="spinner" />
        <p className="loading-text">Carregando formulário...</p>
      </div>
    )
  }

  // ── Empresa com erro (não encontrada é tratada no hook) ──
  if (erroEmpresa) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem', fontFamily: 'Barlow, sans-serif' }}>
        <p style={{ color: 'var(--danger)' }}>⚠️ {erroEmpresa}</p>
      </div>
    )
  }

  // ── Tela de sucesso ──────────────────────────────────────
  if (submitted) {
    return (
      <div className="success-screen">
        <div className="success-icon">✅</div>
        <h2>Relatório Enviado!</h2>
        <p>
          Seu relatório foi salvo com sucesso e já está disponível para{' '}
          <strong>{nomeEmpresa}</strong>.
        </p>
        <div className="success-badge">Protocolo: {submitId}</div>
        {!isPrefilled && (
          <button className="btn-primary" style={{ marginTop: 16 }} onClick={reset}>
            📋 Novo Relatório
          </button>
        )}
      </div>
    )
  }

  const steps = progress < 25 ? 0 : progress < 50 ? 1 : progress < 75 ? 2 : progress < 100 ? 3 : 4

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="page-wrapper">

      {/* Banner offline */}
      {!isOnline && (
        <div className="offline-banner">
          📵 Sem conexão — os dados estão sendo salvos localmente
        </div>
      )}

      {/* Banner de rascunho restaurado */}
      {hasDraft && !osId && (
        <div className="draft-banner">
          💾 Rascunho restaurado automaticamente
          <button onClick={clearDraft}>Descartar</button>
        </div>
      )}

      {/* Banner de OS pré-preenchida */}
      {isPrefilled && (
        <div className="prefill-banner">
          <span className="prefill-icon">🔔</span>
          <div>
            <strong>OS Pré-preenchida — Dados do Cliente</strong>
            <span>Confira os dados, preencha o serviço realizado e assine.</span>
          </div>
        </div>
      )}

      {/* HEADER — nome da empresa vem da config do Firestore */}
      <div className="form-header">
        <div className="header-icon">🏠</div>
        <div className="header-text">
          <h1>Checklist — {nomeEmpresa}</h1>
          <p>Relatório técnico de atendimento ao segurado</p>
        </div>
      </div>

      {/* BARRA DE PROGRESSO */}
      <div className="progress-bar">
        {[0, 1, 2, 3].map(i => <div key={i} className={`ps${i < steps ? ' on' : ''}`} />)}
      </div>

      {/* ══ 1. ATENDIMENTO ════════════════════════════════════ */}
      <div className="card">
        <div className="section-title">
          <div className="s-ico">📋</div><h2>Dados do Atendimento</h2><div className="section-divider" />
        </div>
        <div className="row col-2">
          <div className="field">
            <label>Seguradora <span className="req">*</span></label>
            <input value={form.seguradora} readOnly={isLocked('seguradora')}
              className={`${errors.seguradora ? 'error' : ''}${isLocked('seguradora') ? ' locked' : ''}`}
              onChange={e => !isLocked('seguradora') && setField('seguradora', e.target.value)}
              placeholder="Nome da seguradora" />
          </div>
          <div className="field">
            <label>Nº de Assistência <span className="req">*</span></label>
            <input value={form.num_assist} readOnly={isLocked('num_assist')}
              className={`${errors.num_assist ? 'error' : ''}${isLocked('num_assist') ? ' locked' : ''}`}
              onChange={e => !isLocked('num_assist') && setField('num_assist', e.target.value)}
              placeholder="Ex: 2024-00001" />
          </div>
        </div>
        <div className="row col-3">
          <div className="field">
            <label>Data de Chegada <span className="req">*</span></label>
            <input type="date" value={form.data_chegada} readOnly={isLocked('data_chegada')}
              className={`${errors.data_chegada ? 'error' : ''}${isLocked('data_chegada') ? ' locked' : ''}`}
              onChange={e => !isLocked('data_chegada') && setField('data_chegada', e.target.value)} />
          </div>
          <div className="field">
            <label>Horário Chegada</label>
            <input type="time" value={form.hora_chegada}
              className={isLocked('hora_chegada') ? 'locked' : ''}
              readOnly={isLocked('hora_chegada')}
              onChange={e => !isLocked('hora_chegada') && setField('hora_chegada', e.target.value)} />
          </div>
          <div className="field">
            <label>Horário Saída</label>
            <input type="time" value={form.hora_saida} onChange={e => setField('hora_saida', e.target.value)} />
          </div>
        </div>
        <div className="row col-1">
          <div className="field">
            <label>Serviço <span className="req">*</span></label>
            <input value={form.servico} readOnly={isLocked('servico')}
              className={`${errors.servico ? 'error' : ''}${isLocked('servico') ? ' locked' : ''}`}
              onChange={e => !isLocked('servico') && setField('servico', e.target.value)}
              placeholder="Tipo de serviço executado" />
          </div>
        </div>
      </div>

      {/* ══ 2. SEGURADO ═══════════════════════════════════════ */}
      <div className="card">
        <div className="section-title">
          <div className="s-ico">👤</div><h2>Dados do Segurado</h2><div className="section-divider" />
        </div>
        <div className="row col-2">
          <div className="field">
            <label>Nome Completo <span className="req">*</span></label>
            <input value={form.nome_segurado} readOnly={isLocked('nome_segurado')}
              className={`${errors.nome_segurado ? 'error' : ''}${isLocked('nome_segurado') ? ' locked' : ''}`}
              onChange={e => !isLocked('nome_segurado') && setField('nome_segurado', e.target.value)}
              placeholder="Nome do segurado" />
          </div>
          <div className="field">
            <label>Telefone</label>
            <input type="tel" value={form.tel_segurado} readOnly={isLocked('tel_segurado')}
              className={isLocked('tel_segurado') ? 'locked' : ''}
              onChange={e => !isLocked('tel_segurado') && setField('tel_segurado', e.target.value)}
              placeholder="(XX) XXXXX-XXXX" />
          </div>
        </div>
        <div className="row col-2">
          <div className="field" style={{ maxWidth: 160 }}>
            <label>CEP</label>
            <div style={{ position: 'relative' }}>
              <input value={form.cep} onChange={handleCEPChange}
                placeholder="00000-000" maxLength={8} inputMode="numeric"
                style={{ paddingRight: cepLoading ? 32 : undefined }} />
              {cepLoading && (
                <span style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  width: 14, height: 14, border: '2px solid #ccc', borderTopColor: '#1a3a5c',
                  borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite',
                }} />
              )}
            </div>
          </div>
          <div className="field">
            <label>Cidade <span className="req">*</span></label>
            <input value={form.cidade} readOnly={isLocked('cidade')}
              className={`${errors.cidade ? 'error' : ''}${isLocked('cidade') ? ' locked' : ''}`}
              onChange={e => !isLocked('cidade') && setField('cidade', e.target.value)}
              placeholder="Preenchida pelo CEP" />
          </div>
        </div>
        <div className="row col-2">
          <div className="field">
            <label>Endereço Completo <span className="req">*</span></label>
            <input ref={enderecoRef} value={form.endereco} readOnly={isLocked('endereco')}
              className={`${errors.endereco ? 'error' : ''}${isLocked('endereco') ? ' locked' : ''}`}
              onChange={e => !isLocked('endereco') && setField('endereco', e.target.value)}
              placeholder="Rua e bairro (preenchidos pelo CEP)" />
          </div>
          <div className="field" style={{ maxWidth: 130 }}>
            <label>Número</label>
            <input value={form.numero} readOnly={isLocked('endereco')}
              className={isLocked('endereco') ? 'locked' : ''}
              onChange={e => !isLocked('endereco') && setField('numero', e.target.value)}
              placeholder="Ex: 123" />
          </div>
        </div>
      </div>

      {/* ══ 3. DESCRIÇÃO ══════════════════════════════════════ */}
      <div className="card">
        <div className="section-title">
          <div className="s-ico">📝</div><h2>Descrição do Serviço</h2><div className="section-divider" />
        </div>
        <div className="row col-1">
          <div className="field">
            <label>Descrição do Problema e Serviço a Realizar <span className="req">*</span></label>
            <textarea rows={4} value={form.desc_problema} readOnly={isLocked('desc_problema')}
              className={`${errors.desc_problema ? 'error' : ''}${isLocked('desc_problema') ? ' locked' : ''}`}
              onChange={e => !isLocked('desc_problema') && setField('desc_problema', e.target.value)}
              placeholder="Descreva detalhadamente o problema encontrado..." />
          </div>
        </div>
        <div className="row col-1">
          <div className="field">
            <label>Avarias Pré-Existentes</label>
            <textarea rows={3} value={form.avarias} onChange={e => setField('avarias', e.target.value)}
              placeholder="Descreva avarias ou danos pré-existentes no local..." />
          </div>
        </div>
        <div className="row col-1">
          <div className="field">
            <label>Descrição do Serviço Realizado <span className="req">*</span></label>
            <textarea rows={4} value={form.desc_servico} onChange={e => setField('desc_servico', e.target.value)}
              className={errors.desc_servico ? 'error' : ''}
              placeholder="Descreva detalhadamente o serviço que foi realizado..." />
          </div>
        </div>
        <div className="row col-1">
          <div className="field">
            <label>Peças / Materiais Utilizados</label>
            <textarea rows={3} value={form.pecas} onChange={e => setField('pecas', e.target.value)}
              placeholder="Liste as peças e materiais utilizados..." />
          </div>
        </div>
      </div>

      {/* ══ 4. CHEK-UP ════════════════════════════════════════ */}
      <div className="card">
        <div className="section-title">
          <div className="s-ico">✅</div><h2>Chek-Up Realizado</h2><div className="section-divider" />
        </div>
        <div className="checkup-grid">
          {CHECKUP_ITEMS.map(item => {
            const state = checkup[item.id] || { checked: false, quant: '' }
            return (
              <div key={item.id} className={`ci${state.checked ? ' on' : ''}`} onClick={() => toggleCheckup(item.id)}>
                <div className="cbox"><span className="cbox-check">✓</span></div>
                <span className="ci-label">{item.label}</span>
                {item.quant && (
                  <div className="ci-quant" onClick={e => e.stopPropagation()}>
                    <input type="number" min="1" placeholder="Qtd" value={state.quant}
                      onChange={e => setCheckupQuant(item.id, e.target.value)} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ══ 5. CONCLUSÃO ══════════════════════════════════════ */}
      <div className="card">
        <div className="section-title">
          <div className="s-ico">🏁</div><h2>Conclusão do Serviço</h2><div className="section-divider" />
        </div>

        {[
          ['problema_solucionado', 'Problema Solucionado?'],
          ['havera_retorno', 'Haverá Retorno?'],
          ['garantia', 'Há Garantia (90 dias)?'],
        ].map(([field, lbl]) => (
          <div key={field} className="conclusao-item">
            <span className="conclusao-label">{lbl}</span>
            <div className="radio-group">
              {['sim', 'nao'].map(v => (
                <div key={v}
                  className={`ri${form[field] === v ? (v === 'sim' ? ' rs' : ' rn') : ''}`}
                  onClick={() => setField(field, v)}>
                  <div className="rdot"><div className="rdot-i" /></div>
                  {v === 'sim' ? 'Sim' : 'Não'}
                </div>
              ))}
            </div>
          </div>
        ))}

        {form.problema_solucionado === 'nao' && (
          <div style={{ padding: '8px 0 12px' }}>
            <div className="field">
              <label>Se NÃO, especifique</label>
              <textarea rows={2} value={form.especifique} onChange={e => setField('especifique', e.target.value)}
                placeholder="Motivo pelo qual o problema não foi solucionado..." />
            </div>
          </div>
        )}

        <div className="conclusao-item">
          <span className="conclusao-label">Houve Excedente?</span>
          <div className="field" style={{ minWidth: 170 }}>
            <input value={form.excedente} onChange={e => setField('excedente', e.target.value)}
              placeholder="R$ 0,00" style={{ textAlign: 'right' }} />
          </div>
        </div>
      </div>

      {/* ══ 6. FOTOS ══════════════════════════════════════════ */}
      <div className="card">
        <div className="section-title">
          <div className="s-ico">📷</div><h2>Fotos do Atendimento</h2><div className="section-divider" />
        </div>
        <label className="foto-upload-area">
          <input type="file" accept="image/*" multiple onChange={handleFotoSelect} />
          <div className="foto-upload-icon">📷</div>
          <div className="foto-upload-text">
            <strong>Toque para adicionar fotos</strong><br />
            Aceita múltiplas imagens
          </div>
        </label>
        {uploadingFoto && <p className="foto-upload-progress">⏳ Enviando fotos...</p>}
        {fotos.length > 0 && (
          <div className="foto-grid">
            {fotos.map((f, idx) => (
              <div key={idx} className="foto-thumb">
                <img src={f.preview} alt={`foto ${idx + 1}`} />
                <button className="foto-thumb-remove" onClick={() => removeFoto(idx)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ 7. ASSINATURAS ════════════════════════════════════ */}
      <div className="card">
        <div className="section-title">
          <div className="s-ico">✍️</div><h2>Assinaturas</h2><div className="section-divider" />
        </div>
        {(errors.sig_prest || errors.sig_seg) && (
          <div className="err-msg">⚠️ As assinaturas do prestador e do segurado são obrigatórias.</div>
        )}
        <div className="row col-2">
          <div className="field">
            <label>Assinatura do Prestador <span className="req">*</span></label>
            <div className={`sig-container${hasSigPrest ? ' has-sig' : ''}${errors.sig_prest ? ' error-sig' : ''}`}>
              <SignatureCanvas ref={sigPrestRef} penColor="#1a3a5c"
                canvasProps={{ style: { width: '100%', height: '100%' } }}
                onEnd={() => { setHasSigPrest(true); setSigPrestData(sigPrestRef.current.toDataURL('image/png')) }} />
              {!hasSigPrest && (
                <div className="sig-placeholder"><span>✍️</span><span>Assine com o dedo ou mouse</span></div>
              )}
              {hasSigPrest && (
                <button className="sig-clear-btn" onClick={() => { sigPrestRef.current.clear(); setHasSigPrest(false) }}>
                  ✕ Limpar
                </button>
              )}
            </div>
          </div>
          <div className="field">
            <label>Assinatura do Segurado <span className="req">*</span></label>
            <div className={`sig-container${hasSigSeg ? ' has-sig' : ''}${errors.sig_seg ? ' error-sig' : ''}`}>
              <SignatureCanvas ref={sigSegRef} penColor="#1a3a5c"
                canvasProps={{ style: { width: '100%', height: '100%' } }}
                onEnd={() => { setHasSigSeg(true); setSigSegData(sigSegRef.current.toDataURL('image/png')) }} />
              {!hasSigSeg && (
                <div className="sig-placeholder"><span>✍️</span><span>Assine com o dedo ou mouse</span></div>
              )}
              {hasSigSeg && (
                <button className="sig-clear-btn" onClick={() => { sigSegRef.current.clear(); setHasSigSeg(false) }}>
                  ✕ Limpar
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="row col-2" style={{ marginTop: 14 }}>
          <div className="field">
            <label>Data do Atendimento</label>
            <input type="date" value={form.data_atend} onChange={e => setField('data_atend', e.target.value)} />
          </div>
          <div className="field">
            <label>Telefone de Contato</label>
            <input type="tel" value={form.tel_contato} onChange={e => setField('tel_contato', e.target.value)} placeholder="(XX) XXXXX-XXXX" />
          </div>
        </div>
      </div>

      {/* FOOTER — telefone dinâmico da config da empresa */}
      <div className="form-footer">
        <div className="footer-info">
          <strong>{nomeEmpresa}</strong>
          {telefoneRodape && <><br />{telefoneRodape}</>}
        </div>
        <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
          {submitting ? (
            <>
              <span style={{
                display: 'inline-block', width: 16, height: 16,
                border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff',
                borderRadius: '50%', animation: 'spin 0.7s linear infinite',
              }} />
              {uploadingFoto ? 'Enviando fotos...' : 'Enviando...'}
            </>
          ) : 'Enviar Relatório 🚀'}
        </button>
      </div>

    </div>
  )
}
