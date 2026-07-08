// ============================================================
// PREENCHER OS MODAL — Admin preenche o que o técnico faria
// e gera link para o cliente assinar remotamente
// ============================================================
import { useState, useRef } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { db, doc, updateDoc, serverTimestamp, arrayUnion } from '../../firebase.js'
import { useAdminContext } from '../../contexts/AdminContext.jsx'
import { CheckCircle2, X, Smartphone, PenLine, Hourglass, Save } from 'lucide-react'

export default function PreencherOSModal({ os, empresaId, slug, onClose, onSaved }) {
  const { showToast } = useAdminContext()
  const [descServico,  setDescServico]  = useState(os.desc_servico  || '')
  const [dataAtend,    setDataAtend]    = useState(os.data_atend    || os.data_chegada || '')
  const [horaChegada,  setHoraChegada]  = useState(os.hora_chegada  || '')
  const [horaSaida,    setHoraSaida]    = useState(os.hora_saida    || '')
  const [hasSig,       setHasSig]       = useState(false)
  const [errors,       setErrors]       = useState({})
  const [salvando,     setSalvando]     = useState(false)
  const [linkGerado,   setLinkGerado]   = useState(null)
  const sigRef = useRef(null)

  function validate() {
    const errs = {}
    if (!descServico.trim()) errs.descServico = true
    if (!hasSig)             errs.sig         = true
    setErrors(errs)
    return !Object.keys(errs).length
  }

  async function handleSalvar() {
    if (!validate()) return
    setSalvando(true)
    try {
      const assinaturaPrestador = sigRef.current?.toDataURL('image/png') || ''
      const payload = {
        desc_servico:         descServico.trim(),
        data_atend:           dataAtend,
        hora_chegada:         horaChegada,
        hora_saida:           horaSaida,
        assinatura_prestador: assinaturaPrestador,
        status:               'aguardando_assinatura_cliente',
        preenchido_por_admin: true,
        preenchido_em:        serverTimestamp(),
        status_historico: arrayUnion({
          para:   'aguardando_assinatura_cliente',
          quando: new Date().toISOString(),
          por:    'admin',
        }),
      }
      await updateDoc(doc(db, `empresas/${empresaId}/checklist`, os.id), payload)
      const t    = os.publicToken ? `?t=${os.publicToken}` : ''
      const link = `${window.location.origin}/assinar/${slug}/${os.id}${t}`
      setLinkGerado(link)
      onSaved({ ...os, ...payload, status: 'aguardando_assinatura_cliente' })
    } catch (e) {
      showToast('Erro ao salvar: ' + e.message, 'error')
    } finally {
      setSalvando(false)
    }
  }

  function enviarWhatsApp() {
    const tel  = (os.tel_segurado || '').replace(/\D/g, '')
    const nome = os.nome_segurado || ''
    const msg  = `Olá ${nome}! 😊\nSeu atendimento foi registrado e precisamos da sua assinatura para finalizar o documento.\n\n🔧 Serviço: ${os.servico || '—'}\n\nClique no link para assinar:\n🔗 ${linkGerado}\n\nEm caso de dúvidas, entre em contato conosco.`
    const waUrl = tel
      ? `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(waUrl, '_blank')
  }

  // ── TELA PÓS-SAVE: mostra link + botão WhatsApp ──────────────
  if (linkGerado) {
    return (
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal-box" style={{ maxWidth: 480 }}>
          <div className="modal-header">
            <h2><CheckCircle2 size={16} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 6 }} />Formulário salvo!</h2>
            <button
              className="btn-sm"
              style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }}
              onClick={onClose}
            ><X size={16} strokeWidth={2} /></button>
          </div>
          <div className="modal-body" style={{ textAlign: 'center', padding: '28px 24px' }}>
            <div style={{ marginBottom: 12 }}><Smartphone size={52} strokeWidth={1.5} /></div>
            <h3 style={{ marginBottom: 8 }}>Envie o link para {os.nome_segurado || 'o cliente'} assinar</h3>
            <p style={{ color: 'var(--muted)', fontSize: '.88rem', marginBottom: 20 }}>
              O cliente abre o link, vê o resumo do atendimento e assina com o dedo.
            </p>
            <div style={{
              background: '#f0f4fb', borderRadius: 10, padding: '10px 14px',
              wordBreak: 'break-all', fontSize: '.8rem', marginBottom: 20,
              textAlign: 'left', border: '1px solid var(--border)',
            }}>
              {linkGerado}
            </div>
            <button
              style={{
                width: '100%', background: '#25d366', color: '#fff', border: 'none',
                borderRadius: 10, padding: '14px',
                fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800,
                fontSize: '1.1rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
              onClick={enviarWhatsApp}
            >
              <Smartphone size={18} strokeWidth={2} />Enviar via WhatsApp
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── FORMULÁRIO ────────────────────────────────────────────────
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h2><PenLine size={16} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 6 }} />Preencher e Enviar para Assinatura</h2>
          <button
            className="btn-sm"
            style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }}
            onClick={onClose}
          ><X size={16} strokeWidth={2} /></button>
        </div>

        <div className="modal-body">
          <p style={{
            color: 'var(--muted)', fontSize: '.85rem', marginBottom: 16,
            background: '#f0f4fb', padding: '10px 14px', borderRadius: 8,
            border: '1px solid var(--border)',
          }}>
            Preencha o que foi realizado e assine como responsável. Depois, um link será gerado para o cliente assinar de casa.
          </p>

          <div className="field">
            <label>
              Descrição do Serviço Realizado <span className="req">*</span>
            </label>
            <textarea
              rows={4}
              value={descServico}
              onChange={e => { setDescServico(e.target.value); setErrors(p => ({ ...p, descServico: false })) }}
              className={errors.descServico ? 'error' : ''}
              placeholder="Descreva o que foi feito no atendimento..."
            />
            {errors.descServico && (
              <span style={{ color: 'var(--danger)', fontSize: '.78rem' }}>Campo obrigatório</span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
            <div className="field">
              <label>Data do Atendimento</label>
              <input type="date" value={dataAtend} onChange={e => setDataAtend(e.target.value)} />
            </div>
            <div className="field">
              <label>Hora de Chegada</label>
              <input type="time" value={horaChegada} onChange={e => setHoraChegada(e.target.value)} />
            </div>
            <div className="field">
              <label>Hora de Saída</label>
              <input type="time" value={horaSaida} onChange={e => setHoraSaida(e.target.value)} />
            </div>
          </div>

          <div className="field" style={{ marginTop: 16 }}>
            <label>
              Assinatura do Responsável Técnico <span className="req">*</span>
            </label>
            <div className={`sig-container${hasSig ? ' has-sig' : ''}${errors.sig ? ' error-sig' : ''}`}>
              <SignatureCanvas
                ref={sigRef}
                penColor="#1a3fa8"
                canvasProps={{ style: { width: '100%', height: '100%' } }}
                onEnd={() => { setHasSig(true); setErrors(p => ({ ...p, sig: false })) }}
              />
              {!hasSig && (
                <div className="sig-placeholder">
                  <span><PenLine size={22} strokeWidth={2} /></span>
                  <span>Assine com o mouse</span>
                </div>
              )}
              {hasSig && (
                <button
                  className="sig-clear-btn"
                  onClick={() => { sigRef.current.clear(); setHasSig(false) }}
                ><X size={13} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 4 }} />Limpar</button>
              )}
            </div>
            {errors.sig && (
              <span style={{ color: 'var(--danger)', fontSize: '.78rem', marginTop: 4, display: 'block' }}>
                Assinatura obrigatória
              </span>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="btn-sm"
            style={{ background: 'rgba(0,0,0,.06)', color: 'var(--muted)' }}
            onClick={onClose}
          >Cancelar</button>
          <button className="btn-sm btn-ok" disabled={salvando} onClick={handleSalvar}>
            {salvando ? <><Hourglass size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />Salvando...</> : <><Save size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />Salvar e Gerar Link</>}
          </button>
        </div>
      </div>
    </div>
  )
}
