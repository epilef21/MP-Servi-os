// ============================================================
// MODAL: LINKS GERADOS (orçamento) — extraído do AdminPage.jsx
// Mostra o link do técnico após criar um orçamento.
// ============================================================
import { useState } from 'react'
import { copyToClipboard } from '../../utils/clipboard.js'

export default function OrcamentoLinksModal({ links, onClose, onVerLista }) {
  const [copied, setCopied] = useState(false)

  async function copyOrcLink(link) {
    await copyToClipboard(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 520 }}>
        <div className="modal-header" style={{ background:'#1e6e3e' }}>
          <h2>✅ Orçamento {links.numero} criado!</h2>
          <button className="btn-sm" style={{ background:'rgba(255,255,255,.15)', color:'#fff' }} onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="orc-link-section">
            <h4>👷 Link do Técnico</h4>
            <p>Para o técnico preencher o diagnóstico e os valores no local</p>
            <div className="link-box"><span className="link-text">{links.tecnico}</span></div>
            <div style={{ display:'flex', gap:10, marginTop:12, flexWrap:'wrap' }}>
              <button className={`btn-copy${copied ? ' copied' : ''}`} onClick={() => copyOrcLink(links.tecnico)}>
                {copied ? '✅ Copiado!' : '📋 Copiar'}
              </button>
              {links.tecnicoTel && (
                <a className="btn-whatsapp" target="_blank" rel="noopener noreferrer"
                  href={`https://wa.me/55${links.tecnicoTel.replace(/\D/g,'')}?text=${encodeURIComponent(`Olá ${links.tecnicoNome || 'Técnico'}! 👷\nVocê tem um novo orçamento para avaliar no local.\n\nAcesse o link para preencher o diagnóstico e os valores:\n🔗 ${links.tecnico}`)}`}>
                  📲 WhatsApp Técnico
                </a>
              )}
              {!links.tecnicoTel && (
                <a className="btn-whatsapp" target="_blank" rel="noopener noreferrer"
                  href={`https://wa.me/?text=${encodeURIComponent(`Novo orçamento para preencher:\n🔗 ${links.tecnico}`)}`}>
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
            onClick={onClose}>Fechar</button>
          <button className="btn-sm btn-view" onClick={onVerLista}>
            📋 Ver na lista
          </button>
        </div>
      </div>
    </div>
  )
}
