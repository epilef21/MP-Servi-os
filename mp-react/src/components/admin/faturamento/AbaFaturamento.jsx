// ============================================================
// ABA FATURAMENTO — fila de faturamento por seguradora
// Mapfre/Allianz/Mondial: itens SEPARADOS de mão de obra + deslocamento (por código)
// Tempo/Maxpar: item único por OS pelo nº da assistência (sem código)
// A fila é a ÚNICA fonte de gravação do checklist "lançado no portal" (fat_lancado_*)
// ============================================================
import { useState, useMemo, useEffect } from 'react'
import { db, collection, addDoc, getDocs, updateDoc, doc, query, orderBy, serverTimestamp, atualizarOS } from '../../../firebase.js'
import { useAdminContext } from '../../../contexts/AdminContext.jsx'
import { fmtBRL } from '../../../utils/formatters.js'
import { copyToClipboard } from '../../../utils/clipboard.js'
import { SEGS_COM_CODIGO, SEGS_AUTO_NUM_ASSIST, STATUS_FATURAVEIS, getDivergenciaFat } from '../../../utils/faturamento.js'
import ModalFecharNota from './ModalFecharNota.jsx'

export default function AbaFaturamento() {
  const { empresaId, reports, setReports, showToast, config } = useAdminContext()
  const [segSel, setSegSel] = useState('Mapfre')
  const [notas, setNotas] = useState([])
  const [showFechar, setShowFechar] = useState(false)
  const [salvandoNota, setSalvandoNota] = useState(false)

  // Carrega as notas fiscais da empresa ao trocar de empresa.
  useEffect(() => {
    if (!empresaId) return
    getDocs(query(collection(db, `empresas/${empresaId}/notasFiscais`), orderBy('criado_em', 'desc')))
      .then(s => setNotas(s.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(e => showToast('Erro ao carregar notas: ' + e.message, 'error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId])

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

  // Itens já lançados no portal e ainda não vinculados a nenhuma nota — prontos para fechar nota.
  const lancadosPendentes = fila.filter(i => i.lancado)

  // Marca/desmarca "lançado no portal" — grava direto no doc da OS por tipo de item.
  // A fila é a ÚNICA fonte de escrita de fat_lancado_* (o modal do Plano 02 só lê).
  async function toggleLancado(item) {
    if (item.lancado && !window.confirm('Desmarcar este item como lançado?')) return
    const novoValor = item.lancado ? null : serverTimestamp()
    const novoLocal = item.lancado ? null : new Date()
    let payload, patchLocal
    if (item.tipo === 'mo') {
      // migração definitiva: grava o campo granular novo e limpa o rastro legado
      payload    = { fat_lancado_mo_em: novoValor, fat_lancado_em: null }
      patchLocal = { fat_lancado_mo_em: novoLocal, fat_lancado_em: null }
    } else if (item.tipo === 'desloc') {
      payload    = { fat_lancado_desloc_em: novoValor }
      patchLocal = { fat_lancado_desloc_em: novoLocal }
    } else {
      payload    = { fat_lancado_em: novoValor }
      patchLocal = { fat_lancado_em: novoLocal }
    }
    try {
      await atualizarOS(empresaId, item.osId, payload)
      setReports(p => p.map(r => r.id === item.osId ? { ...r, ...patchLocal } : r))
    } catch (e) { showToast('Erro: ' + e.message, 'error') }
  }

  // Valor editável (Tempo/Maxpar) — a OS é só sugestão, o valor confirmado é o que entra na nota.
  async function salvarValorFaturado(item, valorStr) {
    const valor = parseFloat(valorStr)
    if (isNaN(valor)) return
    try {
      await atualizarOS(empresaId, item.osId, { fat_valor_faturado: valor })
      setReports(p => p.map(r => r.id === item.osId ? { ...r, fat_valor_faturado: valor } : r))
      showToast('💰 Valor atualizado.')
    } catch (e) { showToast('Erro: ' + e.message, 'error') }
  }

  async function copiarCodigos() {
    const naoLancados = fila.filter(i => !i.lancado).map(i => i.codigo).join('\n')
    await copyToClipboard(naoLancados)
    showToast('📋 Códigos copiados!')
  }

  // Fecha a nota: grava em notasFiscais e vincula os itens lançados (que saem da fila).
  async function confirmarNota({ numero, dataEmissao, dataPrevista, dataPrevistaManual, total }) {
    setSalvandoNota(true)
    try {
      const itensSnap = lancadosPendentes.map(i => ({
        os_id: i.osId, tipo: i.tipo, codigo: i.codigo, valor: i.valorCodigo,
        num_assist: i.os.num_assist || '', nome_segurado: i.os.nome_segurado || '',
      }))
      const ref = await addDoc(collection(db, `empresas/${empresaId}/notasFiscais`), {
        seguradora: segSel, numero: numero.trim(), data_emissao: dataEmissao,
        data_prevista: dataPrevista || '', data_prevista_manual: !!dataPrevistaManual,
        total, itens: itensSnap, status: 'aguardando', pago_em: null,
        criado_em: serverTimestamp(),
      })
      // Vincular cada item à nota (sai da fila)
      const campoNota = t => t === 'mo' ? 'fat_nota_mo_id' : t === 'desloc' ? 'fat_nota_desloc_id' : 'fat_nota_id'
      await Promise.all(lancadosPendentes.map(i =>
        atualizarOS(empresaId, i.osId, { [campoNota(i.tipo)]: ref.id })
      ))
      setReports(p => p.map(r => {
        const meus = lancadosPendentes.filter(i => i.osId === r.id)
        if (!meus.length) return r
        const patch = {}; meus.forEach(i => { patch[campoNota(i.tipo)] = ref.id })
        return { ...r, ...patch }
      }))
      setNotas(prev => [{ id: ref.id, seguradora: segSel, numero: numero.trim(), data_emissao: dataEmissao, data_prevista: dataPrevista || '', total, itens: itensSnap, status: 'aguardando', pago_em: null }, ...prev])
      setShowFechar(false)
      showToast('🧾 Nota fechada!')
    } catch (e) { showToast('Erro ao fechar nota: ' + e.message, 'error') }
    finally { setSalvandoNota(false) }
  }

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
        <div style={{ display: 'flex', gap: 8 }}>
          {totalItens > 0 && (
            <button className="btn-sm btn-view" onClick={copiarCodigos}>📋 Copiar todos os códigos</button>
          )}
          <button className="btn-sm btn-primary" disabled={lancadosPendentes.length === 0} onClick={() => setShowFechar(true)}>
            🧾 Fechar nota com os {lancadosPendentes.length} itens lançados
          </button>
        </div>
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
            <input type="checkbox" checked={item.lancado} onChange={() => toggleLancado(item)} />
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
                  <input type="number" step="0.01" defaultValue={item.valorCodigo}
                    onBlur={e => salvarValorFaturado(item, e.target.value)}
                    style={{ width: 100, textAlign: 'right' }} />
                  <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>a OS diz {fmtBRL(item.valorSugerido)}</div>
                </>
              )}
            </div>
          </div>
        )
      })}

      {showFechar && (
        <ModalFecharNota seguradora={segSel} itens={lancadosPendentes} config={config}
          salvando={salvandoNota} onConfirmar={confirmarNota} onFechar={() => setShowFechar(false)} />
      )}
    </div>
  )
}
