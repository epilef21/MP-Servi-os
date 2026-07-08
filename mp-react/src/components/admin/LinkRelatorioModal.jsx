// ============================================================
// MODAL: LINK DO RELATÓRIO — extraído do AdminPage.jsx
// Link público do relatório técnico para enviar à seguradora.
// ============================================================
import { useState } from 'react'
import { useAdminContext } from '../../contexts/AdminContext.jsx'
import { copyToClipboard } from '../../utils/clipboard.js'
import { Link2, X, CheckCircle2, ClipboardList, Send } from 'lucide-react'

export default function LinkRelatorioModal({ os, onClose }) {
  const { buildLinkRelatorio } = useAdminContext()
  const [copied, setCopied] = useState(false)

  const link = buildLinkRelatorio(os.id, os.publicToken)

  async function copyLinkRel() {
    await copyToClipboard(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 520 }}>
        <div className="modal-header" style={{ background: '#1a5276' }}>
          <h2><Link2 size={16} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 6 }} />Link do Relatório</h2>
          <button className="btn-sm" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={onClose}><X size={16} strokeWidth={2} /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '.82rem', color: 'var(--muted)', marginBottom: 10 }}>
            Envie este link para a seguradora
          </p>
          <div className="link-info-cards">
            <div className="link-info-card"><span className="link-info-lbl">Segurado</span><span className="link-info-val">{os.nome_segurado || '—'}</span></div>
            <div className="link-info-card"><span className="link-info-lbl">Nº Assistência</span><span className="link-info-val">{os.num_assist || '—'}</span></div>
            <div className="link-info-card"><span className="link-info-lbl">Seguradora</span><span className="link-info-val">{os.seguradora || '—'}</span></div>
          </div>
          <div className="link-box" style={{ marginTop: 14 }}>
            <span className="link-text">{link}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            <button
              className={`btn-copy${copied ? ' copied' : ''}`}
              onClick={copyLinkRel}>
              {copied ? <><CheckCircle2 size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />Copiado!</> : <><ClipboardList size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />Copiar Link</>}
            </button>
            <a className="btn-whatsapp"
              href={`https://wa.me/?text=${encodeURIComponent(
                `Olá! Segue o relatório técnico do atendimento:\n\n` +
                `📋 OS: ${os.num_assist || '—'}\n` +
                `👤 Segurado: ${os.nome_segurado || '—'}\n` +
                `📍 ${os.cidade || '—'}\n` +
                `🔧 ${os.servico || '—'}\n` +
                `📅 ${os.data_chegada || '—'}\n\n` +
                `🔗 Acesse o relatório completo:\n${link}\n\n` +
                `O relatório contém fotos, checklist e assinaturas do prestador e do segurado.`
              )}`}
              target="_blank" rel="noopener noreferrer">
              <Send size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />Enviar no WhatsApp
            </a>
            <button className="btn-sm" style={{ background: '#1a5276', color: '#fff', fontSize: '.85rem', padding: '8px 14px', width: '100%' }}
              onClick={() => window.open(link, '_blank')}>
              <Link2 size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />Abrir Relatório
            </button>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-sm btn-view" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}
