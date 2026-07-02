// ============================================================
// ABA FATURAMENTO — fila de faturamento por seguradora
// Mapfre/Allianz/Mondial: itens SEPARADOS de mão de obra + deslocamento (por código)
// Tempo/Maxpar: item único por OS pelo nº da assistência (sem código)
// A fila é a ÚNICA fonte de gravação do checklist "lançado no portal" (fat_lancado_*)
// ============================================================
import { useState, useMemo } from 'react'
import { atualizarOS, serverTimestamp } from '../../../firebase.js'
import { useAdminContext } from '../../../contexts/AdminContext.jsx'
import { fmtBRL } from '../../../utils/formatters.js'
import { SEGS_COM_CODIGO, SEGS_AUTO_NUM_ASSIST, STATUS_FATURAVEIS, getDivergenciaFat } from '../../../utils/faturamento.js'

export default function AbaFaturamento() {
  const { empresaId, reports, setReports, showToast } = useAdminContext()
  const [segSel, setSegSel] = useState('Mapfre')

  // Seguradoras disponíveis no seletor: lista fixa conhecida + o que existir em reports
  const seguradoras = useMemo(() => {
    const doReports = new Set(
      reports.filter(r => STATUS_FATURAVEIS.includes(r.status)).map(r => r.seguradora).filter(Boolean)
    )
    return [...new Set([...SEGS_COM_CODIGO, ...SEGS_AUTO_NUM_ASSIST, ...doReports])]
  }, [reports])

  const comCodigo = SEGS_COM_CODIGO.includes(segSel)

  // Fila derivada de reports para a seguradora selecionada.
  // Um item só entra se ainda NÃO estiver vinculado a nenhuma nota (fat_nota_*_id vazio).
  const fila = useMemo(() => {
    const finalizadas = reports.filter(r =>
      r.seguradora === segSel && STATUS_FATURAVEIS.includes(r.status)
    )
    const itens = []
    for (const os of finalizadas) {
      if (SEGS_COM_CODIGO.includes(segSel)) {
        // legado: fat_codigo/fat_valor_aprovado (modal pré-Fase 7) equivalem ao código/valor de MO
        const codigoMo = os.fat_codigo_mo || os.fat_codigo || ''
        const valorMo  = os.fat_valor_mo ?? os.fat_valor_aprovado

        if (codigoMo && !os.fat_nota_mo_id) {
          // MIGRAÇÃO: OS antiga marcada só com fat_lancado_em (botão do modal antigo) conta como MO lançada
          const lancadoLegado = !os.fat_lancado_mo_em && !!os.fat_lancado_em
          itens.push({
            key: os.id + ':mo', osId: os.id, os, tipo: 'mo',
            codigo: codigoMo, valorCodigo: parseFloat(valorMo) || 0,
            valorOS: parseFloat(os.mo_seguradora) || 0,
            lancado: !!(os.fat_lancado_mo_em || os.fat_lancado_em),
            lancadoLegado, seguradora: segSel,
          })
        }

        if (os.fat_codigo_desloc && !os.fat_nota_desloc_id) {
          itens.push({
            key: os.id + ':desloc', osId: os.id, os, tipo: 'desloc',
            codigo: os.fat_codigo_desloc, valorCodigo: parseFloat(os.fat_valor_desloc) || 0,
            valorOS: parseFloat(os.valor_deslocamento) || 0,
            lancado: !!os.fat_lancado_desloc_em, lancadoLegado: false, seguradora: segSel,
          })
        }
      } else if (SEGS_AUTO_NUM_ASSIST.includes(segSel)) {
        // Tempo/Maxpar: um item único por OS pelo num_assist, sem código
        if (!os.fat_nota_id) {
          const sugerido = (parseFloat(os.mo_seguradora) || 0) + (parseFloat(os.valor_deslocamento) || 0)
          itens.push({
            key: os.id + ':single', osId: os.id, os, tipo: 'single',
            codigo: os.num_assist || '—',
            valorCodigo: (os.fat_valor_faturado != null ? parseFloat(os.fat_valor_faturado) : sugerido),
            valorSugerido: sugerido, valorOS: sugerido,
            lancado: !!os.fat_lancado_em, lancadoLegado: false, seguradora: segSel,
          })
        }
      }
    }
    return itens
  }, [reports, segSel])

  const lancadosCount = fila.filter(i => i.lancado).length
  const totalItens = fila.length
  const somaValores = fila.reduce((acc, i) => acc + (i.valorCodigo || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <h4 style={{ fontFamily: 'Barlow Condensed,sans-serif', fontSize: '.95rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>
          📄 Fila de Faturamento
        </h4>
        <select className="filter-input" value={segSel} onChange={e => setSegSel(e.target.value)}>
          {seguradoras.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: '.85rem', color: 'var(--muted)' }}>
          {lancadosCount} lançados ✓ · {totalItens - lancadosCount} faltando
        </div>
        <div style={{ fontWeight: 700 }}>Total da fila: {fmtBRL(somaValores)}</div>
      </div>

      {totalItens === 0 && (
        <div className="empty-state" style={{ padding: '24px' }}>
          <p>Nenhum item finalizado pendente de faturamento para {segSel}.</p>
        </div>
      )}

      {fila.map(item => {
        const divergencia = comCodigo ? getDivergenciaFat(item.valorCodigo, item.valorOS) : null
        return (
          <div key={item.key} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
            border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8,
          }}>
            {/* Persistência real do checklist entra na Task 2 (toggleLancado) */}
            <input type="checkbox" checked={item.lancado} onChange={() => {}} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>
                {item.os.num_assist ? `#${item.os.num_assist} — ` : ''}{item.os.nome_segurado || '—'}
                <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {item.os.cidade || '—'}</span>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '.85rem', color: 'var(--muted)' }}>
                {item.tipo === 'mo' ? 'Mão de obra' : item.tipo === 'desloc' ? 'Deslocamento' : 'Nº assistência'}: {item.codigo}
                {item.lancadoLegado && ' (legado)'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {comCodigo ? (
                <>
                  <div>{fmtBRL(item.valorCodigo)}</div>
                  <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>OS: {fmtBRL(item.valorOS)}</div>
                  {divergencia.bateu
                    ? <span className="badge" style={{ background: '#d7f5df', color: '#1e6e3e' }}>✓ bate</span>
                    : <span className="badge" style={{ background: '#ffe0e0', color: '#a30000' }}>⚠ difere {fmtBRL(Math.abs(divergencia.diff))}</span>}
                </>
              ) : (
                <>
                  {/* Input editável entra na Task 2 (salvarValorFaturado) — por ora só a sugestão */}
                  <div>{fmtBRL(item.valorCodigo)}</div>
                  <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>a OS diz {fmtBRL(item.valorSugerido)}</div>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
