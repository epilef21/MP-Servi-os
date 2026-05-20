import { useState } from 'react'

// ── Parser de texto Mapfre (Google Lens / iPhone Live Text) ─────────────────
// Tenta extrair campos da OS a partir de texto OCR livre.
function parsearMapfre(raw) {
  const linhas = raw.split('\n').map(l => l.trim()).filter(Boolean)
  const texto = linhas.join('\n').toUpperCase()

  // Busca valor depois de um label. Retorna string ou ''.
  function buscar(padroes, textoFonte = texto) {
    for (const p of padroes) {
      // Tenta "LABEL: VALOR" ou "LABEL VALOR" na mesma linha
      const re = new RegExp(p + '[:\\s]+([^\\n]+)', 'i')
      const m = textoFonte.match(re)
      if (m) return m[1].trim()
    }
    return ''
  }

  // Extrai o primeiro CEP no formato 00000-000 ou 00000000
  function extrairCep() {
    const m = raw.match(/\b(\d{5})[- ]?(\d{3})\b/)
    if (m) return m[1] + m[2] // só dígitos
    return ''
  }

  // Converte DD/MM/AAAA → AAAA-MM-DD para input type=date
  function normalizarData(v) {
    if (!v) return ''
    const m = v.match(/(\d{2})[/.-](\d{2})[/.-](\d{4})/)
    if (m) return `${m[3]}-${m[2]}-${m[1]}`
    const m2 = v.match(/(\d{4})[/.-](\d{2})[/.-](\d{2})/)
    if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`
    return ''
  }

  // Separa endereço e número quando vêm juntos: "RUA X, 123" ou "RUA X Nº 123"
  function separarEndereco(enderecoRaw) {
    if (!enderecoRaw) return { endereco: '', numero: '' }
    const mVirgula = enderecoRaw.match(/^(.+?),\s*(\d+\S*)$/)
    if (mVirgula) return { endereco: mVirgula[1].trim(), numero: mVirgula[2].trim() }
    const mNr = enderecoRaw.match(/^(.+?)\s+[Nn][º°.]?\s*(\d+\S*)$/)
    if (mNr) return { endereco: mNr[1].trim(), numero: mNr[2].trim() }
    return { endereco: enderecoRaw.trim(), numero: '' }
  }

  const num_assist_raw = buscar([
    'N[°º]\\s*(?:DA\\s+)?(?:OS|ASSIST[EÊ]NCIA|ATENDIMENTO|ORDEM|CHAMADO)',
    'N[°º]',
    'NUM\\s*(?:ERO)?\\s*(?:DA\\s+)?(?:OS|ASSIST)',
    'C[ÓO]D(?:IGO)?\\s*(?:DO\\s+)?ATENDIMENTO',
    'PROTOCOLO',
    'OS',
  ])

  const enderecoRaw = buscar([
    'ENDERE[ÇC]O', 'LOGRADOURO', 'RUA', 'AV(?:ENIDA)?', 'ESTRADA',
  ])
  const { endereco, numero: numeroParsed } = separarEndereco(enderecoRaw)

  const numeroRaw = buscar(['N[°º]\\s*(?:RESID|CASA|IMOVEL|IMÓVEL|PORTA)?', 'NUMERO', 'NÚMERO']) || numeroParsed

  // Data: aceita "AGENDAMENTO", "AGENDADA", "PREVISTA", "DATA"
  const dataRaw = buscar([
    'DATA\\s+(?:DE\\s+)?AGEND', 'AGEND(?:AMENTO|ADA)?', 'DATA\\s+PREVISTA', 'DATA',
  ])

  return {
    seguradora: 'Mapfre',
    num_assist:    num_assist_raw,
    nome_segurado: buscar(['NOME\\s+DO\\s+SEGURADO', 'SEGURADO', 'CLIENTE', 'NOME']),
    tel_segurado:  buscar(['TELEFONE', 'CELULAR', 'FONE', 'TEL']).replace(/\D/g, ''),
    cep:           extrairCep(),
    endereco,
    numero:        numeroRaw.replace(/\D.*$/, ''), // só dígitos iniciais
    bairro:        buscar(['BAIRRO']),
    cidade:        buscar(['CIDADE', 'MUNIC[IÍ]PIO']).replace(/\s*[\/-]\s*[A-Z]{2}$/, '').trim(),
    servico:       buscar(['TIPO\\s+(?:DE\\s+)?SERVI[ÇC]O', 'SERVI[ÇC]O', 'COBERTURA', 'TIPO']),
    desc_problema: buscar(['DESCRI[ÇC][ÃA]O\\s+(?:DO\\s+SERVI[ÇC]O)?', 'DESCRI[ÇC][ÃA]O', 'PROBLEMA', 'OBSERVA[ÇC][ÃA]O']),
    data_agendada: normalizarData(dataRaw),
  }
}

// ── Mapeamento de campos para label legível ──────────────────────────────────
const LABELS = {
  num_assist:    'Nº Assistência',
  nome_segurado: 'Segurado',
  tel_segurado:  'Telefone',
  cep:           'CEP',
  endereco:      'Endereço',
  numero:        'Número',
  bairro:        'Bairro',
  cidade:        'Cidade',
  servico:       'Serviço',
  desc_problema: 'Descrição',
  data_agendada: 'Data Agendada',
}

export default function ImportarMapfreModal({ onClose, onImportar }) {
  const [texto, setTexto] = useState('')
  const [parsed, setParsed] = useState(null)
  const [editado, setEditado] = useState({})

  function analisar() {
    const resultado = parsearMapfre(texto)
    setParsed(resultado)
    setEditado({ ...resultado })
  }

  function resetar() {
    setParsed(null)
    setEditado({})
    setTexto('')
  }

  function handleImportar() {
    onImportar(editado)
  }

  const camposPreenchidos = parsed
    ? Object.entries(LABELS).filter(([k]) => editado[k]).length
    : 0
  const totalCampos = Object.keys(LABELS).length

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <h2>📱 Importar OS — Mapfre</h2>
          <button className="btn-sm" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={onClose}>
            ✕ Fechar
          </button>
        </div>

        <div className="modal-body">
          {!parsed ? (
            <>
              <div className="os-callout">
                Cole abaixo o texto copiado do app Mapfre via <strong>Google Lens</strong> ou <strong>iPhone Live Text</strong>. O sistema tentará extrair os campos automaticamente.
              </div>
              <div className="field" style={{ marginTop: 16 }}>
                <label>Texto da OS Mapfre</label>
                <textarea
                  rows={12}
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  placeholder={'Cole aqui o texto da OS...\n\nExemplo:\nN° OS: 2024-00123\nSegurado: JOÃO SILVA\nTelefone: (11) 98765-4321\nEndereço: RUA DAS FLORES, 123\nCidade: CAMPINAS\nCEP: 13040-001\nServiço: Hidráulico\nDescrição: Vazamento na torneira...'}
                  style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '.82rem' }}
                />
              </div>
            </>
          ) : (
            <>
              <div style={{
                background: camposPreenchidos >= 5 ? 'var(--success-light, #eaf7ed)' : '#fff8e1',
                border: `1px solid ${camposPreenchidos >= 5 ? 'var(--success)' : '#f0a020'}`,
                borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '.85rem'
              }}>
                {camposPreenchidos >= 5
                  ? `✅ ${camposPreenchidos}/${totalCampos} campos reconhecidos. Revise e ajuste se necessário.`
                  : `⚠️ Só ${camposPreenchidos}/${totalCampos} campos reconhecidos. Preencha os campos em branco antes de importar.`
                }
              </div>

              <div className="os-grid">
                {Object.entries(LABELS).map(([campo, label]) => (
                  <div key={campo} className="field" style={campo === 'desc_problema' ? { gridColumn: '1 / -1' } : {}}>
                    <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{label}</span>
                      {!editado[campo] && <span style={{ color: 'var(--danger)', fontSize: '.75rem' }}>não encontrado</span>}
                    </label>
                    {campo === 'desc_problema'
                      ? <textarea rows={3} value={editado[campo] || ''} onChange={e => setEditado(p => ({ ...p, [campo]: e.target.value }))} />
                      : <input value={editado[campo] || ''} onChange={e => setEditado(p => ({ ...p, [campo]: e.target.value }))}
                          type={campo === 'data_agendada' ? 'date' : 'text'}
                          style={!editado[campo] ? { borderColor: '#f0a020' } : {}} />
                    }
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          {!parsed ? (
            <>
              <button className="btn-sm" style={{ background: 'var(--light)', color: 'var(--muted)', border: '1px solid var(--border)' }} onClick={onClose}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={analisar} disabled={!texto.trim()} style={{ padding: '9px 22px', fontSize: '.9rem' }}>
                🔍 Analisar Texto
              </button>
            </>
          ) : (
            <>
              <button className="btn-sm" style={{ background: 'var(--light)', color: 'var(--muted)', border: '1px solid var(--border)' }} onClick={resetar}>
                ↩ Colar novo texto
              </button>
              <button className="btn-primary" onClick={handleImportar} style={{ padding: '9px 22px', fontSize: '.9rem' }}>
                📋 Abrir no formulário de OS
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
