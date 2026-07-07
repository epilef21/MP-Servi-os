// ============================================================
// ABA TÉCNICOS — fechamento mensal de pagamento por técnico
// TEC-02: total a pagar por técnico, lista de OS (valor_prestador),
// chave PIX copiável e selo PAGO/PENDENTE derivado dos fechamentos já
// gravados. TEC-03: marcar fechamento como pago (snapshot imutável
// os_ids/total/qtd_os) e histórico consultável de pagamentos.
// ============================================================
import { useState, useEffect, useMemo } from 'react'
import { db, collection, getDocs, query, orderBy, addDoc, serverTimestamp } from '../../../firebase.js'
import { useAdminContext } from '../../../contexts/AdminContext.jsx'
import { fmtBRL, fmtDate } from '../../../utils/formatters.js'
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

export default function AbaFechamentoTecnicos({ mesRef, mesFechado }) {
  const { empresaId, tecnicos, reports, showToast } = useAdminContext()
  const [fechamentos, setFechamentos] = useState([])
  const [pagando, setPagando] = useState(null)  // tecnicoNorm em processamento

  // Carrega os fechamentos já gravados da empresa ao trocar de empresa.
  useEffect(() => {
    if (!empresaId) return
    getDocs(query(collection(db, `empresas/${empresaId}/fechamentosTecnicos`), orderBy('criado_em', 'desc')))
      .then(s => setFechamentos(s.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(e => showToast('Erro ao carregar fechamentos: ' + e.message, 'error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId])

  const grupos = useMemo(() => agruparPorTecnico(reports, mesRef), [reports, mesRef])

  // Histórico de TODOS os fechamentos já pagos (qualquer mês), para consulta
  // posterior (TEC-03) — ordenado por mês desc, depois por nome do técnico.
  const historico = useMemo(() =>
    [...fechamentos].sort((a, b) =>
      (b.mes_referencia || '').localeCompare(a.mes_referencia || '') ||
      (a.tecnico || '').localeCompare(b.tecnico || '')
    ), [fechamentos])

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

  function hojeISO() {
    const h = new Date()
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`
  }

  // Marca o fechamento do técnico como pago: grava snapshot imutável
  // (os_ids + total da época, vindos do GRUPO — nunca da OS direta) e
  // bloqueia pagamento duplo no mesmo mês (T-08-09, client-side — T-08-12).
  async function marcarPago(g) {
    if (mesFechado) { showToast('Mês fechado — reabra para alterar.', 'error'); return }
    if (acharFechamento(fechamentos, g.tecnicoNorm, mesRef)) {
      showToast('Este técnico já foi pago neste mês.', 'error'); return
    }
    const dataPagto = window.prompt('Data do pagamento (AAAA-MM-DD):', hojeISO())
    if (!dataPagto) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataPagto)) { showToast('Data inválida. Use AAAA-MM-DD.', 'error'); return }
    if (!window.confirm(`Confirmar pagamento de ${g.tecnicoNome}: ${fmtBRL(g.total)} (${g.count} OS)?`)) return
    setPagando(g.tecnicoNorm)
    try {
      const payload = {
        tecnico: g.tecnicoNome, tecnico_norm: g.tecnicoNorm, mes_referencia: mesRef,
        os_ids: g.osList.map(o => o.id), total: g.total, qtd_os: g.count,
        status: 'pago', pago_em: dataPagto, criado_em: serverTimestamp(),
      }
      const ref = await addDoc(collection(db, `empresas/${empresaId}/fechamentosTecnicos`), payload)
      // atualização local (evita novo fetch) — mesmo padrão de AbaFaturamento
      setFechamentos(prev => [{ id: ref.id, ...payload }, ...prev])
      showToast('💵 Fechamento pago e registrado!')
    } catch (e) { showToast('Erro ao registrar pagamento: ' + e.message, 'error') }
    finally { setPagando(null) }
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

            <div style={{ marginTop: 12, textAlign: 'right' }}>
              {pago ? (
                <span style={{ fontSize: '.85rem', color: 'var(--muted)' }}>✅ Pago em {fmtDate(fech.pago_em)}</span>
              ) : (
                <button
                  className="btn-sm btn-primary"
                  disabled={pagando === g.tecnicoNorm || g.tecnicoNorm === '' || mesFechado}
                  title={mesFechado ? 'Mês fechado' : (g.tecnicoNorm === '' ? 'OS sem técnico não podem ser pagas' : '')}
                  onClick={() => marcarPago(g)}
                >
                  {pagando === g.tecnicoNorm ? '⏳ Registrando...' : '💵 Marcar como pago'}
                </button>
              )}
            </div>
          </div>
        )
      })}

      <h4 style={{ fontFamily: 'Barlow Condensed,sans-serif', fontSize: '.95rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', margin: '22px 0 12px' }}>
        🗂️ Histórico de pagamentos
      </h4>
      {historico.length === 0 && (
        <div className="empty-state" style={{ padding: 24 }}>
          <p>Nenhum pagamento registrado ainda.</p>
        </div>
      )}
      {historico.map(f => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontWeight: 600 }}>{f.tecnico}</div>
            <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>
              Ref. {f.mes_referencia} · {f.qtd_os} OS · Pago em {fmtDate(f.pago_em)}
            </div>
          </div>
          <div style={{ fontWeight: 700 }}>{fmtBRL(f.total)}</div>
          <span className="badge" style={{ background: '#e8f5e9', color: '#1e6e3e' }}>✅ Pago</span>
        </div>
      ))}
    </div>
  )
}
