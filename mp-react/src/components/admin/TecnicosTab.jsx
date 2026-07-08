import { useState } from 'react'
import { HardHat, Pencil, X, Hourglass, Save, CheckCircle2, Ban } from 'lucide-react'
import {
  db, updateDoc, doc, collection, addDoc, serverTimestamp,
} from '../../firebase.js'
import { useAdminContext } from '../../contexts/AdminContext.jsx'
import { maskPhone } from '../../utils/formatters.js'

const AVATAR_COLORS = ['av0', 'av1', 'av2', 'av3']

const TECNICO_FORM_INITIAL = {
  nome: '', telefone: '', email: '', especialidade: '', ativo: true,
  chave_pix: '', forma_pagamento: 'pix',
}

export default function TecnicosTab() {
  const {
    tecnicos, setTecnicos, loadingTecnicos,
    empresaId, showToast, nomeEmpresa,
  } = useAdminContext()

  const [showModal,  setShowModal]  = useState(false)
  const [editando,   setEditando]   = useState(null)
  const [formData,   setFormData]   = useState(TECNICO_FORM_INITIAL)
  const [formErrors, setFormErrors] = useState({})
  const [saving,     setSaving]     = useState(false)

  function openModal(tec = null) {
    setEditando(tec)
    setFormData(tec
      ? {
        nome: tec.nome || '', telefone: tec.telefone || '', email: tec.email || '', especialidade: tec.especialidade || '', ativo: tec.ativo !== false,
        chave_pix:       tec.chave_pix || '',
        forma_pagamento: tec.forma_pagamento || 'pix',
      }
      : TECNICO_FORM_INITIAL
    )
    setFormErrors({})
    setShowModal(true)
  }

  async function salvar() {
    const errs = {}
    if (!formData.nome.trim())     errs.nome     = true
    if (!formData.telefone.trim()) errs.telefone = true
    setFormErrors(errs)
    if (Object.keys(errs).length) return

    setSaving(true)
    try {
      const payload = {
        nome:          formData.nome.trim(),
        telefone:      formData.telefone.trim(),
        email:         formData.email.trim()         || '',
        especialidade: formData.especialidade.trim() || '',
        ativo:         formData.ativo,
        chave_pix:       formData.chave_pix.trim() || '',
        forma_pagamento: formData.forma_pagamento || 'pix',
      }

      if (editando) {
        await updateDoc(doc(db, 'empresas', empresaId, 'tecnicos', editando.id), payload)
        setTecnicos(p => p.map(t => t.id === editando.id ? { ...t, ...payload } : t))
        showToast('✅ Técnico atualizado!')
      } else {
        const ref = await addDoc(
          collection(db, 'empresas', empresaId, 'tecnicos'),
          { ...payload, criado_em: serverTimestamp() },
        )
        setTecnicos(p => [...p, { id: ref.id, ...payload }])
        showToast('✅ Técnico cadastrado!')
      }
      setShowModal(false)
    } catch (e) {
      showToast('Erro: ' + e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleAtivo(tec) {
    try {
      const novoAtivo = !tec.ativo
      await updateDoc(doc(db, 'empresas', empresaId, 'tecnicos', tec.id), { ativo: novoAtivo })
      setTecnicos(p => p.map(t => t.id === tec.id ? { ...t, ativo: novoAtivo } : t))
      showToast(novoAtivo ? '🟢 Técnico ativado' : '⚫ Técnico desativado')
    } catch (e) {
      showToast('Erro: ' + e.message, 'error')
    }
  }

  return (
    <>
      {/* ── Lista ── */}
      <div className="tab-content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontFamily: 'Barlow Condensed,sans-serif', fontSize: '1.4rem', fontWeight: 900, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
              <HardHat size={20} strokeWidth={2} style={{ verticalAlign: '-3px', marginRight: 6 }} />Técnicos da Equipe
            </h2>
            <p style={{ fontSize: '.82rem', color: 'var(--muted)', marginTop: 2 }}>{nomeEmpresa}</p>
          </div>
          <button className="btn-new-os" onClick={() => openModal()}>
            + Adicionar Técnico
          </button>
        </div>

        {loadingTecnicos && (
          <div className="loading-state">
            <div className="spinner" />
            <div className="loading-text">Carregando técnicos...</div>
          </div>
        )}

        {!loadingTecnicos && tecnicos.length === 0 && (
          <div className="empty-state" style={{ paddingTop: 60 }}>
            <div className="e-icon"><HardHat size={40} strokeWidth={2} /></div>
            <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 6 }}>Nenhum técnico cadastrado</p>
            <p style={{ fontSize: '.85rem' }}>Adicione seu primeiro técnico!</p>
            <button className="btn-new-os" style={{ marginTop: 16 }} onClick={() => openModal()}>
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
                {tec.especialidade && <div className="tecnico-esp">{tec.especialidade}</div>}
                <span className={`tecnico-badge ${tec.ativo !== false ? 'ativo' : 'inativo'}`}>
                  {tec.ativo !== false
                    ? <><CheckCircle2 size={13} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 4 }} />Ativo</>
                    : <><Ban size={13} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 4 }} />Inativo</>}
                </span>
                <div className="tecnico-card-actions">
                  <button className="btn-sm btn-view" onClick={() => openModal(tec)}>
                    <Pencil size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 4 }} />Editar
                  </button>
                  <button
                    className="btn-sm"
                    style={{
                      background: tec.ativo !== false ? '#f5f5f5' : 'var(--success)',
                      color:      tec.ativo !== false ? '#666'    : '#fff',
                    }}
                    onClick={() => toggleAtivo(tec)}
                  >
                    {tec.ativo !== false ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2>{editando ? <><Pencil size={18} strokeWidth={2} style={{ verticalAlign: '-3px', marginRight: 6 }} />Editar Técnico</> : <><HardHat size={18} strokeWidth={2} style={{ verticalAlign: '-3px', marginRight: 6 }} />Novo Técnico</>}</h2>
              <button className="btn-sm" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }}
                onClick={() => setShowModal(false)}><X size={14} strokeWidth={2} /></button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="field" style={{ gridColumn: '1/-1' }}>
                  <label>Nome completo <span className="req">*</span></label>
                  <input
                    value={formData.nome}
                    onChange={e => setFormData(p => ({ ...p, nome: e.target.value }))}
                    className={formErrors.nome ? 'error' : ''}
                    placeholder="Nome completo do técnico"
                  />
                </div>

                <div className="field">
                  <label>Telefone <span className="req">*</span></label>
                  <input
                    type="tel"
                    value={formData.telefone}
                    onChange={e => setFormData(p => ({ ...p, telefone: maskPhone(e.target.value) }))}
                    className={formErrors.telefone ? 'error' : ''}
                    placeholder="(XX) XXXXX-XXXX"
                  />
                </div>

                <div className="field">
                  <label>E-mail (opcional)</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                    placeholder="email@exemplo.com"
                  />
                </div>

                <div className="field" style={{ gridColumn: '1/-1' }}>
                  <label>Especialidade (opcional)</label>
                  <input
                    value={formData.especialidade}
                    onChange={e => setFormData(p => ({ ...p, especialidade: e.target.value }))}
                    placeholder="Ex: Hidráulica, Elétrica"
                  />
                </div>

                <div className="field" style={{ gridColumn: '1/-1' }}>
                  <label>Chave PIX (opcional)</label>
                  <input
                    value={formData.chave_pix}
                    onChange={e => setFormData(p => ({ ...p, chave_pix: e.target.value }))}
                    placeholder="CPF, telefone, e-mail ou chave aleatória"
                  />
                </div>

                <div className="field">
                  <label>Forma de pagamento</label>
                  <select
                    value={formData.forma_pagamento}
                    onChange={e => setFormData(p => ({ ...p, forma_pagamento: e.target.value }))}
                  >
                    <option value="pix">PIX</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="transferencia">Transferência</option>
                  </select>
                </div>

                <div style={{ gridColumn: '1/-1' }}>
                  <div className="toggle-wrap">
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={formData.ativo}
                        onChange={e => setFormData(p => ({ ...p, ativo: e.target.checked }))}
                      />
                      <span className="toggle-slider" />
                    </label>
                    <span className="toggle-label">
                      {formData.ativo
                        ? <><CheckCircle2 size={13} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 4 }} />Ativo</>
                        : <><Ban size={13} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 4 }} />Inativo</>}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-sm"
                style={{ background: 'var(--light)', color: 'var(--muted)', border: '1px solid var(--border)' }}
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={salvar}
                disabled={saving}
                style={{ padding: '9px 22px', fontSize: '.9rem' }}
              >
                {saving
                  ? <><Hourglass size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />Salvando...</>
                  : <><Save size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />Salvar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
