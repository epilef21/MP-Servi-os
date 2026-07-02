// ============================================================
// MODAL: DETALHE DA OS — extraído do AdminPage.jsx
// Visualização/edição do atendimento, técnico, anotações,
// tarifação, fechamento financeiro, fotos e assinaturas.
// ============================================================
import { useState, useEffect } from 'react'
import {
  db, doc, updateDoc, deleteDoc, serverTimestamp, atualizarOS,
} from '../../firebase.js'
import { useAdminContext } from '../../contexts/AdminContext.jsx'
import { STATUS_META, badgeLabel, badgeCls } from './statusMeta.js'
import PreencherOSModal from './PreencherOSModal.jsx'
import { generatePDF } from '../../utils/pdfGenerator.js'
import { generatePNG } from '../../utils/pngGenerator.js'
import { fmtDate, fmtBRL, fmtDatetime, fmtSN } from '../../utils/formatters.js'
import {
  TABELAS,
  calcServico, calcDeslocamento, getDeslocFaixas, gerarMsgWhatsApp,
} from '../../utils/tarifas.js'
import { buildGoogleCalendarLink } from '../../utils/googleCalendarLink.js'
import { excluirEventoOS } from '../../utils/googleCalendarApi.js'
import { copyToClipboard } from '../../utils/clipboard.js'

