// ============================================================
// MODAL: REVISAR ORÇAMENTO — extraído do AdminPage.jsx
// Admin revisa itens, divisão seguradora/cliente e envia ao cliente.
// ============================================================
import { useState } from 'react'
import { db, doc, updateDoc } from '../../firebase.js'
import { useAdminContext } from '../../contexts/AdminContext.jsx'
import { STATUS_ORC_META } from './OrcamentosTab.jsx'
import { fmtDate, fmtBRL } from '../../utils/formatters.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export function novoItemOrc() {
  return {
    id: `item_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    descricao: '', quantidade: 1,
    valor_unit: 0, valor_total: 0,
    paga_seguradora: 0, paga_cliente: 0,
  }
}

export default function RevisarOrcamentoModal({ orc: initialOrc, onClose }) {
  const {
    empresaId, config,
    setOrcamentos, showToast, buildLinkTecnicoOrc, buildLinkClienteOrc,
    handlePDFCliente, handlePDFSeguradora, abrirConverterOS,
  } = useAdminContext()

  const [orc,           setOrc]           = useState(initialOrc)
  const [revisarItens,  setRevisarItens]  = useState(() =>
    (initialOrc.itens?.length ? initialOrc.itens : [novoItemOrc()]).map(it => ({ ...it }))
  )
  const [savingRevisar, setSavingRevisar] = useState(false)
  const [orcGarantiaObs, setOrcGarantiaObs] = useState(initialOrc.garantia_obs || '')
  const [copied,        setCopied]        = useState(false)

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
        const cenario = orc?.cenario || 'particular'
        if (cenario === 'particular' || cenario === 'fora_contrato') {
          updated.paga_cliente    = updated.valor_total
          updated.paga_seguradora = 0
        }
      }
      return updated
    }))
  }

  async function copyOrcLink(link) {
    await copyToClipboard(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // Salva revisão (admin edita itens e divisão)
  async function saveRevisarOrcamento() {
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
      await updateDoc(doc(db, `empresas/${empresaId}/orcamentos`, orc.id), payload)
      setOrcamentos(p => p.map(o => o.id === orc.id ? { ...o, ...payload } : o))
      setOrc(p => ({ ...p, ...payload }))
      showToast('✅ Orçamento salvo!')
    } catch (e) { showToast('Erro: ' + e.message, 'error') }
    finally { setSavingRevisar(false) }
  }

  // Envia link do orçamento para o cliente via WhatsApp
  async function enviarLinkCliente() {
    try {
      await updateDoc(doc(db, `empresas/${empresaId}/orcamentos`, orc.id), { status: 'enviado_cliente' })
      setOrcamentos(p => p.map(o => o.id === orc.id ? { ...o, status: 'enviado_cliente' } : o))
      setOrc(p => ({ ...p, status: 'enviado_cliente' }))

      const link       = buildLinkClienteOrc(orc.id)
      const telCliente = (orc.tel_cliente || '').replace(/\D/g, '')
      const msg = `Olá ${orc.nome_cliente || ''}! 😊\nSeu orçamento está pronto para análise.\n\n📋 Orçamento: ${orc.numero}\n🔧 Serviço: ${orc.tipo_equipamento || orc.tipo || '—'} ${orc.marca || ''}\n💰 Valor: ${fmtBRL(orc.total_cliente || orc.total_geral || 0)}\n✅ Garantia: ${orc.garantia || '—'}\n⏱️ Prazo: ${orc.prazo_execucao || '—'}\n\nPara visualizar e aprovar, clique no link:\n🔗 ${link}\n\nDúvidas? Entre em contato:\n📞 ${config?.telefone || ''}`
      const waUrl = telCliente
        ? `https://wa.me/55${telCliente}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`
      window.open(waUrl, '_blank')
      showToast('📤 Link enviado ao cliente!')
    } catch (e) { showToast('Erro: ' + e.message, 'error') }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth:760 }}>
        <div className="modal-header">
          <h2>{orc.status === 'em_revisao' ? '✏️ Revisão' : '👁️ Orçamento'} — {orc.numero}</h2>
          <div className="modal-header-btns">
            <span className={`badge ${STATUS_ORC_META[orc.status]?.cls || 'orc-aguardando'}`}>
              {STATUS_ORC_META[orc.status]?.label || ''}
            </span>
            {orc.status === 'aprovado' && !orc.os_vinculada && (
              <button className="btn-sm btn-ok" onClick={() => abrirConverterOS(orc)}>🚀 Converter em OS</button>
            )}
            {(orc.status === 'aprovado' || orc.status === 'executado') && (
              <button className="btn-sm btn-pdf" onClick={() => handlePDFCliente(orc)}>📄 PDF Cliente</button>
            )}
            {orc.total_seguradora > 0 && (
              <button className="btn-sm btn-pdf" style={{ background:'#6c3483' }} onClick={() => handlePDFSeguradora(orc)}>📋 PDF Seg.</button>
            )}
            <button className="btn-sm" style={{ background:'rgba(255,255,255,.15)', color:'#fff' }} onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="modal-body">

          {/* Banner aprovado */}
          {orc.status === 'aguardando_tecnico' && (
            <div className="link-tecnico-box">
              <div className="ltb-title">👷 Link do Técnico</div>
              <div className="ltb-url">{buildLinkTecnicoOrc(orc.id)}</div>
              <div className="ltb-btns">
                <button className="btn-copy" onClick={() => copyOrcLink(buildLinkTecnicoOrc(orc.id))}>
                  {copied ? '✅ Copiado!' : '📋 Copiar link'}
                </button>
                {orc.tecnico_tel && (
                  <a className="btn-whatsapp" target="_blank" rel="noopener noreferrer"
                    href={`https://wa.me/55${orc.tecnico_tel.replace(/\D/g,'')}?text=${encodeURIComponent(`Olá ${orc.tecnico_nome||'Técnico'}! 👷\nNovo orçamento para avaliar no local:\n🔗 ${buildLinkTecnicoOrc(orc.id)}`)}`}>
                    📲 WhatsApp
                  </a>
                )}
              </div>
            </div>
          )}

          {orc.status === 'aprovado' && (
            <div className="orc-aprovado-banner">
              <h3>🎉 Aprovado por {orc.aprovado_por}!</h3>
              <p>Assinado em: {fmtDate(orc.aprovado_em)}</p>
            </div>
          )}

          {/* Dados do cliente */}
          <div className="md-section">
            <h3>👤 Cliente</h3>
            <div className="md-grid">
              <div className="md-field"><label>Nome</label><p>{orc.nome_cliente || '—'}</p></div>
              <div className="md-field"><label>Telefone</label><p>{orc.tel_cliente || '—'}</p></div>
              <div className="md-field"><label>Endereço</label><p>{orc.endereco || '—'}</p></div>
              <div className="md-field"><label>Cidade</label><p>{orc.cidade || '—'}</p></div>
            </div>
          </div>

          {/* Diagnóstico do técnico */}
          {orc.diagnostico && (
            <div className="md-section">
              <h3>🔍 Diagnóstico do Técnico</h3>
              <div className="md-text">{orc.diagnostico}</div>
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
                    {orc.status === 'em_revisao' && <th style={{ width:'8%' }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {revisarItens.map(it => (
                    <tr key={it.id}>
                      <td>
                        {orc.status === 'em_revisao'
                          ? <input type="text" value={it.descricao} onChange={e => updateItemRevisar(it.id, 'descricao', e.target.value)} placeholder="Descrição" />
                          : it.descricao}
                      </td>
                      <td>
                        {orc.status === 'em_revisao'
                          ? <input type="number" min="1" style={{ width:60 }} value={it.quantidade} onChange={e => updateItemRevisar(it.id, 'quantidade', e.target.value)} />
                          : it.quantidade}
                      </td>
                      <td>
                        {orc.status === 'em_revisao'
                          ? <input type="text" inputMode="decimal" value={it.valor_unit} onChange={e => updateItemRevisar(it.id, 'valor_unit', e.target.value)} placeholder="0,00" />
                          : fmtBRL(it.valor_unit)}
                      </td>
                      <td style={{ fontWeight:700 }}>{fmtBRL(it.valor_total || (parseFloat(it.valor_unit)||0) * (parseInt(it.quantidade)||1))}</td>
                      {orc.status === 'em_revisao' && (
                        <td><button className="btn-remove-item" onClick={() => removeItemRevisar(it.id)}>✕</button></td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {orc.status === 'em_revisao' && (
              <button className="btn-add-item" onClick={addItemRevisar}>＋ Adicionar item</button>
            )}

            <div className="orc-subtotal">
              Total: {fmtBRL(revisarItens.reduce((acc,it) => acc + (parseFloat(it.valor_total) || parseFloat(it.valor_unit)||0 * parseInt(it.quantidade)||1), 0))}
            </div>
          </div>

          {/* Divisão seguradora/cliente (se cenario != particular) */}
          {orc.status === 'em_revisao' && orc.cenario && orc.cenario !== 'particular' && revisarItens.length > 0 && (
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
              <div className="md-field"><label>Garantia</label><p>{orc.garantia || '—'}</p></div>
              <div className="md-field"><label>Prazo</label><p>{orc.prazo_execucao || '—'}</p></div>
              <div className="md-field"><label>Pagamento</label><p>{orc.forma_pagamento || '—'}</p></div>
              <div className="md-field"><label>Válido até</label><p>{fmtDate(orc.validade)}</p></div>
            </div>
          </div>

          {/* Nota de garantia (editável) */}
          {orc.status === 'em_revisao' && (
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
            onClick={onClose}>Fechar</button>
          {orc.status === 'em_revisao' && (
            <>
              <button className="btn-sm btn-view" onClick={saveRevisarOrcamento} disabled={savingRevisar}>
                {savingRevisar ? '⏳...' : '💾 Salvar'}
              </button>
              <button className="btn-sm btn-ok" onClick={enviarLinkCliente}>
                📲 Enviar ao Cliente
              </button>
              <button className="btn-sm btn-pdf" style={{ background:'#6c3483' }} onClick={() => handlePDFSeguradora(orc)}>
                🖨️ PDF Seguradora
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
