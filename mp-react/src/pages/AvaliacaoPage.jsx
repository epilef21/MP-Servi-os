// ============================================================
// AVALIAÇÃO PAGE — Pesquisa de satisfação pública
// Acessível em /avaliacao/:slug/:osId — sem autenticação
// ============================================================
import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  db,
  getEmpresaBySlug,
  atualizarOS,
  doc,
  getDoc,
  serverTimestamp,
} from '../firebase.js'

// Formata data YYYY-MM-DD → DD/MM/YYYY
function fmtDate(d) {
  if (!d) return '—'
  if (typeof d === 'string' && d.includes('-')) {
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }
  return d
}

export default function AvaliacaoPage() {
  const { slug, osId } = useParams()
  const [searchParams] = useSearchParams()
  const linkToken = searchParams.get('t')

  // ── Estado de carregamento / dados ──────────────────────
  const [loading,     setLoading]     = useState(true)
  const [erro,        setErro]        = useState(null)
  const [os,          setOs]          = useState(null)
  const [empresaId,   setEmpresaId]   = useState(null)

  // ── Estado do formulário de avaliação ───────────────────
  const [nota,        setNota]        = useState(0)
  const [hover,       setHover]       = useState(0)
  const [comentario,  setComentario]  = useState('')
  const [enviando,    setEnviando]    = useState(false)
  const [enviado,     setEnviado]     = useState(false)
  const [jaAvaliado,  setJaAvaliado]  = useState(false)

  // ── Carrega empresa e OS ao montar ──────────────────────
  useEffect(() => {
    async function carregar() {
      setLoading(true)
      setErro(null)
      try {
        // 1. Busca empresa pelo slug para obter empresaId
        const empresa = await getEmpresaBySlug(slug)
        if (!empresa) {
          setErro('Empresa não encontrada.')
          setLoading(false)
          return
        }

        // 2. Busca o documento da OS na subcoleção da empresa
        const osRef  = doc(db, 'empresas', empresa.id, 'checklist', osId)
        const osSnap = await getDoc(osRef)

        if (!osSnap.exists()) {
          setErro('Ordem de serviço não encontrada.')
          setLoading(false)
          return
        }

        const dadosOs = { id: osSnap.id, ...osSnap.data() }

        // Valida token: se a OS tem publicToken, o link precisa trazer o correto
        if (dadosOs.publicToken && linkToken !== dadosOs.publicToken) {
          setErro('Link de avaliação inválido. Solicite um novo link.')
          setLoading(false)
          return
        }

        setOs(dadosOs)
        setEmpresaId(empresa.id)

        // Se já foi avaliado, bloqueia novo envio
        if (dadosOs.avaliacao_nota) {
          setJaAvaliado(true)
          setNota(dadosOs.avaliacao_nota)
          setComentario(dadosOs.avaliacao_comentario || '')
        }
      } catch (err) {
        console.error('[AvaliacaoPage] Erro:', err)
        setErro('Não foi possível carregar os dados. Tente novamente.')
      } finally {
        setLoading(false)
      }
    }

    if (slug && osId) carregar()
  }, [slug, osId])

  // ── Envia avaliação ao Firestore ─────────────────────────
  async function handleEnviar() {
    if (!nota) return
    setEnviando(true)
    try {
      await atualizarOS(empresaId, osId, {
        avaliacao_nota:       nota,
        avaliacao_comentario: comentario.trim() || '',
        avaliacao_em:         serverTimestamp(),
      })
      setEnviado(true)
    } catch (err) {
      console.error('[AvaliacaoPage] Erro ao salvar:', err)
      alert('Erro ao enviar avaliação. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  // ── Estados visuais ──────────────────────────────────────
  if (loading) {
    return (
      <div style={styles.center}>
        <div className="spinner" />
        <p style={{ color: '#1a3a5c', marginTop: 16, fontFamily: 'Barlow, sans-serif' }}>
          Carregando...
        </p>
      </div>
    )
  }

  if (erro) {
    return (
      <div style={styles.center}>
        <div style={styles.erroCard}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>😕</div>
          <p style={{ color: '#c0392b', fontWeight: 600 }}>{erro}</p>
        </div>
      </div>
    )
  }

  // Tela de agradecimento após envio
  if (enviado) {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🙏</div>
          <h2 style={styles.titulo}>Obrigado pela avaliação!</h2>
          <p style={styles.subtitulo}>
            Seu feedback é muito importante para melhorarmos nossos serviços.
          </p>
          <div style={styles.estrelasDisplay}>
            {[1,2,3,4,5].map(i => (
              <span key={i} style={{ color: i <= nota ? '#f0c020' : '#ddd', fontSize: '2rem' }}>★</span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Tela de "já avaliado"
  if (jaAvaliado) {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✅</div>
          <h2 style={styles.titulo}>Você já avaliou este atendimento</h2>
          <p style={styles.subtitulo}>Sua opinião já foi registrada. Obrigado!</p>
          <div style={styles.estrelasDisplay}>
            {[1,2,3,4,5].map(i => (
              <span key={i} style={{ color: i <= nota ? '#f0c020' : '#ddd', fontSize: '2rem' }}>★</span>
            ))}
          </div>
          {comentario && (
            <div style={styles.comentarioExibido}>
              <em>"{comentario}"</em>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Formulário principal ─────────────────────────────────
  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>

        {/* Cabeçalho */}
        <div style={styles.headerIcon}>⭐</div>
        <h1 style={styles.titulo}>Como foi seu atendimento?</h1>
        <p style={styles.subtitulo}>Sua opinião nos ajuda a melhorar</p>

        {/* Dados da OS */}
        <div style={styles.infoBox}>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>👤 Segurado</span>
            <span style={styles.infoVal}>{os?.nome_segurado || '—'}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>🏢 Seguradora</span>
            <span style={styles.infoVal}>{os?.seguradora || '—'}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>📅 Data</span>
            <span style={styles.infoVal}>{fmtDate(os?.data_chegada)}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>🔧 Serviço</span>
            <span style={styles.infoVal}>{os?.servico || '—'}</span>
          </div>
        </div>

        {/* Estrelas */}
        <div style={styles.pergunta}>Como você avalia o atendimento?</div>
        <div style={styles.estrelasWrap}>
          {[1,2,3,4,5].map(i => (
            <span
              key={i}
              style={{
                fontSize: '2.8rem',
                cursor: 'pointer',
                color: i <= (hover || nota) ? '#f0c020' : '#ccc',
                transition: 'color 0.15s, transform 0.1s',
                transform: i <= (hover || nota) ? 'scale(1.15)' : 'scale(1)',
                display: 'inline-block',
                padding: '4px 6px',
                userSelect: 'none',
              }}
              onClick={() => setNota(i)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(0)}
              title={['', 'Péssimo', 'Ruim', 'Regular', 'Bom', 'Excelente'][i]}
            >
              ★
            </span>
          ))}
        </div>
        {nota > 0 && (
          <div style={styles.notaLabel}>
            {['', 'Péssimo 😞', 'Ruim 😕', 'Regular 😐', 'Bom 😊', 'Excelente 🤩'][nota]}
          </div>
        )}

        {/* Comentário */}
        <div style={styles.fieldWrap}>
          <label style={styles.fieldLabel}>Comentário (opcional)</label>
          <textarea
            rows={4}
            style={styles.textarea}
            placeholder="Conte-nos mais sobre sua experiência..."
            value={comentario}
            onChange={e => setComentario(e.target.value)}
          />
        </div>

        {/* Botão de envio */}
        <button
          style={{
            ...styles.btnEnviar,
            opacity: nota === 0 ? 0.5 : 1,
            cursor: nota === 0 ? 'not-allowed' : 'pointer',
          }}
          onClick={handleEnviar}
          disabled={enviando || nota === 0}
        >
          {enviando ? '⏳ Enviando...' : 'Enviar Avaliação ✅'}
        </button>

        {nota === 0 && (
          <p style={{ textAlign: 'center', color: '#999', fontSize: '.82rem', marginTop: 8 }}>
            Selecione uma nota para continuar
          </p>
        )}
      </div>
    </div>
  )
}

// ── Estilos inline — mantém o visual consistente com o projeto ──
const styles = {
  wrapper: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f0f4f8 0%, #e8edf5 100%)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '24px 16px 48px',
    fontFamily: 'Barlow, sans-serif',
  },
  center: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Barlow, sans-serif',
    padding: '24px',
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 4px 24px rgba(26,58,92,.12)',
    padding: '32px 24px',
    width: '100%',
    maxWidth: 480,
    textAlign: 'center',
  },
  erroCard: {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 4px 24px rgba(0,0,0,.08)',
    padding: '40px 24px',
    textAlign: 'center',
    fontFamily: 'Barlow, sans-serif',
  },
  headerIcon: {
    fontSize: '2.8rem',
    marginBottom: 8,
  },
  titulo: {
    fontSize: '1.4rem',
    fontWeight: 800,
    color: '#1a3a5c',
    margin: '0 0 6px',
    fontFamily: 'Barlow Condensed, Barlow, sans-serif',
  },
  subtitulo: {
    color: '#666',
    fontSize: '.92rem',
    margin: '0 0 20px',
  },
  infoBox: {
    background: '#f5f8fc',
    borderRadius: 10,
    padding: '14px 16px',
    marginBottom: 22,
    textAlign: 'left',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    padding: '5px 0',
    borderBottom: '1px solid #eaeff5',
  },
  infoLabel: {
    color: '#888',
    fontSize: '.82rem',
    whiteSpace: 'nowrap',
    minWidth: 100,
  },
  infoVal: {
    color: '#1a3a5c',
    fontSize: '.88rem',
    fontWeight: 600,
    textAlign: 'right',
  },
  pergunta: {
    fontWeight: 700,
    color: '#1a3a5c',
    fontSize: '1rem',
    marginBottom: 12,
  },
  estrelasWrap: {
    display: 'flex',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 8,
  },
  estrelasDisplay: {
    display: 'flex',
    justifyContent: 'center',
    gap: 4,
    marginTop: 16,
  },
  notaLabel: {
    fontWeight: 700,
    color: '#f0a020',
    fontSize: '1rem',
    marginBottom: 16,
    minHeight: 24,
  },
  fieldWrap: {
    textAlign: 'left',
    marginBottom: 20,
  },
  fieldLabel: {
    display: 'block',
    fontWeight: 600,
    fontSize: '.85rem',
    color: '#555',
    marginBottom: 6,
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1.5px solid #d0dae8',
    fontFamily: 'Barlow, sans-serif',
    fontSize: '.9rem',
    color: '#222',
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  btnEnviar: {
    display: 'block',
    width: '100%',
    padding: '13px',
    background: 'linear-gradient(135deg, #1a3a5c 0%, #2255a4 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontFamily: 'Barlow Condensed, Barlow, sans-serif',
    fontSize: '1.05rem',
    fontWeight: 700,
    letterSpacing: '.5px',
    transition: 'opacity 0.2s',
  },
  comentarioExibido: {
    marginTop: 16,
    padding: '10px 14px',
    background: '#f5f8fc',
    borderRadius: 8,
    color: '#555',
    fontSize: '.9rem',
    fontStyle: 'italic',
  },
}
