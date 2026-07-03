// ============================================================
// ABA FATURAMENTO — fila de faturamento por seguradora
// Mapfre/Allianz/Mondial: itens SEPARADOS de mão de obra + deslocamento (por código)
// Tempo/Maxpar: item único por OS pelo nº da assistência (sem código)
// A fila é a ÚNICA fonte de gravação do checklist "lançado no portal" (fat_lancado_*)
// ============================================================
import { useState, useMemo, useEffect } from 'react'
import { db, collection, addDoc, getDocs, updateDoc, doc, query, orderBy, serverTimestamp, atualizarOS } from '../../../firebase.js'
import { useAdminContext } from '../../../contexts/AdminContext.jsx'
import { fmtBRL, fmtDate } from '../../../utils/formatters.js'
import { copyToClipboard } from '../../../utils/clipboard.js'
import { SEGS_COM_CODIGO, SEGS_AUTO_NUM_ASSIST, STATUS_FATURAVEIS, getDivergenciaFat, normSeguradora } from '../../../utils/faturamento.js'
import ModalFecharNota from './ModalFecharNota.jsx'

// Status derivado da nota — 'atrasada' NUNCA é gravado, só calculado na leitura.
function statusNota(nota) {
  if (nota.status === 'paga') return 'paga'
  const hoje = new Date()
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
  if (nota.data_prevista && nota.data_prevista < hojeStr) return 'atrasada'
  return 'aguardando'
}
const STATUS_NOTA_META = {
  aguardando: { label: '⏳ Aguardando pagamento', cor: '#b8860b', bg: '#fff8e1' },
  paga:       { label: '✅ Paga',                  cor: '#1e6e3e', bg: '#e8f5e9' },
  atrasada:   { label: '🔴 Atrasada',              cor: '#c0392b', bg: '#fdecea' },
}

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
    const lista = [...SEGS_COM_CODIGO, ...SEGS_AUTO_NUM_ASSIST]
    const conhecidas = new Set(lista.map(normSeguradora))
    for (const r of reports) {
      if (!r.seguradora) continue
      const norm = normSeguradora(r.seguradora)
      if (!conhecidas.has(norm)) {
        conhecidas.add(norm)
        lista.push(String(r.seguradora).trim())
      }
    }
    return lista
  }, [reports])

  const comCodigo = SEGS_COM_CODIGO.includes(segSel)

  // OS da seguradora selecionada (comparação tolerante a maiúsculas/espaços —
  // os portais gravam "MAPFRE", "Mapfre " etc.)
  const osDaSeguradora = useMemo(() =>
    reports.filter(r => normSeguradora(r.seguradora) === normSeguradora(segSel)),
  [reports, segSel])

  // Fila derivada de reports para a seguradora selecionada.
  // Um item só entra se ainda NÃO estiver vinculado a nenhuma nota (fat_nota_*_id vazio).
  const fila = useMemo(() => {
    const finalizadas = osDaSeguradora.filter(r => STATUS_FATURAVEIS.includes(r.status))
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
  }, [osDaSeguradora, segSel])

  // Diagnóstico da fila vazia: explica POR QUE cada OS da seguradora não entrou
  const diagnostico = useMemo(() => {
    const naoFinalizadas = osDaSeguradora.filter(r => !STATUS_FATURAVEIS.includes(r.status)).length
    const finalizadas = osDaSeguradora.filter(r => STATUS_FATURAVEIS.includes(r.status))
    const semCodigo = SEGS_COM_CODIGO.includes(segSel)
      ? finalizadas.filter(os => !(os.fat_codigo_mo || os.fat_codigo) && !os.fat_nota_mo_id).length
      : 0
    const jaFaturadas = finalizadas.filter(os =>
      SEGS_COM_CODIGO.includes(segSel) ? !!os.fat_nota_mo_id : !!os.fat_nota_id
    ).length
    return { totalSeg: osDaSeguradora.length, naoFinalizadas, semCodigo, jaFaturadas }
  }, [osDaSeguradora, segSel])

  const lancadosCount = fila.filter(i => i.lancado).length
  const totalItens = fila.length
  const somaValores = fila.reduce((acc, i) => acc + (i.valorCodigo || 0), 0)

  // Itens já lançados no portal e ainda não vinculados a nenhuma nota — prontos para fechar nota.
  const lancadosPendentes = fila.filter(i => i.lancado)

  // Painel-resumo: total a receber por seguradora (notas não pagas), com a data prevista mais próxima.
  const aReceber = useMemo(() => {
    const m = {}
    notas.filter(n => n.status !== 'paga').forEach(n => {
      if (!m[n.seguradora]) m[n.seguradora] = { total: 0, proxData: null }
      m[n.seguradora].total += (n.total || 0)
      if (n.data_prevista && (!m[n.seguradora].proxData || n.data_prevista < m[n.seguradora].proxData)) {
        m[n.seguradora].proxData = n.data_prevista
      }
    })
    return m
  }, [notas])

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

  // Marca a nota como paga e quita TODAS as OS vinculadas de uma vez (FAT-10).
  async function marcarNotaPaga(nota) {
    if (!window.confirm(`Marcar a nota ${nota.numero} como paga? Isso quita todas as ${nota.itens?.length || 0} OS vinculadas.`)) return
    const hoje = new Date()
    const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
    try {
      await updateDoc(doc(db, `empresas/${empresaId}/notasFiscais`, nota.id), { status: 'paga', pago_em: hojeStr })
      // Quitar as OS vinculadas (carimbo fat_pago_em) — de uma vez, via Promise.all
      await Promise.all((nota.itens || []).map(it => atualizarOS(empresaId, it.os_id, { fat_pago_em: hojeStr })))
      setNotas(prev => prev.map(n => n.id === nota.id ? { ...n, status: 'paga', pago_em: hojeStr } : n))
      setReports(p => p.map(r => (nota.itens || []).some(it => it.os_id === r.id) ? { ...r, fat_pago_em: hojeStr } : r))
      showToast('💵 Nota marcada como paga! OS vinculadas quitadas.')
    } catch (e) { showToast('Erro: ' + e.message, 'error') }
  }

  return (
    <div>
      {Object.keys(aReceber).length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 16, padding: '12px 14px',
          border: '1px solid var(--border)', borderRadius: 8, background: 'var(--light)',
        }}>
          <div style={{ fontWeight: 800, fontFamily: 'Barlow Condensed,sans-serif', textTransform: 'uppercase', color: 'var(--primary)' }}>
            💰 Total a receber por seguradora
          </div>
          {Object.entries(aReceber).map(([seg, info]) => (
            <div key={seg} style={{ fontSize: '.85rem' }}>
              <strong>{seg}:</strong> {fmtBRL(info.total)} {info.proxData ? `até ${fmtDate(info.proxData)}` : '(data manual pendente)'}
            </div>
          ))}
        </div>
      )}

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
          <p>Nenhum item pendente de faturamento para {segSel}.</p>
          {diagnostico.totalSeg === 0 ? (
            <p style={{ fontSize: '.85rem', color: 'var(--muted)', marginTop: 8 }}>
              Nenhuma OS da {segSel} encontrada no sistema.
            </p>
          ) : (
            <div style={{ fontSize: '.85rem', color: 'var(--muted)', marginTop: 8, lineHeight: 1.7 }}>
              {segSel} tem {diagnostico.totalSeg} OS no total:
              {diagnostico.naoFinalizadas > 0 && (
                <div>• {diagnostico.naoFinalizadas} ainda não finalizada{diagnostico.naoFinalizadas > 1 ? 's' : ''} (entram na fila quando o status virar concluído, processado ou enviado)</div>
              )}
              {diagnostico.semCodigo > 0 && (
                <div>• {diagnostico.semCodigo} finalizada{diagnostico.semCodigo > 1 ? 's' : ''} sem código de faturamento — abra a OS e preencha o código no Passo de faturamento</div>
              )}
              {diagnostico.jaFaturadas > 0 && (
                <div>• {diagnostico.jaFaturadas} já vinculada{diagnostico.jaFaturadas > 1 ? 's' : ''} a uma nota (veja a lista de notas abaixo)</div>
              )}
            </div>
          )}
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

      <h4 style={{ fontFamily: 'Barlow Condensed,sans-serif', fontSize: '.95rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', margin: '22px 0 12px' }}>
        🧾 Notas — {segSel}
      </h4>
      {notas.filter(n => n.seguradora === segSel).length === 0 && (
        <div className="empty-state" style={{ padding: '24px' }}>
          <p>Nenhuma nota fechada ainda para {segSel}.</p>
        </div>
      )}
      {notas.filter(n => n.seguradora === segSel).map(nota => {
        const st = statusNota(nota)
        const meta = STATUS_NOTA_META[st]
        return (
          <div key={nota.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
            border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 600 }}>Nota nº {nota.numero}</div>
              <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>
                Emissão: {fmtDate(nota.data_emissao)} · Prevista: {fmtDate(nota.data_prevista)} · {nota.itens?.length || 0} itens
              </div>
            </div>
            <div style={{ fontWeight: 700 }}>{fmtBRL(nota.total)}</div>
            <span className="badge" style={{ background: meta.bg, color: meta.cor }}>{meta.label}</span>
            {st !== 'paga' && (
              <button className="btn-sm btn-primary" onClick={() => marcarNotaPaga(nota)}>💵 Marcar como paga</button>
            )}
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
