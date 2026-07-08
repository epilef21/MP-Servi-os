// ============================================================
// MODAL: NOVA ORDEM DE SERVIÇO — extraído do AdminPage.jsx
// Formulário preenchido por telefone; gera link para o técnico.
// ============================================================
import { useState, useRef } from 'react'
import { Phone, X, ClipboardList, CalendarDays, User, Wrench, HardHat, Hourglass, Save } from 'lucide-react'
import { criarOS } from '../../firebase.js'
import { useAdminContext } from '../../contexts/AdminContext.jsx'

export const OS_INITIAL = {
  seguradora: '', num_assist: '', nome_segurado: '',
  tel_segurado: '', cep: '', endereco: '', numero: '', cidade: '',
  data_atend: '', hora_atend: '', servico: '', desc_problema: '',
  tecnico_id: '', tecnico_nome_manual: '',
  data_agendada: '', hora_agendada: '',
  faixa_horario: '', faixa_horario_custom: '',
}

export default function NovaOSModal({ prefill, onClose }) {
  const {
    empresaId, seguradoras, tecnicos, limite,
    buildLink, setReports, setTotalMes, setGeneratedLink, showToast,
  } = useAdminContext()

  const [osForm,       setOsForm]       = useState({ ...OS_INITIAL, ...(prefill || {}) })
  const [osErrors,     setOsErrors]     = useState({})
  const [osCepLoading, setOsCepLoading] = useState(false)
  const [savingOs,     setSavingOs]     = useState(false)
  const [osTecnicoMode, setOsTecnicoMode] = useState('select')
  const osEnderecoRef = useRef(null)

  const tecnicosAtivos = tecnicos.filter(t => t.ativo !== false)

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

  async function saveOs() {
    if (!validateOs()) return
    if (limite.bloqueado) {
      showToast(`Limite de ${limite.limite} OS/mês atingido. Faça upgrade do plano.`, 'error')
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
      setGeneratedLink({ link: buildLink(newRec), os: ref.id, nome: osForm.nome_segurado, seguradora: osForm.seguradora, num_assist: osForm.num_assist })
      onClose()
    } catch (e) { showToast('Erro ao salvar OS: ' + e.message, 'error') }
    finally { setSavingOs(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h2>📞 Nova Ordem de Serviço</h2>
          <button className="btn-sm" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }}
            onClick={onClose}>✕ Fechar</button>
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
            onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={saveOs} disabled={savingOs} style={{ padding: '9px 22px', fontSize: '.9rem' }}>
            {savingOs ? '⏳ Salvando...' : '💾 Salvar e Gerar Link'}
          </button>
        </div>
      </div>
    </div>
  )
}
