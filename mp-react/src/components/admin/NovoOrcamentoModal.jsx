// ============================================================
// MODAL: NOVO ORÇAMENTO (3 etapas) — extraído do AdminPage.jsx
// Etapas: Tipo → Cliente → Condições. Gera link para o técnico.
// ============================================================
import { useState } from 'react'
import {
  FileText, X, Check, Home, Zap, User, Info, HardHat, Lightbulb, Hourglass, Save,
} from 'lucide-react'
import {
  db, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp,
} from '../../firebase.js'
import { useAdminContext } from '../../contexts/AdminContext.jsx'
import { maskPhone } from '../../utils/formatters.js'

export const ORC_INITIAL = {
  tipo: '', cenario: '', seguradora: '', num_assist: '',
  nome_cliente: '', tel_cliente: '', email_cliente: '',
  endereco: '', cidade: '',
  tipo_equipamento: '', marca: '', modelo: '', voltagem: '', defeito: '',
  tipo_emergencia: '', desc_problema: '',
  validade: '', prazo_execucao: '', garantia: '90 dias',
  forma_pagamento: 'pix', observacoes: '', tecnico_id: '',
}

export default function NovoOrcamentoModal({ onClose, onCreated }) {
  const {
    empresaId, seguradoras, tecnicos,
    setOrcamentos, showToast, buildLinkTecnicoOrc,
  } = useAdminContext()

  const [orcEtapa,  setOrcEtapa]  = useState(1)
  const [orcForm,   setOrcForm]   = useState({ ...ORC_INITIAL })
  const [orcErrors, setOrcErrors] = useState({})
  const [savingOrc, setSavingOrc] = useState(false)

  const tecnicosAtivos = tecnicos.filter(t => t.ativo !== false)

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
      onCreated({ id: ref.id, numero, tecnico: buildLinkTecnicoOrc(ref.id), tecnicoNome: tecNome, tecnicoTel: tecTel, payload })
      showToast('✅ Orçamento criado!')
    } catch (e) {
      showToast('Erro ao criar orçamento: ' + e.message, 'error')
    } finally {
      setSavingOrc(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <h2><FileText size={18} strokeWidth={2} style={{ verticalAlign: '-3px', marginRight: 6 }} />Novo Orçamento</h2>
          <button className="btn-sm" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={onClose}><X size={14} strokeWidth={2} /></button>
        </div>
        <div className="modal-body">

          {/* Navegador de etapas */}
          <div className="etapas-nav">
            {['Tipo', 'Cliente', 'Condições'].map((lbl, idx) => (
              <div key={idx} className={`etapa-step ${orcEtapa === idx+1 ? 'ativa' : orcEtapa > idx+1 ? 'concluida' : ''}`}>
                {orcEtapa > idx+1 ? <Check size={13} strokeWidth={2.5} style={{ verticalAlign: '-2px', marginRight: 4 }} /> : `${idx+1}. `}{lbl}
              </div>
            ))}
          </div>

          {/* ── ETAPA 1 ── */}
          {orcEtapa === 1 && (
            <>
              <p style={{ fontSize:'.82rem', color:'var(--muted)', marginBottom:14 }}>Selecione o tipo de atendimento:</p>
              <div className="tipo-selector">
                {[
                  { v:'linha_branca', icon:Home, label:'Linha Branca / Marrom' },
                  { v:'emergencial',  icon:Zap,  label:'Emergencial'           },
                  { v:'particular',   icon:User, label:'Particular'            },
                ].map(op => (
                  <div
                    key={op.v}
                    className={`tipo-card${orcForm.tipo === op.v ? ' selected' : ''}`}
                    onClick={() => { setOrcForm(p => ({ ...p, tipo: op.v, cenario: op.v === 'particular' ? 'particular' : '' })); setOrcErrors(p => ({ ...p, tipo: false })) }}
                  >
                    <div className="tipo-icon"><op.icon size={22} strokeWidth={2} /></div>
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
                    <Info size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />Marca, modelo, voltagem e número de série serão preenchidos pelo técnico no local.
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
                <Info size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />Prazo de execução e forma de pagamento serão definidos pelo técnico no local.
              </div>

              <div className="md-section" style={{ marginTop:16 }}>
                <h3><HardHat size={15} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />Técnico Responsável</h3>
                <div className="field">
                  <label>Selecionar técnico (opcional)</label>
                  <select value={orcForm.tecnico_id} onChange={e => setOrcForm(p => ({ ...p, tecnico_id: e.target.value }))}>
                    <option value="">Sem técnico definido</option>
                    {tecnicosAtivos.map(t => <option key={t.id} value={t.id}>{t.nome} — {t.telefone}</option>)}
                  </select>
                </div>
                <p style={{ fontSize:'.8rem', color:'var(--muted)', marginTop:8 }}>
                  <Lightbulb size={13} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 4 }} />Ao salvar, um link será gerado para o técnico preencher o diagnóstico e os valores no local.
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
            onClick={onClose}>Cancelar</button>
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
                {savingOrc
                  ? <><Hourglass size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />Salvando...</>
                  : <><Save size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />Criar Orçamento</>}
              </button>
            )
          }
        </div>
      </div>
    </div>
  )
}
