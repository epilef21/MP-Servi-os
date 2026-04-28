// ============================================================
// APROVAR ORÇAMENTO — Página pública para o cliente
// Rota: /aprovar/:slug/:orcamentoId
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import SignatureCanvas from 'react-signature-canvas'
import { db, doc, getDoc, updateDoc, serverTimestamp } from '../firebase.js'
import { useEmpresa } from '../hooks/useEmpresa.js'

function fmtDate(d) {
  if (!d) return '—'
  if (typeof d === 'string' && d.includes('-')) {
    const [y,m,day] = d.split('-')
    return `${day}/${m}/${y}`
  }
  if (d?.toDate) {
    const dt = d.toDate()
    return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`
  }
  return String(d)
}

function fmtBRL(v) {
  const n = parseFloat(v) || 0
  return n.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
}

function estaVencido(validade) {
  if (!validade) return false
  const hoje = new Date()
  hoje.setHours(0,0,0,0)
  const val  = new Date(validade + 'T00:00:00')
  return val < hoje
}

// Retorna o valor que o cliente paga por item
function valorClienteItem(it, cenario) {
  if (cenario === 'particular' || cenario === 'fora_contrato') {
    return it.valor_total || 0
  }
  return it.paga_cliente !== undefined && it.paga_cliente !== ''
    ? parseFloat(it.paga_cliente) || 0
    : it.valor_total || 0
}

export default function AprovarOrcamentoPage() {
  const { orcamentoId } = useParams()
  const { empresa, config, empresaId, loading: loadingEmpresa } = useEmpresa()

  const [orc,        setOrc]        = useState(null)
  const [loadingOrc, setLoadingOrc] = useState(true)
  const [erroOrc,    setErroOrc]    = useState('')

  // Aprovação
  const [nomeAssinar, setNomeAssinar] = useState('')
  const [hasSig,      setHasSig]     = useState(false)
  const [erroNome,    setErroNome]   = useState('')
  const [erroSig,     setErroSig]    = useState('')
  const sigRef = useRef(null)

  // Reprovação
  const [mostraReprovar,  setMostraReprovar]  = useState(false)
  const [motivoReprovar,  setMotivoReprovar]  = useState('')

  const [salvando,  setSalvando]  = useState(false)
  const [resultado, setResultado] = useState(null) // 'aprovado' | 'reprovado'

  // Carrega o orçamento
  useEffect(() => {
    if (!empresaId || !orcamentoId) return
    async function carregar() {
      setLoadingOrc(true)
      try {
        const ref  = doc(db, `empresas/${empresaId}/orcamentos/${orcamentoId}`)
        const snap = await getDoc(ref)
        if (!snap.exists()) { setErroOrc('Orçamento não encontrado.'); return }
        setOrc({ id: snap.id, ...snap.data() })
      } catch (_) {
        setErroOrc('Erro ao carregar orçamento.')
      } finally {
        setLoadingOrc(false)
      }
    }
    carregar()
  }, [empresaId, orcamentoId])

  // ── APROVAR ─────────────────────────────────────────────────
  async function handleAprovar() {
    let ok = true
    if (!nomeAssinar.trim()) { setErroNome('Informe seu nome completo'); ok = false }
    if (!hasSig) { setErroSig('Assine para confirmar'); ok = false }
    if (!ok) return

    setSalvando(true)
    try {
      const assinatura = sigRef.current?.toDataURL('image/png') || ''
      const ref = doc(db, `empresas/${empresaId}/orcamentos/${orcamentoId}`)
      await updateDoc(ref, {
        status:             'aprovado',
        aprovado_por:       nomeAssinar.trim(),
        assinatura_cliente: assinatura,
        aprovado_em:        serverTimestamp(),
      })
      setResultado('aprovado')
    } catch (_) {
      alert('Erro ao aprovar. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  // ── REPROVAR ─────────────────────────────────────────────────
  async function handleReprovar() {
    setSalvando(true)
    try {
      const ref = doc(db, `empresas/${empresaId}/orcamentos/${orcamentoId}`)
      await updateDoc(ref, {
        status:            'reprovado',
        motivo_reprovacao: motivoReprovar || '',
      })
      setResultado('reprovado')
    } catch (_) {
      alert('Erro ao reprovar. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  // ── LOADING ──────────────────────────────────────────────────
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

  if (erroOrc) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f0f4fb', padding:20 }}>
        <div style={{ background:'#fff', borderRadius:16, padding:32, textAlign:'center', maxWidth:400 }}>
          <div style={{ fontSize:48, marginBottom:12 }}>⚠️</div>
          <h2 style={{ color:'var(--danger)', marginBottom:8 }}>Orçamento não encontrado</h2>
          <p style={{ color:'var(--muted)', fontSize:'.9rem' }}>{erroOrc}</p>
        </div>
      </div>
    )
  }

  if (!orc) return null

  // ── TELA DE RESULTADO ────────────────────────────────────────
  if (resultado === 'aprovado') {
    return (
      <div className="success-screen">
        <div className="success-icon">✅</div>
        <h2>Orçamento Aprovado!</h2>
        <p>Em breve entraremos em contato para agendar o atendimento.</p>
        <div className="success-badge">Aprovado por {nomeAssinar}</div>
      </div>
    )
  }
  if (resultado === 'reprovado') {
    return (
      <div className="success-screen" style={{ background:'linear-gradient(135deg,#5a1010,#c0392b)' }}>
        <div className="success-icon">❌</div>
        <h2>Orçamento Reprovado</h2>
        <p>Obrigado pelo retorno. Qualquer dúvida entre em contato conosco.</p>
        {config?.telefone && (
          <a href={`tel:${config.telefone}`} className="success-badge">📞 {config.telefone}</a>
        )}
      </div>
    )
  }

  const nomeEmpresa = config?.nome || empresa?.nome || 'AssistHub'
  const vencido     = estaVencido(orc.validade)
  const cenario     = orc.cenario || 'particular'
  const cobertoSeg  = cenario === 'material_cliente' || cenario === 'seguradora_cobre_tudo'

  // Itens filtrados: para o cliente, mostrar só itens que ele paga
  const itensMostrar = (orc.itens||[]).filter(it => valorClienteItem(it, cenario) > 0)
  const totalCliente = cobertoSeg
    ? (parseFloat(orc.total_cliente) || 0)
    : (parseFloat(orc.total_geral) || 0)

  // Status que impedem a aprovação
  const statusBloqueados = {
    aguardando_tecnico:  { icon:'🕐', titulo:'Aguardando técnico', msg:'O técnico ainda não preencheu o diagnóstico e os valores.' },
    em_revisao:          { icon:'🔍', titulo:'Em revisão',          msg:'O administrador está revisando os valores antes de enviar para você.' },
    aprovado:            { icon:'✅', titulo:'Já aprovado',          msg:`Este orçamento foi aprovado por ${orc.aprovado_por || 'você'}.` },
    reprovado:           { icon:'❌', titulo:'Orçamento reprovado', msg:'Este orçamento foi reprovado.' },
    executado:           { icon:'🎉', titulo:'Serviço executado',   msg:'Este orçamento já foi executado.' },
    cancelado:           { icon:'🚫', titulo:'Cancelado',           msg:'Este orçamento foi cancelado.' },
    enviado_seguradora:  { icon:'📋', titulo:'Enviado à seguradora', msg:'Este orçamento está sendo processado pela seguradora.' },
  }

  const statusInfo = statusBloqueados[orc.status]
  const podeAprovar = orc.status === 'enviado_cliente' && !vencido

  return (
    <div style={{ background:'#f0f4fb', minHeight:'100vh' }}>
      <div className="orc-page">

        {/* Header */}
        <div className="orc-header-pub">
          {config?.logoUrl
            ? <img src={config.logoUrl} alt="logo" />
            : <div style={{ width:44, height:44, background:'var(--accent)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>🏢</div>
          }
          <div style={{ flex:1 }}>
            <div className="orc-empresa-nome">{nomeEmpresa}</div>
            {config?.telefone && <div className="orc-empresa-tel">📞 {config.telefone}</div>}
            <div className="orc-numero">Orçamento {orc.numero}</div>
          </div>
        </div>

        {/* Seção 1 — Informações gerais */}
        <div className="orc-section-pub">
          <div className="orc-section-title">📅 Informações do Orçamento</div>

          {vencido && (
            <div className="orc-vencido-banner">
              ⚠️ Este orçamento venceu em {fmtDate(orc.validade)}. Entre em contato para solicitar um novo.
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <div style={{ fontSize:'.72rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', marginBottom:3 }}>Emitido em</div>
              <div style={{ fontSize:'.93rem', fontWeight:600 }}>{fmtDate(orc.criado_em)}</div>
            </div>
            <div>
              <div style={{ fontSize:'.72rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', marginBottom:3 }}>Válido até</div>
              <div style={{ fontSize:'.93rem', fontWeight:600, color: vencido ? 'var(--danger)' : 'var(--success)' }}>
                ⏰ {fmtDate(orc.validade)}
              </div>
            </div>
          </div>
        </div>

        {/* Seção 2 — Seus dados */}
        <div className="orc-section-pub">
          <div className="orc-section-title">👤 Seus Dados</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[
              { l:'Nome',     v: orc.nome_cliente },
              { l:'Telefone', v: orc.tel_cliente  },
              { l:'Endereço', v: orc.endereco,     span:2 },
              { l:'Cidade',   v: orc.cidade        },
            ].map((f,i) => (
              <div key={i} style={{ gridColumn: f.span ? `1 / -1` : undefined }}>
                <div style={{ fontSize:'.72rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', marginBottom:3 }}>{f.l}</div>
                <div style={{ fontSize:'.93rem', color:'var(--text)' }}>{f.v || '—'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Seção 3 — Equipamento (linha branca) */}
        {orc.tipo === 'linha_branca' && (
          <div className="orc-section-pub">
            <div className="orc-section-title">🏠 Equipamento</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[
                { l:'Tipo',      v: orc.tipo_equipamento },
                { l:'Marca',     v: orc.marca           },
                { l:'Modelo',    v: orc.modelo          },
                { l:'Voltagem',  v: orc.voltagem        },
              ].map((f,i) => (
                <div key={i}>
                  <div style={{ fontSize:'.72rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', marginBottom:3 }}>{f.l}</div>
                  <div style={{ fontSize:'.93rem' }}>{f.v || '—'}</div>
                </div>
              ))}
            </div>
            {orc.defeito && (
              <div style={{ marginTop:12 }}>
                <div style={{ fontSize:'.72rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', marginBottom:4 }}>Defeito relatado</div>
                <div className="md-text">{orc.defeito}</div>
              </div>
            )}
          </div>
        )}

        {/* Seção 4 — Diagnóstico técnico */}
        {orc.diagnostico && (
          <div className="orc-section-pub">
            <div className="orc-section-title">🔍 Diagnóstico Técnico</div>
            <div className="md-text">{orc.diagnostico}</div>
          </div>
        )}

        {/* Seção 5 — Itens e valores */}
        <div className="orc-section-pub">
          <div className="orc-section-title">💰 Valores</div>

          {cobertoSeg && (
            <div className="orc-seg-nota" style={{ marginBottom:12 }}>
              ℹ️ Parte do serviço é coberta pela seguradora — os valores abaixo são apenas a sua parte.
            </div>
          )}

          {itensMostrar.length > 0 ? (
            <div style={{ overflowX:'auto' }}>
              <table className="itens-table-ro">
                <thead>
                  <tr>
                    <th style={{ width:'60%' }}>Descrição</th>
                    <th style={{ width:'10%' }}>Qtd</th>
                    <th style={{ width:'30%', textAlign:'right' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {itensMostrar.map((it,idx) => {
                    const val = valorClienteItem(it, cenario)
                    return (
                      <tr key={idx}>
                        <td>{it.descricao}</td>
                        <td>{it.quantidade || 1}</td>
                        <td style={{ textAlign:'right', fontWeight:600 }}>{fmtBRL(val)}</td>
                      </tr>
                    )
                  })}
                  <tr className="total-row">
                    <td colSpan={2} style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800 }}>TOTAL</td>
                    <td style={{ textAlign:'right', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'1.05rem', fontWeight:800 }}>
                      {fmtBRL(totalCliente)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color:'var(--muted)', fontSize:'.88rem' }}>Aguardando itens do orçamento.</p>
          )}

          <div className="orc-total-box" style={{ marginTop:14 }}>
            <div>
              <div className="orc-total-label">
                {cobertoSeg ? 'Sua parte a pagar' : 'Total do orçamento'}
              </div>
            </div>
            <div className="orc-total-valor">{fmtBRL(totalCliente)}</div>
          </div>
        </div>

        {/* Seção 6 — Condições */}
        <div className="orc-section-pub">
          <div className="orc-section-title">📋 Condições</div>
          <div className="orc-condicoes">
            {orc.garantia && (
              <div className="orc-cond-item">
                <span>✅</span>
                <div><strong>Garantia</strong><br /><span>{orc.garantia}</span></div>
              </div>
            )}
            {orc.prazo_execucao && (
              <div className="orc-cond-item">
                <span>⏱️</span>
                <div><strong>Prazo</strong><br /><span>{orc.prazo_execucao}</span></div>
              </div>
            )}
            {orc.forma_pagamento && (
              <div className="orc-cond-item">
                <span>💳</span>
                <div><strong>Pagamento</strong><br /><span style={{ textTransform:'capitalize' }}>{orc.forma_pagamento.replace('_',' ')}</span></div>
              </div>
            )}
            {orc.tecnico_nome && (
              <div className="orc-cond-item">
                <span>👷</span>
                <div><strong>Técnico</strong><br /><span>{orc.tecnico_nome}</span></div>
              </div>
            )}
          </div>

          {orc.observacoes && (
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:'.72rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', marginBottom:4 }}>Observações</div>
              <div className="md-text">{orc.observacoes}</div>
            </div>
          )}

          <div className="orc-garantia-nota" style={{ marginTop:12 }}>
            ⚠️ {orc.garantia_obs || 'A garantia é válida somente para peças e materiais fornecidos por nossa empresa. Caso você opte por adquirir materiais de outro fornecedor, a garantia sobre as peças não se aplica.'}
          </div>
        </div>

        {/* Seção 7 — Aprovação ou Estado atual */}
        {podeAprovar ? (
          <div className="orc-section-pub" style={{ borderRadius:'0 0 var(--r-lg) var(--r-lg)' }}>
            <div className="orc-section-title">✍️ Aprovação</div>

            <div className="orc-aprovacao-box">
              <h3>Deseja aprovar este orçamento?</h3>

              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:'.78rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', marginBottom:6 }}>
                  Nome completo para assinar <span style={{ color:'var(--danger)' }}>*</span>
                </label>
                <input
                  className={`orc-nome-assinar${erroNome ? ' error' : ''}`}
                  type="text"
                  placeholder="Digite seu nome completo"
                  value={nomeAssinar}
                  onChange={e => { setNomeAssinar(e.target.value); setErroNome('') }}
                />
                {erroNome && <span style={{ color:'var(--danger)', fontSize:'.78rem' }}>{erroNome}</span>}
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:'.78rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', marginBottom:6 }}>
                  Assinatura digital <span style={{ color:'var(--danger)' }}>*</span>
                </label>
                <div className={`sig-container orc-sig${hasSig ? ' has-sig' : ''}${erroSig ? ' error-sig' : ''}`}>
                  <SignatureCanvas
                    ref={sigRef}
                    penColor="#1a3fa8"
                    canvasProps={{ style:{ width:'100%', height:'100%' } }}
                    onEnd={() => { setHasSig(true); setErroSig('') }}
                  />
                  {!hasSig && (
                    <div className="sig-placeholder">
                      <span>✍️</span>
                      <span>Assine com o dedo ou mouse</span>
                    </div>
                  )}
                  {hasSig && (
                    <button className="sig-clear-btn" onClick={() => { sigRef.current.clear(); setHasSig(false) }}>
                      ✕ Limpar
                    </button>
                  )}
                </div>
                {erroSig && <span style={{ color:'var(--danger)', fontSize:'.78rem', marginTop:4, display:'block' }}>{erroSig}</span>}
              </div>

              {/* Botão aprovar */}
              <button className="btn-orc-submit" onClick={handleAprovar} disabled={salvando}>
                {salvando ? '⏳ Processando...' : '✅ Aprovar e Assinar'}
              </button>

              {/* Botão reprovar */}
              {!mostraReprovar ? (
                <button className="btn-orc-reprovar" onClick={() => setMostraReprovar(true)}>
                  ❌ Reprovar Orçamento
                </button>
              ) : (
                <div style={{ marginTop:12, padding:16, background:'var(--danger-bg)', borderRadius:10, border:'1px solid #fcc' }}>
                  <p style={{ fontSize:'.88rem', color:'var(--danger)', fontWeight:600, marginBottom:10 }}>
                    Tem certeza que deseja reprovar este orçamento?
                  </p>
                  <div className="field" style={{ marginBottom:10 }}>
                    <label>Motivo (opcional)</label>
                    <textarea
                      rows={2}
                      value={motivoReprovar}
                      onChange={e => setMotivoReprovar(e.target.value)}
                      placeholder="Descreva o motivo da reprovação..."
                    />
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button
                      onClick={handleReprovar}
                      disabled={salvando}
                      style={{ flex:1, background:'var(--danger)', color:'#fff', border:'none', borderRadius:8, padding:'11px', fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:'1rem', cursor:'pointer' }}
                    >
                      {salvando ? '...' : 'Confirmar Reprovação'}
                    </button>
                    <button
                      onClick={() => setMostraReprovar(false)}
                      style={{ flex:1, background:'#fff', color:'var(--muted)', border:'1.5px solid var(--border)', borderRadius:8, padding:'11px', fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:'1rem', cursor:'pointer' }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Estados especiais
          <div style={{ padding:'0 0 20px' }}>
            {statusInfo ? (
              <div className={`orc-status-banner ${
                orc.status === 'aprovado' ? 'success' :
                orc.status === 'reprovado' ? 'danger' :
                orc.status === 'executado' ? 'success' :
                'info'
              }`}>
                <div className="osb-icon">{statusInfo.icon}</div>
                <h3>{statusInfo.titulo}</h3>
                <p>{statusInfo.msg}</p>
              </div>
            ) : vencido ? (
              <div className="orc-status-banner danger">
                <div className="osb-icon">⏰</div>
                <h3>Orçamento Vencido</h3>
                <p>Este orçamento venceu em {fmtDate(orc.validade)}. Entre em contato para solicitar um novo.</p>
              </div>
            ) : null}

            {config?.telefone && (
              <div style={{ textAlign:'center', marginTop:16 }}>
                <a
                  href={`https://wa.me/55${config.telefone.replace(/\D/g,'')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-whatsapp"
                  style={{ display:'inline-flex', margin:'0 auto' }}
                >
                  📞 Falar conosco
                </a>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
