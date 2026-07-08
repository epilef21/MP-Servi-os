// ============================================================
// MODAL FECHAR NOTA — fecha o ciclo de faturamento de uma seguradora
// Informa nº da fatura + data de emissão, calcula/mostra a data prevista
// de pagamento pelo calendário (FAT-07), avisa e bloqueia no período
// não faturável da Allianz/Mondial 26-31 (FAT-08), e pede data manual
// quando a seguradora ainda não tem calendário cadastrado (Tempo/Maxpar).
// ============================================================
import { useState, useMemo } from 'react'
import { calcularDataPrevista } from '../../../utils/faturamento.js'
import { fmtBRL, fmtDate } from '../../../utils/formatters.js'
import { ReceiptText, X, Ban, Wallet, Hourglass, CheckCircle2 } from 'lucide-react'

function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ModalFecharNota({ seguradora, itens, config, onConfirmar, onFechar, salvando }) {
  const [numero, setNumero] = useState('')
  const [dataEmissao, setDataEmissao] = useState(hojeISO())
  const [dataManual, setDataManual] = useState('')

  const total = useMemo(() => itens.reduce((a, i) => a + (i.valorCodigo || 0), 0), [itens])
  const prev = useMemo(() => calcularDataPrevista(seguradora, dataEmissao, config), [seguradora, dataEmissao, config])

  const desabilitado = salvando || !numero.trim() || prev.naoFaturavel || (prev.semCalendario && !dataManual)

  function confirmar() {
    if (desabilitado) return
    onConfirmar({
      numero, dataEmissao,
      dataPrevista: prev.semCalendario ? dataManual : prev.data,
      dataPrevistaManual: prev.semCalendario,
      total,
    })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="modal-box" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2><ReceiptText size={16} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 6 }} />Fechar nota — {seguradora}</h2>
          <button className="btn-sm" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={onFechar}><X size={16} strokeWidth={2} /></button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: 14, fontWeight: 700 }}>
            Total: {fmtBRL(total)} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>({itens.length} itens)</span>
          </div>

          <div className="row col-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Número da fatura <span className="req">*</span></label>
              <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ex: 81" />
            </div>
            <div className="field">
              <label>Data de emissão</label>
              <input type="date" value={dataEmissao} onChange={e => setDataEmissao(e.target.value)} />
            </div>
          </div>

          {prev.naoFaturavel && (
            <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: '#fdecea', color: '#c0392b', fontWeight: 600 }}>
              <Ban size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />A {seguradora} não fatura notas emitidas entre os dias 26 e 31 — escolha outra data de emissão.
            </div>
          )}

          {!prev.naoFaturavel && prev.semCalendario && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ marginBottom: 8, color: 'var(--muted)', fontSize: '.85rem' }}>
                Esta seguradora ainda não tem calendário cadastrado — informe a data prevista.
              </div>
              <div className="field">
                <label>Data prevista de pagamento <span className="req">*</span></label>
                <input type="date" value={dataManual} onChange={e => setDataManual(e.target.value)} />
              </div>
            </div>
          )}

          {!prev.naoFaturavel && !prev.semCalendario && (
            <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: '#e8f5e9', color: '#1e6e3e', fontWeight: 600 }}>
              <Wallet size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />Pagamento previsto para {fmtDate(prev.data)}
            </div>
          )}

          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: 6 }}>Itens desta nota:</div>
            {itens.map(i => (
              <div key={i.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', padding: '4px 0', borderBottom: '1px dashed var(--border)' }}>
                <span style={{ fontFamily: 'monospace' }}>{i.codigo}</span>
                <span>{fmtBRL(i.valorCodigo)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-sm" style={{ background: 'var(--light)', color: 'var(--muted)', border: '1px solid var(--border)' }} onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" style={{ padding: '9px 22px', fontSize: '.9rem' }} disabled={desabilitado} onClick={confirmar}>
            {salvando ? <><Hourglass size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />Fechando...</> : <><CheckCircle2 size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />Fechar nota</>}
          </button>
        </div>
      </div>
    </div>
  )
}
