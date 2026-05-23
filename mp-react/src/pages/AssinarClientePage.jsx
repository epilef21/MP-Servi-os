// ============================================================
// ASSINAR CLIENTE PAGE — Página pública para o cliente assinar
// Rota: /assinar/:slug/:osId?t=token
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import SignatureCanvas from 'react-signature-canvas'
import { db, doc, getDoc, updateDoc, serverTimestamp, arrayUnion } from '../firebase.js'
import { useEmpresa } from '../hooks/useEmpresa.js'

function fmtDate(d) {
  if (!d) return null
  if (typeof d === 'string' && d.includes('-')) {
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }
  if (d?.toDate) {
    const dt = d.toDate()
    return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`
  }
  return String(d)
}

export default function AssinarClientePage() {
  const { osId } = useParams()
  const [searchParams] = useSearchParams()
  const linkToken = searchParams.get('t')
  const { empresa, config, empresaId, loading: loadingEmpresa } = useEmpresa()

  const [os,          setOs]          = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [erroToken,   setErroToken]   = useState(false)
  const [erro,        setErro]        = useState('')

  const [nomeAssinar, setNomeAssinar] = useState('')
  const [hasSig,      setHasSig]      = useState(false)
  const [erroNome,    setErroNome]    = useState('')
  const [erroSig,     setErroSig]     = useState('')
  const sigRef = useRef(null)

  const [salvando,    setSalvando]    = useState(false)
  const [assinado,    setAssinado]    = useState(false)

  useEffect(() => {
    if (!empresaId || !osId) return
    async function carregar() {
      setLoading(true)
      try {
        const snap = await getDoc(doc(db, `empresas/${empresaId}/checklist`, osId))
        if (!snap.exists()) { setErro('OS não encontrada.'); return }
        const d = snap.data()
        if (d.publicToken && linkToken !== d.publicToken) { setErroToken(true); return }
        // Já assinado — mostra confirmação direto
        if (d.assinatura_segurado) { setAssinado(true) }
        setOs({ id: snap.id, ...d })
      } catch (_) {
        setErro('Erro ao carregar dados.')
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [empresaId, osId, linkToken])

  async function handleAssinar() {
    let ok = true
    if (!nomeAssinar.trim()) { setErroNome('Informe seu nome completo'); ok = false }
    if (!hasSig)             { setErroSig('Assine para confirmar');       ok = false }
    if (!ok) return

    setSalvando(true)
    try {
      const assinatura = sigRef.current?.toDataURL('image/png') || ''
      await updateDoc(doc(db, `empresas/${empresaId}/checklist`, osId), {
        assinatura_segurado:         assinatura,
        nome_assinatura_segurado:    nomeAssinar.trim(),
        status:                      'concluido',
        finalizado_em:               serverTimestamp(),
        status_historico: arrayUnion({
          para:   'concluido',
          quando: new Date().toISOString(),
          por:    'cliente',
        }),
      })
      setAssinado(true)
    } catch (_) {
      alert('Erro ao salvar assinatura. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  // ── LOADING ──────────────────────────────────────────────────
  if (loadingEmpresa || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4fb' }}>
        <div className="loading-state">
          <div className="spinner" />
          <p className="loading-text">Carregando...</p>
        </div>
      </div>
    )
  }

  if (erroToken) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4fb', padding: 20 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 32, textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <h2 style={{ color: 'var(--danger)', marginBottom: 8 }}>Link inválido</h2>
          <p style={{ color: 'var(--muted)', fontSize: '.9rem' }}>Este link não é válido ou foi alterado.</p>
        </div>
      </div>
    )
  }

  if (erro) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4fb', padding: 20 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 32, textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ color: 'var(--danger)', marginBottom: 8 }}>Erro</h2>
          <p style={{ color: 'var(--muted)', fontSize: '.9rem' }}>{erro}</p>
        </div>
      </div>
    )
  }

  if (!os) return null

  const nomeEmpresa = config?.nome || empresa?.nome || 'AssistHub'

  // ── JÁ ASSINADO ──────────────────────────────────────────────
  if (assinado) {
    return (
      <div className="success-screen">
        <div className="success-icon">✅</div>
        <h2>Assinatura confirmada!</h2>
        <p>Obrigado, {os.nome_segurado || 'cliente'}. Seu atendimento foi registrado com sucesso.</p>
        {config?.telefone && (
          <a href={`tel:${config.telefone}`} className="success-badge">📞 {config.telefone}</a>
        )}
      </div>
    )
  }

  const dataExibir   = fmtDate(os.data_atend) || fmtDate(os.data_chegada)
  const horaExibir   = os.hora_chegada
    ? os.hora_chegada + (os.hora_saida ? ' — ' + os.hora_saida : '')
    : null

  // ── PÁGINA PRINCIPAL ─────────────────────────────────────────
  return (
    <div style={{ background: '#f0f4fb', minHeight: '100vh' }}>
      <div className="orc-page">

        {/* Header da empresa */}
        <div className="orc-header-pub">
          {config?.logoUrl
            ? <img src={config.logoUrl} alt="logo" style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 8 }} />
            : <div style={{ width: 44, height: 44, background: 'var(--accent)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🏢</div>
          }
          <div style={{ flex: 1 }}>
            <div className="orc-empresa-nome">{nomeEmpresa}</div>
            {config?.telefone && <div className="orc-empresa-tel">📞 {config.telefone}</div>}
            <div className="orc-numero">Ordem de Serviço — Confirmação</div>
          </div>
        </div>

        {/* Resumo do atendimento */}
        <div className="orc-section-pub">
          <div className="orc-section-title">📋 Resumo do Atendimento</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { l: 'Cliente',  v: os.nome_segurado, span: 2 },
              { l: 'Serviço',  v: os.servico,       span: 2 },
              { l: 'Endereço', v: os.endereco,      span: 2 },
              { l: 'Data',     v: dataExibir },
              { l: 'Horário',  v: horaExibir },
            ].filter(f => f.v).map((f, i) => (
              <div key={i} style={{ gridColumn: f.span ? '1 / -1' : undefined }}>
                <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 3 }}>{f.l}</div>
                <div style={{ fontSize: '.93rem', color: 'var(--text)' }}>{f.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* O que foi feito */}
        {os.desc_servico && (
          <div className="orc-section-pub">
            <div className="orc-section-title">🔧 Serviço Realizado</div>
            <div className="md-text" style={{ whiteSpace: 'pre-wrap' }}>{os.desc_servico}</div>
          </div>
        )}

        {/* Seção de assinatura */}
        <div className="orc-section-pub" style={{ borderRadius: '0 0 var(--r-lg) var(--r-lg)' }}>
          <div className="orc-section-title">✍️ Sua Assinatura</div>

          <div className="orc-aprovacao-box">
            <p style={{ color: 'var(--muted)', fontSize: '.88rem', marginBottom: 16 }}>
              Ao assinar, você confirma que o atendimento descrito acima foi realizado em sua residência.
            </p>

            {/* Nome */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                Nome completo <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                className={`orc-nome-assinar${erroNome ? ' error' : ''}`}
                type="text"
                placeholder="Digite seu nome completo"
                value={nomeAssinar}
                onChange={e => { setNomeAssinar(e.target.value); setErroNome('') }}
              />
              {erroNome && <span style={{ color: 'var(--danger)', fontSize: '.78rem' }}>{erroNome}</span>}
            </div>

            {/* Canvas de assinatura */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                Assinatura digital <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div className={`sig-container orc-sig${hasSig ? ' has-sig' : ''}${erroSig ? ' error-sig' : ''}`}>
                <SignatureCanvas
                  ref={sigRef}
                  penColor="#1a3fa8"
                  canvasProps={{ style: { width: '100%', height: '100%' } }}
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
              {erroSig && <span style={{ color: 'var(--danger)', fontSize: '.78rem', marginTop: 4, display: 'block' }}>{erroSig}</span>}
            </div>

            <button className="btn-orc-submit" onClick={handleAssinar} disabled={salvando}>
              {salvando ? '⏳ Salvando...' : '✅ Confirmar e Assinar'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
