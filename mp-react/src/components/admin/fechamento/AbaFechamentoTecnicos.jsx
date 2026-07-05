// ============================================================
// ABA TÉCNICOS — fechamento mensal de pagamento por técnico
// Visão de leitura (TEC-02): total a pagar por técnico, lista de OS
// (valor_prestador), chave PIX copiável e selo PAGO/PENDENTE derivado
// dos fechamentos já gravados. Marcar como pago + histórico: plano 08-04.
// ============================================================
import { useState, useEffect, useMemo } from 'react'
import { db, collection, getDocs, query, orderBy } from '../../../firebase.js'
import { useAdminContext } from '../../../contexts/AdminContext.jsx'
import { fmtBRL } from '../../../utils/formatters.js'
import { copyToClipboard } from '../../../utils/clipboard.js'
import { agruparPorTecnico, acharFechamento, statusFechamento, normNome } from '../../../utils/fechamentoTecnicos.js'

const MESES_NOMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

function fmtMes(mesRef) {
  const [ano, mes] = mesRef.split('-').map(Number)
  return `${MESES_NOMES[mes - 1]} de ${ano}`
}

const LABEL_FORMA = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
}

export default function AbaFechamentoTecnicos({ mesRef }) {
  const { empresaId, tecnicos, reports, showToast } = useAdminContext()
  const [fechamentos, setFechamentos] = useState([])

  // Carrega os fechamentos já gravados da empresa ao trocar de empresa.
  useEffect(() => {
    if (!empresaId) return
    getDocs(query(collection(db, `empresas/${empresaId}/fechamentosTecnicos`), orderBy('criado_em', 'desc')))
      .then(s => setFechamentos(s.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(e => showToast('Erro ao carregar fechamentos: ' + e.message, 'error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId])

  const grupos = useMemo(() => agruparPorTecnico(reports, mesRef), [reports, mesRef])

  // Join grupo (OS do mês) ↔ cadastro de técnicos: por tecnico_id primeiro
  // (grupos vindos de OS com técnico selecionado do cadastro têm tecnicoId),
  // com fallback por nome normalizado (OS com técnico digitado manualmente).
  const infoTecnico = useMemo(() => {
    const porId = {}, porNome = {}
    ;(tecnicos || []).forEach(t => {
      const info = { pix: t.chave_pix || '', forma: t.forma_pagamento || 'pix' }
      if (t.id) porId[t.id] = info
      porNome[normNome(t.nome)] = info
    })
    return g => (g.tecnicoId && porId[g.tecnicoId]) || porNome[g.tecnicoNorm] || { pix: '', forma: 'pix' }
  }, [tecnicos])

  async function copiarPix(pix) {
    await copyToClipboard(pix)
    showToast('📋 Chave PIX copiada!')
  }

  return (
    <div>
      <h4 style={{ fontFamily: 'Barlow Condensed,sans-serif', fontSize: '.95rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: 12 }}>
        👷 Fechamento de Técnicos — {fmtMes(mesRef)}
      </h4>

      {grupos.length === 0 && (
        <div className="empty-state" style={{ padding: '24px' }}>
          <p>Nenhuma OS com técnico neste mês.</p>
          <p style={{ fontSize: '.85rem', color: 'var(--muted)', marginTop: 8 }}>
            As OS entram pelo mês de criação — navegue com ◄ ► para outro mês.
          </p>
        </div>
      )}

      {grupos.map(g => {
        const fech = acharFechamento(fechamentos, g.tecnicoNorm, mesRef)
        const status = statusFechamento(fech)
        const info = infoTecnico(g)
        const total = fech?.total ?? g.total
        const qtd = fech?.qtd_os ?? g.count
        const pago = status === 'pago'

        return (
          <div key={g.tecnicoNorm} style={{
            border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontFamily: 'Barlow Condensed,sans-serif', fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary)' }}>
                  {g.tecnicoNome}
                </div>
                <div style={{ fontSize: '.85rem', color: 'var(--muted)' }}>{qtd} OS</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{fmtBRL(total)}</div>
                <span className="badge" style={{
                  background: pago ? '#e8f5e9' : '#fff8e1',
                  color: pago ? '#1e6e3e' : '#b8860b',
                }}>
                  {pago ? '✅ PAGO' : '⏳ PENDENTE'}
                </span>
              </div>
            </div>

            {info.pix && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '.85rem' }}>{info.pix}</span>
                <button className="btn-sm btn-view" onClick={() => copiarPix(info.pix)}>📋 Copiar PIX</button>
                <span style={{ fontSize: '.8rem', color: 'var(--muted)' }}>{LABEL_FORMA[info.forma] || info.forma}</span>
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              {g.osList.map(os => (
                <div key={os.id} style={{
                  display: 'flex', justifyContent: 'space-between', fontSize: '.85rem',
                  padding: '6px 0', borderTop: '1px solid var(--border)',
                }}>
                  <span>#{os.num_assist || '—'} — {os.nome_segurado || '—'} · {os.cidade || '—'}</span>
                  <span>{fmtBRL(parseFloat(os.valor_prestador) || 0)}</span>
                </div>
              ))}
            </div>

            {/* marcar pago + histórico: plano 08-04 */}
          </div>
        )
      })}

      {/* marcar pago + histórico: plano 08-04 */}
    </div>
  )
}