export default function DetalheOSModal({ os: selected, onClose }) {
  const {
    empresaId, config, slug, tecnicos,
    updating, changeStatus,
    setSelected, setReports, setGeneratedLink, openLinkRelModal,
    buildLink, showToast,
  } = useAdminContext()

  // ── Financeiro e Técnico ─────────────────────────────────
  const [finForm,       setFinForm]       = useState({ mo_seguradora: '', valor_prestador: '', valor_deslocamento: '', material_cobrado_seguradora: '', material_custo_real: '' })
  const [savingFin,     setSavingFin]     = useState(false)
  const [tecnicoForm,   setTecnicoForm]   = useState({ nome: '', tel: '' })
  const [savingTecnico, setSavingTecnico] = useState(false)
  const [editAtend,     setEditAtend]     = useState(false)
  const [atendForm,     setAtendForm]     = useState({})
  const [savingAtend,   setSavingAtend]   = useState(false)
  const [detTecnicoMode, setDetTecnicoMode] = useState('select')

  // ── Anotações internas (visível só pelo admin, nunca vai ao PDF/PNG) ──
  const [anotacaoInterna, setAnotacaoInterna] = useState('')
  const [savingAnotacao,  setSavingAnotacao]  = useState(false)

  // ── Tarifação ─────────────────────────────────────────────
  const [tarifForm,     setTarifForm]     = useState({ pontos: '1', km: '', moManual: '' })
  const [servicoTarif,  setServicoTarif]  = useState(null)
  const [codigoForm,    setCodigoForm]    = useState({ codigo: '', valor_aprovado: '' })
  const [savingCodigo,  setSavingCodigo]  = useState(false)
  const [savingLancado, setSavingLancado] = useState(false)
  const [copiedTarif,   setCopiedTarif]   = useState(false)

  const [genPng,          setGenPng]          = useState(false)
  const [showPreencherOS, setShowPreencherOS] = useState(false)

  const tecnicosAtivos = tecnicos.filter(t => t.ativo !== false)

  // Sincroniza forms ao abrir detalhe de OS
  useEffect(() => {
    if (!selected) return
    setFinForm({
      mo_seguradora:               String(selected.mo_seguradora               ?? ''),
      valor_prestador:             String(selected.valor_prestador             ?? ''),
      valor_deslocamento:          String(selected.valor_deslocamento          ?? ''),
      material_cobrado_seguradora: String(selected.material_cobrado_seguradora ?? ''),
      material_custo_real:         String(selected.material_custo_real         ?? ''),
    })
    setTecnicoForm({
      nome: selected.tecnico_nome || '',
      tel:  selected.tecnico_tel  || '',
    })
    // detecta modo: se tem tecnico_id salvo, usa select; senão manual
    setDetTecnicoMode(selected.tecnico_id ? 'select' : 'manual')
    // carrega anotação interna (campo exclusivo do admin)
    setAnotacaoInterna(selected.anotacao_interna || '')
    // carrega dados de tarifação salvos
    setTarifForm({
      pontos:   selected.fat_pontos != null ? String(selected.fat_pontos) : '1',
      km:       selected.fat_km     != null ? String(selected.fat_km)     : '',
      moManual: selected.fat_mo_manual != null ? String(selected.fat_mo_manual) : '',
    })
    const tabela = TABELAS[selected.seguradora] || []
    setServicoTarif(tabela.find(x => x.id === selected.fat_item_id) || null)
    setCodigoForm({
      codigo:         selected.fat_codigo        || '',
      valor_aprovado: selected.fat_valor_aprovado != null ? String(selected.fat_valor_aprovado) : '',
    })
  }, [selected?.id])

  function reenviarLinkAssinatura(os) {
    const t    = os.publicToken ? `?t=${os.publicToken}` : ''
    const link = `${window.location.origin}/assinar/${slug}/${os.id}${t}`
    const tel  = (os.tel_segurado || '').replace(/\D/g, '')
    const msg  = `Olá ${os.nome_segurado || ''}! 😊\nPrecisamos da sua assinatura para finalizar o documento do atendimento.\n\n🔧 Serviço: ${os.servico || '—'}\n\nClique no link para assinar:\n🔗 ${link}`
    const waUrl = tel
      ? `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(waUrl, '_blank')
  }

  async function excluirOS(os) {
    if (!window.confirm(`Excluir OS de "${os.nome_segurado}"?\nEsta ação não pode ser desfeita.`)) return
    try {
      // Remove eventos do Google Calendar antes de apagar a OS (falha silenciosa)
      if (os.googleEventos && Object.keys(os.googleEventos).length) {
        try {
          await excluirEventoOS(empresaId, os.googleEventos)
        } catch (err) {
          console.error('Erro ao excluir evento do Calendar:', err)
        }
      }
      await deleteDoc(doc(db, `empresas/${empresaId}/checklist`, os.id))
      setReports(p => p.filter(r => r.id !== os.id))
      setSelected(null)
      showToast('OS excluída.', 'success')
    } catch (e) {
      showToast('Erro ao excluir OS: ' + e.message, 'error')
    }
  }

  async function saveFin() {
    setSavingFin(true)
    try {
      const matCobrado = parseFloat(finForm.material_cobrado_seguradora) || 0
      const matCusto   = parseFloat(finForm.material_custo_real)         || 0
      const payload = {
        mo_seguradora:               parseFloat(finForm.mo_seguradora)      || 0,
        valor_prestador:             parseFloat(finForm.valor_prestador)    || 0,
        valor_deslocamento:          parseFloat(finForm.valor_deslocamento) || 0,
        material_cobrado_seguradora: matCobrado,
        material_custo_real:         matCusto,
        margem_material:             matCobrado - matCusto,
      }
      await atualizarOS(empresaId, selected.id, payload)
      const updated = { ...selected, ...payload }
      setReports(p => p.map(r => r.id === selected.id ? updated : r))
      setSelected(updated)
      showToast('💰 Financeiro salvo!')
    } catch (e) { showToast('Erro ao salvar financeiro: ' + e.message, 'error') }
    finally { setSavingFin(false) }
  }

  function abrirEditAtend() {
    setAtendForm({
      seguradora:           selected.seguradora           || '',
      num_assist:           selected.num_assist           || '',
      data_agendada:        selected.data_agendada        || '',
      faixa_horario:        selected.faixa_horario        || '',
      faixa_horario_custom: selected.faixa_horario_custom || '',
      data_chegada:         selected.data_chegada         || '',
      hora_chegada:         selected.hora_chegada         || '',
      hora_saida:           selected.hora_saida           || '',
      servico:       selected.servico       || '',
      nome_segurado: selected.nome_segurado || '',
      tel_segurado:  selected.tel_segurado  || '',
      endereco:      selected.endereco      || '',
      numero:        selected.numero        || '',
      bairro:        selected.bairro        || '',
      cidade:        selected.cidade        || '',
      cep:           selected.cep           || '',
      desc_problema:        selected.desc_problema        || '',
      desc_servico:         selected.desc_servico         || '',
      avarias:              selected.avarias              || '',
      pecas:                selected.pecas                || '',
      problema_solucionado: selected.problema_solucionado || '',
      havera_retorno:       selected.havera_retorno       || '',
      garantia:             selected.garantia             || '',
      excedente:            selected.excedente            || '',
    })
    setEditAtend(true)
  }

  async function saveAtend() {
    setSavingAtend(true)
    try {
      await atualizarOS(empresaId, selected.id, atendForm)
      const updated = { ...selected, ...atendForm }
      setReports(p => p.map(r => r.id === selected.id ? updated : r))
      setSelected(updated)
      setEditAtend(false)
      showToast('✅ OS atualizada!')
    } catch (e) {
      showToast('Erro: ' + e.message, 'error')
    } finally {
      setSavingAtend(false)
    }
  }

  async function saveTecnico() {
    setSavingTecnico(true)
    try {
      let tecNome = tecnicoForm.nome.trim() || ''
      let tecTel  = tecnicoForm.tel.trim()  || ''
      let tecId   = selected.tecnico_id     || ''

      if (detTecnicoMode === 'select' && tecnicoForm.nome) {
        const tec = tecnicos.find(t => t.nome === tecnicoForm.nome)
        if (tec) { tecNome = tec.nome; tecTel = tec.telefone; tecId = tec.id }
      }

      const payload = { tecnico_nome: tecNome, tecnico_tel: tecTel, tecnico_id: tecId }
      await atualizarOS(empresaId, selected.id, payload)
      const updated = { ...selected, ...payload }
      setReports(p => p.map(r => r.id === selected.id ? updated : r))
      setSelected(updated)
      showToast('👷 Técnico salvo!')
    } catch (e) { showToast('Erro ao salvar técnico: ' + e.message, 'error') }
    finally { setSavingTecnico(false) }
  }

  function buildWhatsAppTecnico(os, tecnico) {
    const link         = buildLink(os)
    const linkCalendar = buildGoogleCalendarLink(os, slug)
    const msg  =
      `Olá ${tecnico.nome || 'Técnico'}! 👋\n\nVocê tem uma nova OS para atender:\n\n` +
      `📋 OS: ${os.num_assist || '—'}\n👤 Segurado: ${os.nome_segurado || '—'}\n` +
      `📍 Endereço: ${os.endereco || '—'} - ${os.cidade || '—'}\n` +
      `🔧 Serviço: ${os.servico || '—'}\n📅 Data: ${fmtDate(os.data_chegada)}\n\n` +
      `Acesse o link abaixo para preencher o checklist:\n🔗 ${link}\n\n` +
      (linkCalendar ? `📅 Adicionar à sua agenda:\n${linkCalendar}\n\n` : '') +
      `Qualquer dúvida estou à disposição!`
    const phone = tecnico.tel.replace(/\D/g, '')
    return `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`
  }

  async function handlePNG(r) {
    setGenPng(true)
    try { await generatePNG(r) } catch (e) { showToast('Erro ao gerar PNG: ' + e.message, 'error') }
    finally { setGenPng(false) }
  }

  // ── Salva anotação interna da OS (nunca vai ao PDF nem PNG) ──
  async function saveAnotacao() {
    if (!empresaId || !selected) return
    setSavingAnotacao(true)
    try {
      await updateDoc(doc(db, 'empresas', empresaId, 'checklist', selected.id), {
        anotacao_interna: anotacaoInterna,
      })
      setReports(p => p.map(r => r.id === selected.id ? { ...r, anotacao_interna: anotacaoInterna } : r))
      showToast('✅ Anotação salva!')
    } catch (e) { showToast('Erro ao salvar: ' + e.message, 'error') }
    finally { setSavingAnotacao(false) }
  }

  // ── Tarifação: salvar código recebido da seguradora ─────
  async function saveCodigo() {
    if (!codigoForm.codigo.trim()) { showToast('Informe o código recebido.', 'error'); return }
    setSavingCodigo(true)
    try {
      const valorAprov = parseFloat(codigoForm.valor_aprovado) || 0
      const km         = parseFloat(tarifForm.km) || 0
      const faixas     = getDeslocFaixas(config, selected.seguradora)
      const desl       = calcDeslocamento(km, faixas)
      const payload    = {
        fat_codigo:         codigoForm.codigo.trim(),
        fat_valor_aprovado: valorAprov,
        fat_codigo_em:      serverTimestamp(),
        fat_item_id:        servicoTarif?.id    || null,
        fat_pontos:         parseInt(tarifForm.pontos) || null,
        fat_km:             km || null,
        fat_mo_manual:      parseFloat(tarifForm.moManual) || null,
        // Alimenta automaticamente o fechamento financeiro
        mo_seguradora:      valorAprov,
        ...(km > 0 ? { valor_deslocamento: desl } : {}),
      }
      await atualizarOS(empresaId, selected.id, payload)
      const updated = { ...selected, ...payload }
      setReports(p => p.map(r => r.id === selected.id ? updated : r))
      setSelected(updated)
      setFinForm(p => ({
        ...p,
        mo_seguradora:      String(valorAprov),
        ...(km > 0 ? { valor_deslocamento: String(desl) } : {}),
      }))
      showToast('🔑 Código salvo! Financeiro atualizado.')
    } catch (e) { showToast('Erro: ' + e.message, 'error') }
    finally { setSavingCodigo(false) }
  }

  // ── Tarifação: marcar como lançado no portal da seguradora ─
  async function marcarLancado() {
    setSavingLancado(true)
    try {
      const payload = { fat_lancado_em: serverTimestamp() }
      await atualizarOS(empresaId, selected.id, payload)
      const updated = { ...selected, ...payload }
      setReports(p => p.map(r => r.id === selected.id ? updated : r))
      setSelected(updated)
      showToast(`✅ Lançado no portal ${selected.seguradora || ''}!`)
    } catch (e) { showToast('Erro: ' + e.message, 'error') }
    finally { setSavingLancado(false) }
  }

  return (
    <>
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box">
        <div className="modal-header">
          <h2>OS — {selected.nome_segurado || ''}</h2>
          <div className="modal-header-btns">
            {selected.status === 'aguardando_tecnico' && (
              <button className="btn-sm btn-link"
                onClick={() => setGeneratedLink({ link: buildLink(selected), os: selected.id, nome: selected.nome_segurado, seguradora: selected.seguradora, num_assist: selected.num_assist })}>
                🔗 Reenviar Link
              </button>
            )}
            <button className="btn-sm btn-png" disabled={genPng} onClick={() => handlePNG(selected)}>
              {genPng ? '⏳' : '📱 PNG WhatsApp'}
            </button>
            <button className="btn-sm btn-pdf" onClick={() => generatePDF(selected)}>🖨️ PDF</button>
            <button className="btn-sm" style={{ background: '#1a5276', color: '#fff' }} onClick={() => openLinkRelModal(selected)}>🔗 Link Relatório</button>
            {selected.data_agendada && (
              <a href={buildGoogleCalendarLink(selected, slug)} target="_blank" rel="noopener noreferrer"
                className="btn-sm btn-calendar" style={{ fontSize: '.78rem' }}>
                📅 Calendar
              </a>
            )}
            <button className="btn-sm" style={{ background: 'rgba(220,38,38,.35)', color: '#fff' }} title="Excluir OS" onClick={() => excluirOS(selected)}>🗑️</button>
            <button className="btn-sm" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="modal-body">
          {selected.origem === 'admin' && (
            <div style={{ marginBottom: 14 }}>
              <span className="badge" style={{ background: '#f0f5ff', color: '#1a3a8c', border: '1px solid #b0c4f0' }}>📞 OS Cadastrada Manualmente</span>
            </div>
          )}

          <div className="md-section">
            <h3 style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>📋 Atendimento</span>
              {!editAtend
                ? <button className="btn-sm" style={{ fontSize:'11px', padding:'3px 10px' }} onClick={abrirEditAtend}>✏️ Editar</button>
                : <div style={{ display:'flex', gap:6 }}>
                    <button className="btn-sm" style={{ fontSize:'11px', padding:'3px 10px', background:'var(--muted)', color:'#fff' }} onClick={() => setEditAtend(false)}>Cancelar</button>
                    <button className="btn-sm btn-ok" style={{ fontSize:'11px', padding:'3px 10px' }} disabled={savingAtend} onClick={saveAtend}>{savingAtend ? '⏳' : '💾 Salvar'}</button>
                  </div>
              }
            </h3>
            {!editAtend ? (
              <div className="md-grid">
                <div className="md-field"><label>Seguradora</label><p>{selected.seguradora || '—'}</p></div>
                <div className="md-field"><label>Nº Assistência</label><p>{selected.num_assist || '—'}</p></div>
                <div className="md-field">
                  <label>{selected.data_chegada ? 'Data' : 'Data Agendada'}</label>
                  <p>{fmtDate(selected.data_chegada || selected.data_agendada)}</p>
                </div>
                <div className="md-field">
                  <label>{selected.hora_chegada ? 'Horários' : 'Faixa de Horário'}</label>
                  <p>{selected.hora_chegada
                    ? `${selected.hora_chegada} → ${selected.hora_saida || '—'}`
                    : selected.faixa_horario
                      ? ({ manha: '🌅 Manhã (08h–12h)', tarde: '☀️ Tarde (13h–17h)', dia_todo: '📅 Dia todo (08h–17h)', a_combinar: '🤝 A Combinar' }[selected.faixa_horario] || selected.faixa_horario) + (selected.faixa_horario_custom ? ` · ${selected.faixa_horario_custom}` : '')
                      : '—'}</p>
                </div>
                <div className="md-field span-2"><label>Serviço</label><p>{selected.servico || '—'}</p></div>
              </div>
            ) : (
              <div className="md-grid">
                <div className="md-field"><label>Seguradora</label><input className="inline-input" value={atendForm.seguradora} onChange={e => setAtendForm(p=>({...p, seguradora: e.target.value}))} /></div>
                <div className="md-field"><label>Nº Assistência</label><input className="inline-input" value={atendForm.num_assist} onChange={e => setAtendForm(p=>({...p, num_assist: e.target.value}))} /></div>
                <div className="md-field"><label>Data Agendada</label><input type="date" className="inline-input" value={atendForm.data_agendada} onChange={e => setAtendForm(p=>({...p, data_agendada: e.target.value}))} /></div>
                <div className="md-field"><label>Faixa de Horário</label>
                  <select className="inline-input" value={atendForm.faixa_horario} onChange={e => setAtendForm(p=>({...p, faixa_horario: e.target.value}))}>
                    <option value="">Selecione...</option>
                    <option value="manha">🌅 Manhã — 08:00 às 12:00</option>
                    <option value="tarde">☀️ Tarde — 13:00 às 17:00</option>
                    <option value="dia_todo">📅 Manhã e Tarde — 08:00 às 17:00</option>
                    <option value="a_combinar">🤝 A Combinar</option>
                  </select>
                </div>
                <div className="md-field"><label>Data real (DD/MM/AAAA)</label><input className="inline-input" placeholder="DD/MM/AAAA" value={atendForm.data_chegada} onChange={e => setAtendForm(p=>({...p, data_chegada: e.target.value}))} /></div>
                <div className="md-field"><label>Hora chegada</label><input className="inline-input" placeholder="08:00" value={atendForm.hora_chegada} onChange={e => setAtendForm(p=>({...p, hora_chegada: e.target.value}))} /></div>
                <div className="md-field"><label>Hora saída</label><input className="inline-input" placeholder="12:00" value={atendForm.hora_saida} onChange={e => setAtendForm(p=>({...p, hora_saida: e.target.value}))} /></div>
                <div className="md-field"><label>Serviço</label><input className="inline-input" value={atendForm.servico} onChange={e => setAtendForm(p=>({...p, servico: e.target.value}))} /></div>
              </div>
            )}
          </div>

          <div className="md-section">
            <h3>👤 Segurado</h3>
            {!editAtend ? (
              <div className="md-grid">
                <div className="md-field"><label>Nome</label><p>{selected.nome_segurado || '—'}</p></div>
                <div className="md-field"><label>Telefone</label><p>{selected.tel_segurado || '—'}</p></div>
                <div className="md-field"><label>Endereço</label><p>{selected.endereco ? `${selected.endereco}${selected.numero ? `, ${selected.numero}` : ''}` : '—'}</p></div>
                <div className="md-field"><label>Cidade</label><p>{selected.cidade || '—'}</p></div>
              </div>
            ) : (
              <div className="md-grid">
                <div className="md-field"><label>Nome</label><input className="inline-input" value={atendForm.nome_segurado} onChange={e => setAtendForm(p=>({...p, nome_segurado: e.target.value}))} /></div>
                <div className="md-field"><label>Telefone</label><input className="inline-input" value={atendForm.tel_segurado} onChange={e => setAtendForm(p=>({...p, tel_segurado: e.target.value}))} /></div>
                <div className="md-field"><label>Endereço</label><input className="inline-input" value={atendForm.endereco} onChange={e => setAtendForm(p=>({...p, endereco: e.target.value}))} /></div>
                <div className="md-field"><label>Número</label><input className="inline-input" value={atendForm.numero} onChange={e => setAtendForm(p=>({...p, numero: e.target.value}))} /></div>
                <div className="md-field"><label>Bairro</label><input className="inline-input" value={atendForm.bairro} onChange={e => setAtendForm(p=>({...p, bairro: e.target.value}))} /></div>
                <div className="md-field"><label>Cidade</label><input className="inline-input" value={atendForm.cidade} onChange={e => setAtendForm(p=>({...p, cidade: e.target.value}))} /></div>
                <div className="md-field"><label>CEP</label><input className="inline-input" value={atendForm.cep} onChange={e => setAtendForm(p=>({...p, cep: e.target.value}))} /></div>
              </div>
            )}
          </div>

          {(editAtend || selected.desc_problema || selected.desc_servico) && (
            <div className="md-section">
              <h3>📝 Descrições</h3>
              <div className="md-grid col-1">
                {editAtend
                  ? <div className="md-field"><label>Descrição do Problema</label><textarea className="inline-input" rows={3} style={{ resize:'vertical', width:'100%' }} value={atendForm.desc_problema} onChange={e => setAtendForm(p=>({...p, desc_problema: e.target.value}))} placeholder="Descreva o problema..." /></div>
                  : (selected.desc_problema && <div className="md-field"><label>Descrição do Problema</label><div className="md-text">{selected.desc_problema}</div></div>)
                }
                {editAtend
                  ? <div className="md-field"><label>Avarias Pré-Existentes</label><textarea className="inline-input" rows={2} style={{ resize:'vertical', width:'100%' }} value={atendForm.avarias} onChange={e => setAtendForm(p=>({...p, avarias: e.target.value}))} placeholder="Descreva avarias pré-existentes..." /></div>
                  : (selected.avarias && <div className="md-field"><label>Avarias Pré-Existentes</label><div className="md-text">{selected.avarias}</div></div>)
                }
                {editAtend
                  ? <div className="md-field"><label>Serviço Realizado</label><textarea className="inline-input" rows={3} style={{ resize:'vertical', width:'100%' }} value={atendForm.desc_servico} onChange={e => setAtendForm(p=>({...p, desc_servico: e.target.value}))} placeholder="Descreva o serviço realizado..." /></div>
                  : (selected.desc_servico && <div className="md-field"><label>Serviço Realizado</label><div className="md-text">{selected.desc_servico}</div></div>)
                }
                {editAtend
                  ? <div className="md-field"><label>Peças / Materiais</label><textarea className="inline-input" rows={2} style={{ resize:'vertical', width:'100%' }} value={atendForm.pecas} onChange={e => setAtendForm(p=>({...p, pecas: e.target.value}))} placeholder="Ex: Filtro, correia, resistência..." /></div>
                  : (selected.pecas && <div className="md-field"><label>Peças / Materiais</label><div className="md-text">{selected.pecas}</div></div>)
                }
              </div>
            </div>
          )}

          {selected.checkup?.length > 0 && (
            <div className="md-section">
              <h3>✅ Chek-Up</h3>
              <div className="tags-wrap">
                {selected.checkup.map((c, i) => (
                  <span key={i} className="tag">✅ {typeof c === 'object' ? `${c.item}${c.quant ? ` (Qtd: ${c.quant})` : ''}` : c}</span>
                ))}
              </div>
            </div>
          )}

          {(selected.problema_solucionado || editAtend) && (
            <div className="md-section">
              <h3>🏁 Conclusão</h3>
              {!editAtend ? (
                <div className="md-grid">
                  <div className="md-field"><label>Problema Solucionado</label><p>{fmtSN(selected.problema_solucionado)}</p></div>
                  <div className="md-field"><label>Haverá Retorno</label><p>{fmtSN(selected.havera_retorno)}</p></div>
                  <div className="md-field"><label>Garantia (90 dias)</label><p>{fmtSN(selected.garantia)}</p></div>
                  <div className="md-field"><label>Excedente</label><p>{selected.excedente || '—'}</p></div>
                </div>
              ) : (
                <div className="md-grid">
                  <div className="md-field">
                    <label>Problema Solucionado</label>
                    <select className="inline-input" value={atendForm.problema_solucionado} onChange={e => setAtendForm(p=>({...p, problema_solucionado: e.target.value}))}>
                      <option value="">Selecione...</option>
                      <option value="sim">Sim</option>
                      <option value="nao">Não</option>
                    </select>
                  </div>
                  <div className="md-field">
                    <label>Haverá Retorno</label>
                    <select className="inline-input" value={atendForm.havera_retorno} onChange={e => setAtendForm(p=>({...p, havera_retorno: e.target.value}))}>
                      <option value="">Selecione...</option>
                      <option value="sim">Sim</option>
                      <option value="nao">Não</option>
                    </select>
                  </div>
                  <div className="md-field">
                    <label>Garantia (90 dias)</label>
                    <select className="inline-input" value={atendForm.garantia} onChange={e => setAtendForm(p=>({...p, garantia: e.target.value}))}>
                      <option value="">Selecione...</option>
                      <option value="sim">Sim</option>
                      <option value="nao">Não</option>
                    </select>
                  </div>
                  <div className="md-field">
                    <label>Excedente</label>
                    <input className="inline-input" value={atendForm.excedente} onChange={e => setAtendForm(p=>({...p, excedente: e.target.value}))} placeholder="Valor ou descrição..." />
                  </div>
                </div>
              )}
            </div>
          )}

          {selected.resultado_visita && (
            <div className="md-section">
              <h3>📍 Resultado da Visita</h3>
              <div className="md-grid">
                <div className="md-field">
                  <label>Resultado</label>
                  <p>
                    {selected.resultado_visita === 'concluido'       && '✅ Serviço Concluído'}
                    {selected.resultado_visita === 'ficou_visita'    && '🔄 Ficou na Visita'}
                    {selected.resultado_visita === 'cliente_ausente' && '🚪 Cliente Ausente'}
                  </p>
                </div>
                {selected.data_retorno && (
                  <div className="md-field">
                    <label>Data Prevista Retorno</label>
                    <p>{fmtDate(selected.data_retorno)}</p>
                  </div>
                )}
                {selected.ficou_pendente && (
                  <div className="md-field span-2">
                    <label>O que ficou pendente</label>
                    <div className="md-text">{selected.ficou_pendente}</div>
                  </div>
                )}
                {selected.motivo_retorno && (
                  <div className="md-field">
                    <label>Motivo do Retorno</label>
                    <p>{{
                      aguardando_peca:      '⚙️ Aguardando Peça',
                      aprovacao_cliente:    '👤 Aprovação do Cliente',
                      aprovacao_seguradora: '🏢 Aprovação da Seguradora',
                      outro: `📝 ${selected.motivo_outro || 'Outro'}`,
                    }[selected.motivo_retorno]}</p>
                  </div>
                )}
                {selected.tentativa_contato && (
                  <div className="md-field span-2">
                    <label>Tentativa de Contato</label>
                    <div className="md-text">{selected.tentativa_contato}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Técnico — com select integrado */}
          <div className="md-section" style={{ background: '#f5f8fc', border: '1px solid #c8d8ec', borderRadius: 8, padding: '14px 16px' }}>
            <h3 style={{ color: '#1a3fa8', marginBottom: 12 }}>👷 Técnico Responsável</h3>
            <div className="md-grid">
              <div className="md-field">
                <label>Nome do Técnico</label>
                {detTecnicoMode === 'select'
                  ? (
                    <select
                      value={tecnicoForm.nome}
                      onChange={e => {
                        if (e.target.value === '__manual__') { setDetTecnicoMode('manual'); setTecnicoForm({ nome: '', tel: '' }) }
                        else {
                          const tec = tecnicosAtivos.find(t => t.nome === e.target.value)
                          if (tec) setTecnicoForm({ nome: tec.nome, tel: tec.telefone })
                          else setTecnicoForm(p => ({ ...p, nome: e.target.value }))
                        }
                      }}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, fontFamily: 'Barlow,sans-serif', fontSize: '.9rem' }}
                    >
                      <option value="">Selecione o técnico...</option>
                      {tecnicosAtivos.map(t => (
                        <option key={t.id} value={t.nome}>{t.nome} — {t.telefone}</option>
                      ))}
                      <option value="__manual__">+ Digitar manualmente</option>
                    </select>
                  )
                  : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        value={tecnicoForm.nome}
                        onChange={e => setTecnicoForm(p => ({ ...p, nome: e.target.value }))}
                        placeholder="Nome completo do técnico"
                        style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, fontFamily: 'Barlow,sans-serif', fontSize: '.9rem' }}
                      />
                      {tecnicosAtivos.length > 0 && (
                        <button className="btn-sm btn-view" onClick={() => setDetTecnicoMode('select')} type="button">↩</button>
                      )}
                    </div>
                  )
                }
              </div>
              <div className="md-field">
                <label>Telefone do Técnico</label>
                <input type="tel" value={tecnicoForm.tel} onChange={e => setTecnicoForm(p => ({ ...p, tel: e.target.value }))}
                  placeholder="(XX) XXXXX-XXXX"
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, fontFamily: 'Barlow,sans-serif', fontSize: '.9rem' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button className="btn-sm btn-ok" disabled={savingTecnico} onClick={saveTecnico}>
                {savingTecnico ? '⏳ Salvando...' : '💾 Salvar Técnico'}
              </button>
              {tecnicoForm.tel && tecnicoForm.nome && (
                <a className="btn-whatsapp" href={buildWhatsAppTecnico(selected, tecnicoForm)}
                  target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', fontSize: '.82rem' }}>
                  📲 Enviar no WhatsApp
                </a>
              )}
            </div>
          </div>

          {/* Anotações internas — visível só pelo admin, não vai ao PDF nem PNG */}
          <div className="md-section" style={{ background: '#fffbf0', border: '1.5px solid #f0d080', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <h3 style={{ color: '#8a6a00', margin: 0 }}>📝 Anotações Internas</h3>
              <span style={{ fontSize: '.72rem', color: '#aaa', fontWeight: 600 }}>🔒 Só você vê isso</span>
            </div>
            <textarea
              rows={4}
              value={anotacaoInterna}
              onChange={e => setAnotacaoInterna(e.target.value)}
              placeholder="Anotações internas, observações, lembretes... Visível apenas para você."
              style={{
                width: '100%', resize: 'none', border: '1.5px solid #f0d080',
                borderRadius: 6, padding: '9px 12px', fontSize: '.88rem',
                fontFamily: 'Barlow,sans-serif', background: '#fffdf5',
                color: 'var(--text)', outline: 'none', lineHeight: 1.55,
              }}
            />
            <div style={{ marginTop: 10, textAlign: 'right' }}>
              <button className="btn-sm btn-ok" disabled={savingAnotacao} onClick={saveAnotacao}>
                {savingAnotacao ? '⏳ Salvando...' : '💾 Salvar Anotação'}
              </button>
            </div>
          </div>

          {selected.avaliacao_nota
            ? (
              <div className="md-section" style={{ background: '#fffbf0', border: '1px solid #f0d88a', borderRadius: 8, padding: '14px 16px' }}>
                <h3 style={{ color: '#8a6a00', marginBottom: 8 }}>⭐ Avaliação do Segurado</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {[1,2,3,4,5].map(i => (
                      <span key={i} style={{ fontSize: '1.5rem', color: i <= selected.avaliacao_nota ? '#f0c020' : '#ddd' }}>★</span>
                    ))}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#8a6a00' }}>{selected.avaliacao_nota}/5</span>
                </div>
                {selected.avaliacao_comentario && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: '#fff8e0', borderRadius: 6, fontSize: '.88rem', color: '#555', fontStyle: 'italic' }}>
                    "{selected.avaliacao_comentario}"
                  </div>
                )}
              </div>
            ) : (
              <div className="md-section" style={{ background: '#fafafa', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
                <h3 style={{ color: 'var(--muted)', marginBottom: 4 }}>⭐ Avaliação do Segurado</h3>
                <p style={{ fontSize: '.82rem', color: 'var(--muted)' }}>Ainda não avaliado.</p>
              </div>
            )
          }

          {/* ── Tarifação & Faturamento ── */}
          {(() => {
            const seg      = selected.seguradora || ''
            const tabela   = TABELAS[seg] || []
            const temTabela = tabela.length > 0
            const faixas   = getDeslocFaixas(config, seg)
            const pontos   = parseInt(tarifForm.pontos) || 1
            const km       = parseFloat(tarifForm.km)   || 0
            const { visita, mo, pontosExtras, totalServico } = calcServico(servicoTarif, pontos)
            const moManual = parseFloat(tarifForm.moManual) || 0
            const moUsado  = temTabela ? totalServico : moManual
            const desl     = calcDeslocamento(km, faixas)
            const total    = moUsado + desl
            const r        = n => Number(n).toFixed(2).replace('.', ',')
            const codigoDigitos = seg === 'Allianz' || seg === 'Tempo' ? 2 : 8
            return (
              <div className="md-section" style={{ background: '#eef3ff', border: '1.5px solid #adc5f5', borderRadius: 8, padding: '14px 16px' }}>
                <h3 style={{ color: '#1a3fa8', marginBottom: 14 }}>🧾 Tarifação</h3>

                {/* ── Passo 1: Calcular ── */}
                <p style={{ fontSize: '.73rem', fontWeight: 700, color: '#1a3fa8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
                  1 · Calcular e enviar para a seguradora
                </p>

                {/* Seletor de serviço (Mapfre tem tabela completa) */}
                {temTabela ? (
                  <div className="md-field" style={{ marginBottom: 10 }}>
                    <label>Serviço — tabela {seg}</label>
                    <select
                      value={servicoTarif?.id || ''}
                      onChange={e => setServicoTarif(tabela.find(x => x.id === e.target.value) || null)}
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 5, fontFamily: 'Barlow,sans-serif', fontSize: '.88rem' }}
                    >
                      <option value="">Selecione o serviço...</option>
                      {tabela.map(x => (
                        <option key={x.id} value={x.id}>{x.id} — {x.servico}</option>
                      ))}
                    </select>
                    {servicoTarif && (
                      <div style={{ marginTop: 6, background: '#fff', border: '1px solid #c8d8ec', borderRadius: 5, padding: '7px 10px', fontSize: '.82rem', color: '#444', lineHeight: 1.6 }}>
                        <div style={{ color: 'var(--muted)', marginBottom: 2, fontSize: '.77rem' }}>{servicoTarif.descricao}</div>
                        <span style={{ marginRight: 14 }}>Visita: <strong>R$ {r(servicoTarif.visita)}</strong></span>
                        <span style={{ marginRight: 14 }}>MO: <strong>R$ {r(servicoTarif.mo)}</strong></span>
                        <span>Ponto: <strong>{servicoTarif.pontoAdicional != null ? `R$ ${r(servicoTarif.pontoAdicional)}` : 'Não se aplica'}</strong></span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="md-field" style={{ marginBottom: 10 }}>
                    <label>Valor MO proposto (R$)</label>
                    <input type="number" step="0.01" min="0" value={tarifForm.moManual}
                      onChange={e => setTarifForm(p => ({ ...p, moManual: e.target.value }))}
                      placeholder="Ex: 170,00"
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, fontFamily: 'Barlow,sans-serif', fontSize: '.9rem' }} />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  {/* Pontos (só mostra se o serviço aceita ponto adicional ou se não tem tabela) */}
                  {(!temTabela || servicoTarif?.pontoAdicional != null) && (
                    <div className="md-field">
                      <label>Nº de pontos</label>
                      <input type="number" min="1" step="1" value={tarifForm.pontos}
                        onChange={e => setTarifForm(p => ({ ...p, pontos: e.target.value }))}
                        placeholder="1"
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, fontFamily: 'Barlow,sans-serif', fontSize: '.9rem' }} />
                    </div>
                  )}
                  <div className="md-field">
                    <label>KM de deslocamento</label>
                    <input type="number" min="0" step="1" value={tarifForm.km}
                      onChange={e => setTarifForm(p => ({ ...p, km: e.target.value }))}
                      placeholder="Ex: 160"
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, fontFamily: 'Barlow,sans-serif', fontSize: '.9rem' }} />
                    {km > 200 && (
                      <span style={{ fontSize: '.75rem', color: '#e07000', fontWeight: 600 }}>⚠️ Acima de 200km — taxa {r(faixas.acima200km)}/km</span>
                    )}
                  </div>
                </div>

                {/* Preview do cálculo */}
                {(servicoTarif || moManual > 0 || km > 0) && (
                  <div style={{ background: '#fff', border: '1px solid #adc5f5', borderRadius: 6, padding: '10px 14px', marginBottom: 12, fontSize: '.88rem', lineHeight: 1.85 }}>
                    {temTabela && servicoTarif ? (
                      <>
                        {visita > 0    && <div>Visita/Saída: <strong>R$ {r(visita)}</strong></div>}
                        {mo > 0        && <div>MO ({servicoTarif.id} — {servicoTarif.servico}): <strong>R$ {r(mo)}</strong></div>}
                        {pontosExtras > 0 && <div>Pontos extras ({pontos - 1} × R$ {r(servicoTarif.pontoAdicional)}): <strong>R$ {r(pontosExtras)}</strong></div>}
                      </>
                    ) : (
                      moManual > 0 && <div>MO proposta: <strong>R$ {r(moManual)}</strong></div>
                    )}
                    {km > 0 && (
                      <div>
                        Deslocamento: {km}km × R$ {r(km <= 200 ? faixas.ate200km : faixas.acima200km)}
                        {km > 200 && <span style={{ fontSize: '.78rem', color: '#e07000' }}> (faixa &gt;200km)</span>}
                        {' '}= <strong>R$ {r(desl)}</strong>
                      </div>
                    )}
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #e0e8f8', fontWeight: 900, fontSize: '1.05rem', color: '#1a3fa8' }}>
                      Total proposto: R$ {r(total)}
                    </div>
                  </div>
                )}

                <button
                  style={{ background: '#25d366', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 18px', fontFamily: 'Barlow Condensed,sans-serif', fontWeight: 700, fontSize: '.92rem', cursor: 'pointer' }}
                  onClick={() => {
                    const msg = gerarMsgWhatsApp(selected, servicoTarif, pontos, km, faixas)
                    copyToClipboard(msg)
                    setCopiedTarif(true); setTimeout(() => setCopiedTarif(false), 2500)
                  }}
                >
                  {copiedTarif ? '✅ Copiado!' : '📋 Copiar mensagem para WhatsApp'}
                </button>

                <div style={{ borderTop: '1px solid #adc5f5', margin: '16px 0' }} />

                {/* ── Passo 2: Código recebido ── */}
                <p style={{ fontSize: '.73rem', fontWeight: 700, color: '#1a3fa8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
                  2 · Código recebido da seguradora
                </p>
                {selected.fat_codigo && (
                  <div style={{ background: '#e8f5e9', border: '1px solid #81c784', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: '.88rem', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                    <span>🔑 Código: <strong style={{ letterSpacing: 3, fontFamily: 'monospace' }}>{selected.fat_codigo}</strong></span>
                    <span>Valor aprovado: <strong>{fmtBRL(selected.fat_valor_aprovado)}</strong></span>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div className="md-field">
                    <label>Código ({codigoDigitos} dígitos)</label>
                    <input
                      value={codigoForm.codigo}
                      onChange={e => setCodigoForm(p => ({ ...p, codigo: e.target.value }))}
                      placeholder={'X'.repeat(codigoDigitos)}
                      maxLength={codigoDigitos}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, fontFamily: 'monospace', fontSize: '1.05rem', fontWeight: 700, letterSpacing: 3 }}
                    />
                  </div>
                  <div className="md-field">
                    <label>Valor aprovado (R$)</label>
                    <input type="number" step="0.01" min="0"
                      value={codigoForm.valor_aprovado}
                      onChange={e => setCodigoForm(p => ({ ...p, valor_aprovado: e.target.value }))}
                      placeholder="0,00"
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, fontFamily: 'Barlow,sans-serif', fontSize: '.9rem' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    disabled={savingCodigo}
                    onClick={saveCodigo}
                    style={{ background: '#1a3fa8', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 18px', fontFamily: 'Barlow Condensed,sans-serif', fontWeight: 700, fontSize: '.92rem', cursor: 'pointer', opacity: savingCodigo ? .6 : 1 }}
                  >
                    {savingCodigo ? '⏳ Salvando...' : '💾 Salvar código'}
                  </button>
                  <span style={{ fontSize: '.78rem', color: 'var(--muted)' }}>Preenche o financeiro automaticamente</span>
                </div>

                <div style={{ borderTop: '1px solid #adc5f5', margin: '16px 0' }} />

                {/* ── Passo 3: Lançado no portal ── */}
                <p style={{ fontSize: '.73rem', fontWeight: 700, color: '#1a3fa8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
                  3 · Lançamento no portal {seg}
                </p>
                {selected.fat_lancado_em ? (
                  <div style={{ background: '#e8f5e9', border: '1px solid #81c784', borderRadius: 7, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.4rem' }}>✅</span>
                    <div>
                      <strong>Lançado no portal {seg}</strong>
                      <div style={{ color: 'var(--muted)', fontSize: '.8rem' }}>em {fmtDatetime(selected.fat_lancado_em)}</div>
                    </div>
                  </div>
                ) : (
                  <button
                    disabled={savingLancado || !selected.fat_codigo}
                    onClick={marcarLancado}
                    title={!selected.fat_codigo ? 'Salve o código primeiro (passo 2)' : ''}
                    style={{ background: !selected.fat_codigo ? '#aaa' : '#2d8a4e', color: '#fff', border: 'none', borderRadius: 7, padding: '10px 22px', fontFamily: 'Barlow Condensed,sans-serif', fontWeight: 700, fontSize: '1rem', cursor: !selected.fat_codigo ? 'not-allowed' : 'pointer', opacity: savingLancado ? .6 : 1 }}
                  >
                    {savingLancado ? '⏳ Salvando...' : `✅ Marcar como lançado no portal ${seg}`}
                  </button>
                )}
              </div>
            )
          })()}

          <div className="md-section" style={{ background: '#f0f7f0', border: '1px solid #b8ddb8', borderRadius: 8, padding: '14px 16px' }}>
            <h3 style={{ color: '#1e6e3e', marginBottom: 4 }}>🔒 Fechamento Financeiro Interno</h3>
            <p style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: 12 }}>
              Esses valores não aparecem no formulário do prestador nem no PDF.
            </p>
            <div className="md-grid">
              {[
                { key: 'mo_seguradora',      label: 'MO Seguradora (R$)' },
                { key: 'valor_prestador',    label: 'Valor Prestador (R$)' },
                { key: 'valor_deslocamento', label: 'Valor Deslocamento (R$)' },
              ].map(({ key, label }) => (
                <div className="md-field" key={key}>
                  <label>{label}</label>
                  <input type="number" step="0.01" min="0"
                    value={finForm[key]}
                    onChange={e => setFinForm(p => ({ ...p, [key]: e.target.value }))}
                    placeholder="0,00"
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, fontFamily: 'Barlow,sans-serif', fontSize: '.9rem' }} />
                </div>
              ))}
              <div className="md-field">
                <label>Lucro Real</label>
                {(() => {
                  const mos = parseFloat(finForm.mo_seguradora)      || 0
                  const vpt = parseFloat(finForm.valor_prestador)    || 0
                  const vds = parseFloat(finForm.valor_deslocamento) || 0
                  const lucro   = (mos - vpt) + vds
                  const hasVal  = !!(finForm.mo_seguradora || finForm.valor_prestador || finForm.valor_deslocamento)
                  return hasVal
                    ? <p style={{ fontFamily: 'Barlow Condensed,sans-serif', fontSize: '1.4rem', fontWeight: 900, color: lucro >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmtBRL(lucro)}</p>
                    : <p style={{ color: 'var(--muted)' }}>—</p>
                })()}
              </div>
            </div>

            {/* Campos de material */}
            <div style={{ marginTop: 14, borderTop: '1px solid #b8ddb8', paddingTop: 14 }}>
              <p style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: 10 }}>
                📦 Material (para o DRE da empresa)
              </p>
              <div className="md-grid">
                <div className="md-field">
                  <label>Material Cobrado da Seguradora (R$)</label>
                  <input type="number" step="0.01" min="0"
                    value={finForm.material_cobrado_seguradora}
                    onChange={e => setFinForm(p => ({ ...p, material_cobrado_seguradora: e.target.value }))}
                    placeholder="0,00"
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, fontFamily: 'Barlow,sans-serif', fontSize: '.9rem' }} />
                </div>
                <div className="md-field">
                  <label>Custo Real do Material (R$)</label>
                  <input type="number" step="0.01" min="0"
                    value={finForm.material_custo_real}
                    onChange={e => setFinForm(p => ({ ...p, material_custo_real: e.target.value }))}
                    placeholder="0,00"
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, fontFamily: 'Barlow,sans-serif', fontSize: '.9rem' }} />
                </div>
              </div>
              {(() => {
                const cobrado = parseFloat(finForm.material_cobrado_seguradora) || 0
                const custo   = parseFloat(finForm.material_custo_real)         || 0
                if (!cobrado && !custo) return null
                const margem = cobrado - custo
                return (
                  <div className={`margem-material-box${margem < 0 ? ' negativa' : ''}`}>
                    <span>Margem em Material</span>
                    <span>{fmtBRL(margem)}</span>
                  </div>
                )
              })()}
            </div>

            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <button className="btn-sm btn-ok" disabled={savingFin} onClick={saveFin}>
                {savingFin ? '⏳ Salvando...' : '💾 Salvar Financeiro'}
              </button>
            </div>
          </div>

          {selected.fotos?.length > 0 && (
            <div className="md-section">
              <h3>📷 Fotos do Atendimento</h3>
              <div className="foto-viewer-grid">
                {selected.fotos.map((url, i) => (
                  <img key={i} src={url} alt={`foto ${i + 1}`} className="foto-viewer-img"
                    onClick={() => window.open(url, '_blank')} />
                ))}
              </div>
            </div>
          )}

          {(selected.assinatura_prestador || selected.assinatura_segurado) && (
            <div className="md-section">
              <h3>✍️ Assinaturas</h3>
              <div className="md-grid">
                <div className="md-field"><label>Prestador</label>{selected.assinatura_prestador ? <img className="sig-img" src={selected.assinatura_prestador} alt="" /> : <p style={{ color: 'var(--muted)' }}>Não registrada</p>}</div>
                <div className="md-field"><label>Segurado</label>{selected.assinatura_segurado ? <img className="sig-img" src={selected.assinatura_segurado} alt="" /> : <p style={{ color: 'var(--muted)' }}>Não registrada</p>}</div>
              </div>
            </div>
          )}

          {selected.status_historico?.length > 0 && (
            <div className="md-section" style={{ background: '#f8f9fb', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
              <h3 style={{ color: 'var(--text)', marginBottom: 10 }}>🕐 Histórico de Status</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...selected.status_historico].reverse().map((h, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{
                      display: 'inline-block', width: 10, height: 10, borderRadius: '50%', marginTop: 4, flexShrink: 0,
                      background: STATUS_META[h.para]?.dot || '#999',
                    }} />
                    <div style={{ lineHeight: 1.4 }}>
                      <span style={{ fontWeight: 700, fontSize: '.85rem' }}>
                        {STATUS_META[h.para]?.label || h.para}
                      </span>
                      {h.de && <span style={{ fontSize: '.78rem', color: 'var(--muted)' }}> ← {STATUS_META[h.de]?.label || h.de}</span>}
                      <br />
                      <span style={{ fontSize: '.75rem', color: 'var(--muted)' }}>
                        {h.por} · {new Date(h.quando).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="meta-row">
            <div className="meta-item"><label>ID</label><p>{selected.id}</p></div>
            <div className="meta-item"><label>Criado em</label><p>{fmtDatetime(selected.criado_em)}</p></div>
            <div className="meta-item"><label>Status</label><p><span className={`badge ${badgeCls(selected.status)}`}>{badgeLabel(selected.status)}</span></p></div>
          </div>
        </div>

        <div className="modal-footer">
          <span className={`badge ${badgeCls(selected.status)}`} style={{ marginRight: 'auto' }}>{badgeLabel(selected.status)}</span>
          {(selected.status === 'concluido' || selected.status === 'pendente' || !selected.status) && (
            <button className="btn-sm btn-ok" disabled={updating} onClick={() => changeStatus(selected.id, 'processado')}>✓ Processado</button>
          )}
          {selected.status === 'processado' && (
            <button className="btn-sm" style={{ background: '#1a3a8c', color: '#fff' }} disabled={updating} onClick={() => changeStatus(selected.id, 'enviado')}>📤 Enviado</button>
          )}
          {!selected.assinatura_segurado && selected.status !== 'concluido' && selected.status !== 'processado' && selected.status !== 'enviado' && (
            <button
              className="btn-sm"
              style={{ background: '#7c3aed', color: '#fff' }}
              onClick={() => setShowPreencherOS(true)}
            >✍️ Preencher e Enviar</button>
          )}
          {selected.status === 'aguardando_assinatura_cliente' && (
            <button
              className="btn-sm"
              style={{ background: '#25d366', color: '#fff' }}
              onClick={() => reenviarLinkAssinatura(selected)}
            >📱 Reenviar Link</button>
          )}
          <button className="btn-sm btn-png" disabled={genPng} onClick={() => handlePNG(selected)}>
            {genPng ? '⏳ Gerando...' : '📱 PNG WhatsApp'}
          </button>
          <button className="btn-sm btn-pdf" onClick={() => generatePDF(selected)}>🖨️ Baixar PDF</button>
        </div>
      </div>
    </div>

    {/* ══ MODAL: PREENCHER OS PARA ASSINATURA REMOTA ══ */}
    {showPreencherOS && (
      <PreencherOSModal
        os={selected}
        empresaId={empresaId}
        slug={slug}
        onClose={() => setShowPreencherOS(false)}
        onSaved={updated => {
          setReports(p => p.map(r => r.id === updated.id ? { ...r, ...updated } : r))
          setSelected(p => ({ ...p, ...updated }))
          setShowPreencherOS(false)
        }}
      />
    )}
    </>
  )
}
