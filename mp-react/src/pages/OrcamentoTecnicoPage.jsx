// ============================================================
// ORÇAMENTO TÉCNICO — Página pública para o técnico preencher
// Rota: /orcamento/:slug/:orcamentoId
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { db, doc, getDoc, updateDoc, serverTimestamp } from '../firebase.js'
import { useEmpresa } from '../hooks/useEmpresa.js'

// Converte string de valor monetário ("120,50" ou "120.50") para float
function parseBRL(v) {
  if (!v && v !== 0) return 0
  return parseFloat(String(v).replace(',','.')) || 0
}

function fmtBRL(v) {
  const n = parseBRL(v)
  return n.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
}

function novoItem() {
  return {
    id: `item_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    descricao: '',
    quantidade: 1,
    valor_unit: '',
    valor_total: 0,
    paga_seguradora: 0,
    paga_cliente: 0,
  }
}

export default function OrcamentoTecnicoPage() {
  const { orcamentoId } = useParams()
  const { empresa, config, empresaId, loading: loadingEmpresa } = useEmpresa()

  const [orc,       setOrc]       = useState(null)
  const [loadingOrc,setLoadingOrc]= useState(true)
  const [erroOrc,   setErroOrc]   = useState('')

  // Campos editáveis pelo técnico
  const [diagnostico,   setDiagnostico]   = useState('')
  const [itens,         setItens]         = useState([novoItem()])
  const [formaPagto,    setFormaPagto]    = useState('pix')
  const [observacoes,   setObservacoes]   = useState('')
  const [numSerie,      setNumSerie]      = useState('')

  const [salvando,  setSalvando]  = useState(false)
  const [sucesso,   setSucesso]   = useState(false)
  const [erros,     setErros]     = useState({})
  const [online,    setOnline]    = useState(navigator.onLine)

  // Detecta conexão
  useEffect(() => {
    const up   = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online',  up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online',up); window.removeEventListener('offline',down) }
  }, [])

  // Carrega o orçamento do Firestore
  useEffect(() => {
    if (!empresaId || !orcamentoId) return

    async function carregar() {
      setLoadingOrc(true)
      setErroOrc('')
      try {
        const ref  = doc(db, `empresas/${empresaId}/orcamentos/${orcamentoId}`)
        const snap = await getDoc(ref)
        if (!snap.exists()) {
          setErroOrc('Orçamento não encontrado.')
          return
        }
        const data = snap.data()
        setOrc({ id: snap.id, ...data })
        // Pré-preenche campos se já tiver dados
        if (data.diagnostico)   setDiagnostico(data.diagnostico)
        if (data.forma_pagamento) setFormaPagto(data.forma_pagamento)
        if (data.observacoes)   setObservacoes(data.observacoes)
        if (data.num_serie)     setNumSerie(data.num_serie)
        if (data.itens?.length) setItens(data.itens.map(it => ({ ...it, valor_unit: it.valor_unit || '' })))
      } catch (e) {
        setErroOrc('Erro ao carregar orçamento. Tente novamente.')
      } finally {
        setLoadingOrc(false)
      }
    }
    carregar()
  }, [empresaId, orcamentoId])

  // Calcula total dos itens em tempo real
  const totalItens = itens.reduce((acc, it) => acc + (parseBRL(it.valor_unit) * (parseInt(it.quantidade)||1)), 0)

  // ── HANDLERS DOS ITENS ──────────────────────────────────────
  function atualizarItem(id, campo, valor) {
    setItens(prev => prev.map(it => {
      if (it.id !== id) return it
      const updated = { ...it, [campo]: valor }
      const qtd = parseInt(updated.quantidade) || 1
      const unit = parseBRL(updated.valor_unit)
      updated.valor_total = qtd * unit
      updated.paga_cliente = updated.valor_total
      return updated
    }))
  }

  function addItem() {
    setItens(prev => [...prev, novoItem()])
  }

  function removerItem(id) {
    setItens(prev => {
      const novo = prev.filter(it => it.id !== id)
      return novo.length ? novo : [novoItem()]
    })
  }

  // ── VALIDAÇÃO ───────────────────────────────────────────────
  function validar() {
    const e = {}
    if (!diagnostico.trim())  e.diagnostico = 'Diagnóstico obrigatório'
    if (itens.some(it => !it.descricao.trim())) e.itens = 'Todos os itens precisam de descrição'
    if (itens.some(it => parseBRL(it.valor_unit) <= 0)) e.itens = 'Todos os itens precisam de valor'
    setErros(e)
    return Object.keys(e).length === 0
  }

  // ── SUBMIT ──────────────────────────────────────────────────
  async function handleSubmit() {
    if (!validar()) return
    if (!online) { alert('Sem conexão. Conecte-se para enviar.'); return }

    setSalvando(true)
    try {
      const itensNormalizados = itens.map(it => {
        const qtd  = parseInt(it.quantidade) || 1
        const unit = parseBRL(it.valor_unit)
        return {
          id:              it.id || `item_${Date.now()}`,
          descricao:       it.descricao || '',
          quantidade:      qtd,
          valor_unit:      unit,
          valor_total:     qtd * unit,
          paga_seguradora: 0,
          paga_cliente:    qtd * unit,
        }
      })

      const totalGeral = itensNormalizados.reduce((acc,it) => acc + it.valor_total, 0)

      const ref = doc(db, `empresas/${empresaId}/orcamentos/${orcamentoId}`)
      await updateDoc(ref, {
        status:          'em_revisao',
        diagnostico:     diagnostico.trim(),
        itens:           itensNormalizados,
        total_geral:     totalGeral,
        total_cliente:   totalGeral,
        total_seguradora:0,
        forma_pagamento: formaPagto || 'pix',
        observacoes:     observacoes || '',
        num_serie:       numSerie || '',
        preenchido_em:   serverTimestamp(),
      })
      setSucesso(true)
    } catch (e) {
      alert('Erro ao enviar. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  // ── RENDER: LOADING ─────────────────────────────────────────
  if (loadingEmpresa || loadingOrc) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f0f4fb' }}>
        <div className="loading-state">
          <div className="spinner" />
          <p className="loading-text">Carregando orçamento...</p>
        </div>
      </div>
    )
  }

  // ── RENDER: ERRO ─────────────────────────────────────────────
  if (erroOrc) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f0f4fb', padding:'20px' }}>
        <div style={{ background:'#fff', borderRadius:16, padding:'32px', textAlign:'center', maxWidth:400 }}>
          <div style={{ fontSize:48, marginBottom:12 }}>⚠️</div>
          <h2 style={{ color:'var(--danger)', marginBottom:8 }}>Orçamento não encontrado</h2>
          <p style={{ color:'var(--muted)', fontSize:'.9rem' }}>{erroOrc}</p>
        </div>
      </div>
    )
  }

  if (!orc) return null

  // ── RENDER: JÁ PREENCHIDO ───────────────────────────────────
  if (orc.status && orc.status !== 'aguardando_tecnico') {
    const msgs = {
      em_revisao:        { icon:'🕐', txt:'Este orçamento já foi enviado e está em revisão pelo administrador.' },
      enviado_cliente:   { icon:'📤', txt:'Este orçamento já foi enviado ao cliente.' },
      enviado_seguradora:{ icon:'📋', txt:'Este orçamento já foi enviado à seguradora.' },
      aprovado:          { icon:'✅', txt:'Este orçamento já foi aprovado pelo cliente.' },
      reprovado:         { icon:'❌', txt:'Este orçamento foi reprovado.' },
      executado:         { icon:'🎉', txt:'Este orçamento já foi executado.' },
      cancelado:         { icon:'🚫', txt:'Este orçamento foi cancelado.' },
    }
    const m = msgs[orc.status] || { icon:'ℹ️', txt:'Este orçamento não está disponível para preenchimento.' }
    return (
      <div style={{ minHeight:'100vh', background:'#f0f4fb', padding:'20px' }}>
        <div className="orc-page">
          <div className="orc-header-pub">
            {config?.logoUrl && <img src={config.logoUrl} alt="logo" />}
            <div>
              <div className="orc-empresa-nome">{config?.nome || empresa?.nome}</div>
              <div className="orc-numero">Orçamento {orc.numero}</div>
            </div>
          </div>
          <div className="orc-section-pub" style={{ borderRadius:'0 0 var(--r-lg) var(--r-lg)', textAlign:'center', padding:'40px 28px' }}>
            <div style={{ fontSize:52, marginBottom:12 }}>{m.icon}</div>
            <h3 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'1.2rem', fontWeight:900, color:'var(--primary)', marginBottom:8 }}>
              Orçamento já processado
            </h3>
            <p style={{ color:'var(--muted)', fontSize:'.9rem' }}>{m.txt}</p>
          </div>
        </div>
      </div>
    )
  }

  // ── RENDER: SUCESSO ──────────────────────────────────────────
  if (sucesso) {
    return (
      <div className="success-screen">
        <div className="success-icon">📤</div>
        <h2>Orçamento Enviado!</h2>
        <p>O administrador irá revisar os valores e entrar em contato com o cliente.</p>
        <div className="success-badge">✅ Em revisão</div>
      </div>
    )
  }

  const nomeEmpresa = config?.nome || empresa?.nome || 'AssistHub'

  return (
    <div style={{ background:'#f0f4fb', minHeight:'100vh' }}>
      {/* Banner offline */}
      {!online && <div className="offline-banner">📵 Sem conexão — os dados serão enviados ao reconectar</div>}

      <div className="orc-page">
        {/* Header */}
        <div className="orc-header-pub">
          {config?.logoUrl
            ? <img src={config.logoUrl} alt="logo" />
            : <div style={{ width:44, height:44, background:'var(--accent)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>🔧</div>
          }
          <div>
            <div className="orc-empresa-nome">{nomeEmpresa}</div>
            <div className="orc-numero">Orçamento {orc.numero}</div>
          </div>
        </div>

        {/* Seção 1 — Dados do cliente (leitura) */}
        <div className="orc-section-pub">
          <div className="orc-section-title">👤 Dados do Cliente</div>
          <div className="row col-2">
            <div className="field">
              <label>Nome</label>
              <input className="locked" readOnly value={orc.nome_cliente || ''} />
            </div>
            <div className="field">
              <label>Telefone</label>
              <input className="locked" readOnly value={orc.tel_cliente || ''} />
            </div>
          </div>
          <div className="row col-2">
            <div className="field">
              <label>Endereço</label>
              <input className="locked" readOnly value={orc.endereco || ''} />
            </div>
            <div className="field">
              <label>Cidade</label>
              <input className="locked" readOnly value={orc.cidade || ''} />
            </div>
          </div>
        </div>

        {/* Seção 2 — Diagnóstico */}
        <div className="orc-section-pub">
          <div className="orc-section-title">🔍 Diagnóstico Técnico</div>
          <div className="field">
            <label>Diagnóstico encontrado no local <span className="req">*</span></label>
            <textarea
              rows={5}
              className={erros.diagnostico ? 'error' : ''}
              value={diagnostico}
              onChange={e => { setDiagnostico(e.target.value); setErros(p => ({...p, diagnostico:''})) }}
              placeholder="Descreva detalhadamente o problema encontrado após inspeção..."
            />
            {erros.diagnostico && <span style={{ color:'var(--danger)', fontSize:'.78rem' }}>{erros.diagnostico}</span>}
          </div>
        </div>

        {/* Seção 3 — Equipamento (linha branca) */}
        {orc.tipo === 'linha_branca' && (
          <div className="orc-section-pub">
            <div className="orc-section-title">🏠 Equipamento</div>
            <div className="row col-2">
              <div className="field">
                <label>Tipo</label>
                <input className="locked" readOnly value={orc.tipo_equipamento || ''} />
              </div>
              <div className="field">
                <label>Marca</label>
                <input className="locked" readOnly value={orc.marca || ''} />
              </div>
            </div>
            <div className="row col-2">
              <div className="field">
                <label>Modelo</label>
                <input className="locked" readOnly value={orc.modelo || ''} />
              </div>
              <div className="field">
                <label>Voltagem</label>
                <input className="locked" readOnly value={orc.voltagem || ''} />
              </div>
            </div>
            <div className="row col-1">
              <div className="field">
                <label>Número de Série (opcional)</label>
                <input
                  value={numSerie}
                  onChange={e => setNumSerie(e.target.value)}
                  placeholder="Ex: BRT20240001"
                />
              </div>
            </div>
            {orc.defeito && (
              <div className="field" style={{ marginTop:8 }}>
                <label>Defeito relatado pelo cliente</label>
                <textarea className="locked" readOnly rows={2} value={orc.defeito} />
              </div>
            )}
          </div>
        )}

        {/* Seção 3b — Emergencial */}
        {orc.tipo === 'emergencial' && orc.desc_problema && (
          <div className="orc-section-pub">
            <div className="orc-section-title">⚡ Emergência</div>
            <div className="field">
              <label>Descrição do problema</label>
              <textarea className="locked" readOnly rows={3} value={orc.desc_problema} />
            </div>
          </div>
        )}

        {/* Seção 4 — Itens do orçamento */}
        <div className="orc-section-pub">
          <div className="orc-section-title">📋 Itens do Orçamento</div>
          {erros.itens && <div className="err-msg">{erros.itens}</div>}

          <div style={{ overflowX:'auto' }}>
            <table className="itens-table">
              <thead>
                <tr>
                  <th style={{ width:'45%' }}>Descrição da peça/serviço</th>
                  <th style={{ width:'10%' }}>Qtd</th>
                  <th style={{ width:'20%' }}>Vlr Unit.</th>
                  <th style={{ width:'18%' }}>Total</th>
                  <th style={{ width:'7%' }}></th>
                </tr>
              </thead>
              <tbody>
                {itens.map(it => (
                  <tr key={it.id}>
                    <td>
                      <input
                        type="text"
                        placeholder="Ex: Compressor 1/4 HP"
                        value={it.descricao}
                        onChange={e => atualizarItem(it.id, 'descricao', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        style={{ width:60 }}
                        value={it.quantidade}
                        onChange={e => atualizarItem(it.id, 'quantidade', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        placeholder="0,00"
                        inputMode="decimal"
                        value={it.valor_unit}
                        onChange={e => atualizarItem(it.id, 'valor_unit', e.target.value)}
                      />
                    </td>
                    <td style={{ fontWeight:700, color:'var(--primary)', whiteSpace:'nowrap' }}>
                      {fmtBRL(parseBRL(it.valor_unit) * (parseInt(it.quantidade)||1))}
                    </td>
                    <td>
                      <button className="btn-remove-item" onClick={() => removerItem(it.id)} title="Remover">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button className="btn-add-item" onClick={addItem}>
            ＋ Adicionar item
          </button>

          <div className="orc-subtotal">
            Subtotal: {fmtBRL(totalItens)}
          </div>
        </div>

        {/* Seção 5 — Forma de pagamento */}
        <div className="orc-section-pub">
          <div className="orc-section-title">💳 Forma de Pagamento Sugerida</div>
          <div className="radio-group">
            {[
              { v:'pix',       label:'PIX' },
              { v:'dinheiro',  label:'Dinheiro' },
              { v:'cartao',    label:'Cartão' },
              { v:'a_combinar',label:'A combinar' },
            ].map(op => (
              <label
                key={op.v}
                className={`ri ${formaPagto === op.v ? 'rs' : ''}`}
                onClick={() => setFormaPagto(op.v)}
              >
                <span className="rdot"><span className="rdot-i" /></span>
                {op.label}
              </label>
            ))}
          </div>
        </div>

        {/* Seção 6 — Observações */}
        <div className="orc-section-pub">
          <div className="orc-section-title">📝 Observações</div>
          <div className="field">
            <label>Observações adicionais (opcional)</label>
            <textarea
              rows={3}
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Alguma observação técnica adicional..."
            />
          </div>
        </div>

        {/* Botão enviar */}
        <div style={{ padding:'0 0 20px' }}>
          <button
            className="btn-orc-submit"
            onClick={handleSubmit}
            disabled={salvando}
          >
            {salvando ? '⏳ Enviando...' : '📤 Enviar para Revisão do Admin'}
          </button>
        </div>
      </div>
    </div>
  )
}
