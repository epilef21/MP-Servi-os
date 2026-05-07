// ============================================================
// RELATÓRIO PAGE — Página pública do relatório técnico de OS
// Rota: /relatorio/:slug/:osId — sem autenticação
// Acessível por seguradoras via link compartilhado
// ============================================================
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  db,
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
} from '../firebase.js'

function fmtDate(d) {
  if (!d) return '—'
  if (typeof d === 'string' && d.includes('-')) {
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }
  return d
}

function SN({ v }) {
  if (v === 'sim') return <span className="rel-conclusao-sim">SIM</span>
  if (v === 'nao') return <span className="rel-conclusao-nao">NÃO</span>
  return <span style={{ color: 'var(--muted)' }}>—</span>
}

export default function RelatorioPage() {
  const { slug, osId } = useParams()
  const [loading,  setLoading]  = useState(true)
  const [erro,     setErro]     = useState(null)
  const [os,       setOs]       = useState(null)
  const [empresa,  setEmpresa]  = useState(null)
  const [linkCopied, setLinkCopied] = useState(false)

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      setErro(null)
      try {
        // 1. Busca empresa pelo slug
        const empresaSnap = await getDocs(
          query(collection(db, 'empresas'), where('slug', '==', slug))
        )
        if (empresaSnap.empty) {
          setErro('Empresa não encontrada.')
          return
        }
        const emp = { id: empresaSnap.docs[0].id, ...empresaSnap.docs[0].data() }
        setEmpresa(emp)

        // 2. Busca OS dentro da empresa
        const osSnap = await getDoc(doc(db, `empresas/${emp.id}/checklist/${osId}`))
        if (!osSnap.exists()) {
          setErro('Relatório não encontrado.')
          return
        }
        setOs({ id: osSnap.id, ...osSnap.data() })
      } catch (e) {
        setErro('Erro ao carregar o relatório. Tente novamente.')
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [slug, osId])

  function copiarLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    })
  }

  // ── Loading ──────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16 }}>
        <div style={{ width: 48, height: 48, border: '4px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: 'var(--muted)', fontSize: '.9rem' }}>Carregando relatório…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── Erro ─────────────────────────────────────────────────
  if (erro) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 12, padding: '0 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>🔍</div>
        <h2 style={{ color: 'var(--primary)', fontFamily: 'Barlow Condensed, sans-serif' }}>Relatório não encontrado</h2>
        <p style={{ color: 'var(--muted)', maxWidth: 360 }}>{erro}</p>
      </div>
    )
  }

  // ── Checkup: montar badges dos itens marcados ────────────
  const checkupItens = []
  const checkupFields = [
    ['checkup_eletrica',   'Rev. Elétrica'],
    ['checkup_hidraulica', 'Rev. Hidráulica'],
    ['checkup_gas',        'Rev. Gás'],
    ['checkup_telhado',    'Rev. Telhado'],
    ['checkup_pintura',    'Rev. Pintura'],
    ['checkup_fechaduras', 'Lub. Fechaduras'],
    ['checkup_tomadas',    'Rev. Tomadas'],
    ['checkup_disjuntores','Rev. Disjuntores'],
    ['checkup_infiltracao','Verif. Infiltração'],
    ['checkup_janelas',    'Rev. Janelas'],
    ['checkup_portas',     'Rev. Portas'],
    ['checkup_outro',      'Outro'],
  ]
  checkupFields.forEach(([key, label]) => {
    if (os[key] === true || os[key] === 'true' || os[key] === 1) {
      const qtdKey = `${key}_qtd`
      const qtd = os[qtdKey]
      checkupItens.push(qtd ? `${label} (Qtd: ${qtd})` : label)
    }
  })

  const temCheckup     = checkupItens.length > 0
  const temFotos       = Array.isArray(os.fotos) && os.fotos.length > 0
  const temAssinaturas = os.assinatura_prestador || os.assinatura_segurado
  const temAvarias     = os.avarias && os.avarias.trim()
  const temPecas       = os.pecas && os.pecas.trim()
  const temEspecifique = os.especifique && os.especifique.trim()
  const logoUrl        = empresa?.logoUrl || empresa?.logo_url || null
  const nomeEmpresa    = empresa?.nome || ''
  const telefoneEmpresa = empresa?.telefone || empresa?.whatsapp || ''

  return (
    <>
      {/* ── Barra de ações fixa ────────────────────────────── */}
      <div className="relatorio-topbar">
        <span className="relatorio-topbar-title">
          📋 Relatório OS — {os.nome_segurado || '—'}
        </span>
        <div className="relatorio-topbar-btns">
          <button className="btn-relatorio" onClick={() => window.print()}>
            🖨️ Imprimir
          </button>
          <button className="btn-relatorio" onClick={copiarLink}>
            {linkCopied ? '✅ Copiado!' : '📋 Copiar Link'}
          </button>
          <button className="btn-relatorio" onClick={() => window.close()}>
            ✕ Fechar
          </button>
        </div>
      </div>

      {/* ── Relatório ─────────────────────────────────────── */}
      <div className="relatorio-page">

        {/* HEADER */}
        <div className="rel-header">
          <div>
            {logoUrl && (
              <img src={logoUrl} alt="Logo" className="rel-header-logo" style={{ marginBottom: 8 }} />
            )}
            <div className="rel-header-empresa">{nomeEmpresa}</div>
            <div className="rel-header-sub">Relatório Técnico de Atendimento</div>
          </div>
          <div className="rel-header-right">
            {os.num_assist && (
              <div className="rel-header-assist">Assistência: {os.num_assist}</div>
            )}
            {os.data_chegada && (
              <div className="rel-header-data">Data: {fmtDate(os.data_chegada)}</div>
            )}
            {(os.hora_chegada || os.hora_saida) && (
              <div className="rel-header-data">
                {os.hora_chegada && `Chegada: ${os.hora_chegada}`}
                {os.hora_chegada && os.hora_saida && '  '}
                {os.hora_saida && `Saída: ${os.hora_saida}`}
              </div>
            )}
          </div>
        </div>
        <div className="rel-divider" />

        {/* SEÇÃO: DADOS DO ATENDIMENTO */}
        <div className="rel-section">
          <div className="rel-section-header">Dados do Atendimento</div>
          <div className="rel-section-body">
            <div className="rel-grid-2">
              <div className="rel-field">
                <label>Seguradora</label>
                <p>{os.seguradora || '—'}</p>
              </div>
              <div className="rel-field">
                <label>Nº Assistência</label>
                <p>{os.num_assist || '—'}</p>
              </div>
              <div className="rel-field span-2">
                <label>Serviço</label>
                <p>{os.servico || '—'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* SEÇÃO: DADOS DO SEGURADO */}
        <div className="rel-section">
          <div className="rel-section-header">Dados do Segurado</div>
          <div className="rel-section-body">
            <div className="rel-grid-2">
              <div className="rel-field">
                <label>Nome Completo</label>
                <p>{os.nome_segurado || '—'}</p>
              </div>
              <div className="rel-field">
                <label>Telefone</label>
                <p>{os.tel_segurado || '—'}</p>
              </div>
              <div className="rel-field">
                <label>Endereço</label>
                <p>{[os.endereco, os.numero].filter(Boolean).join(', ') || '—'}</p>
              </div>
              <div className="rel-field">
                <label>Cidade</label>
                <p>{os.cidade || '—'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* SEÇÃO: DESCRIÇÕES */}
        <div className="rel-section">
          <div className="rel-section-header">Descrições</div>
          <div className="rel-section-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {os.desc_problema && (
              <div>
                <div className="rel-field"><label>Descrição do Problema e Serviço a Realizar</label></div>
                <div className="rel-text-box">{os.desc_problema}</div>
              </div>
            )}
            {temAvarias && (
              <div>
                <div className="rel-field"><label>Avarias Pré-existentes</label></div>
                <div className="rel-text-box">{os.avarias}</div>
              </div>
            )}
            {os.desc_servico && (
              <div>
                <div className="rel-field"><label>Descrição do Serviço Realizado</label></div>
                <div className="rel-text-box">{os.desc_servico}</div>
              </div>
            )}
            {temPecas && (
              <div>
                <div className="rel-field"><label>Peças / Materiais Utilizados</label></div>
                <div className="rel-text-box">{os.pecas}</div>
              </div>
            )}
          </div>
        </div>

        {/* SEÇÃO: CHEK-UP (condicional) */}
        {temCheckup && (
          <div className="rel-section">
            <div className="rel-section-header">Chek-up Realizado</div>
            <div className="rel-section-body">
              <div className="rel-checkup-grid">
                {checkupItens.map((item, i) => (
                  <span key={i} className="rel-checkup-badge">✅ {item}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SEÇÃO: CONCLUSÃO */}
        <div className="rel-section">
          <div className="rel-section-header">Conclusão do Serviço</div>
          <div className="rel-section-body">
            <div className="rel-grid-4">
              <div className="rel-field">
                <label>Prob. Solucionado</label>
                <SN v={os.problema_solucionado} />
              </div>
              <div className="rel-field">
                <label>Haverá Retorno</label>
                <SN v={os.havera_retorno} />
              </div>
              <div className="rel-field">
                <label>Garantia 90d</label>
                <SN v={os.garantia_90} />
              </div>
              <div className="rel-field">
                <label>Excedente</label>
                <p>{os.excedente ? `R$ ${os.excedente}` : '—'}</p>
              </div>
            </div>
            {temEspecifique && (
              <div style={{ marginTop: 14 }}>
                <div className="rel-field"><label>Especificação</label></div>
                <div className="rel-text-box">{os.especifique}</div>
              </div>
            )}
          </div>
        </div>

        {/* SEÇÃO: FOTOS (condicional) */}
        {temFotos && (
          <div className="rel-section">
            <div className="rel-section-header">Fotos do Atendimento</div>
            <div className="rel-section-body">
              <div className="rel-fotos-grid">
                {os.fotos.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Foto ${i + 1}`}
                    className="rel-foto"
                    onClick={() => window.open(url, '_blank')}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SEÇÃO: ASSINATURAS (condicional) */}
        {temAssinaturas && (
          <div className="rel-section rel-assinaturas">
            <div className="rel-section-header">Assinaturas</div>
            <div className="rel-section-body">
              <div className="rel-assinaturas-grid">
                <div className="rel-assinatura-box">
                  <label>Assinatura do Prestador</label>
                  {os.assinatura_prestador
                    ? <img src={os.assinatura_prestador} alt="Assinatura Prestador" />
                    : <p style={{ color: 'var(--muted)', fontSize: '.8rem' }}>Não coletada</p>
                  }
                </div>
                <div className="rel-assinatura-box">
                  <label>Assinatura do Segurado</label>
                  {os.assinatura_segurado
                    ? <img src={os.assinatura_segurado} alt="Assinatura Segurado" />
                    : <p style={{ color: 'var(--muted)', fontSize: '.8rem' }}>Não coletada</p>
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="rel-footer">
          <span>AssistHub{telefoneEmpresa ? ` · ${telefoneEmpresa}` : ''}</span>
          <span>Protocolo: {osId.slice(0, 8).toUpperCase()}</span>
        </div>
      </div>
    </>
  )
}
