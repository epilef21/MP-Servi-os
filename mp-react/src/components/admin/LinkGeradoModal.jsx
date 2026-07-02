// ============================================================
// MODAL: LINK GERADO — extraído do AdminPage.jsx
// Mostra o link do checklist para enviar ao técnico.
// ============================================================
import { useState } from 'react'
import { copyToClipboard } from '../../utils/clipboard.js'

export default function LinkGeradoModal({ data, onClose }) {
  const [copied, setCopied] = useState(false)

  async function copyLink(link) {
    await copyToClipboard(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 560 }}>
        <div className="modal-header" style={{ background: '#1e6e3e' }}>
          <h2>🔗 Link Gerado!</h2>
          <button className="btn-sm" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="link-info-cards">
            <div className="link-info-card"><span className="link-info-lbl">Segurado</span><span className="link-info-val">{data.nome}</span></div>
            <div className="link-info-card"><span className="link-info-lbl">Seguradora</span><span className="link-info-val">{data.seguradora}</span></div>
            <div className="link-info-card"><span className="link-info-lbl">Nº Assistência</span><span className="link-info-val">{data.num_assist || '—'}</span></div>
          </div>
          <p style={{ fontSize: '.8rem', color: 'var(--muted)', margin: '14px 0 6px' }}>Link para o técnico — já vem com os dados preenchidos:</p>
          <div className="link-box"><span className="link-text">{data.link}</span></div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <button className={`btn-copy${copied ? ' copied' : ''}`} onClick={() => copyLink(data.link)}>
              {copied ? '✅ Copiado!' : '📋 Copiar Link'}
            </button>
            <a className="btn-whatsapp"
              href={`https://wa.me/?text=${encodeURIComponent(`Olá! Segue o link para preencher o checklist da OS:\n\n🔗 ${data.link}\n\nAbra, confira os dados, preencha o serviço realizado e assine. Obrigado!`)}`}
              target="_blank" rel="noopener noreferrer">
              📲 Enviar pelo WhatsApp
            </a>
          </div>
          <div className="link-tip">💡 Quando o técnico abrir esse link, o formulário já estará com os dados do cliente preenchidos. Ele só precisará descrever o serviço realizado e assinar.</div>
        </div>
        <div className="modal-footer">
          <button className="btn-sm btn-view" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}
