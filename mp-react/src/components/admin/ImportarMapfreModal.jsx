import { useState } from 'react'

// ── Parser do formato real do app Mapfre ────────────────────────────────────
// O app exibe os campos em inglês e endereço sem label.
//
// Formato típico capturado por Google Lens / Live Text:
//   SERVICE ENCANADOR
//   ASSISTANCE 126233080
//   DATE OF SERVICE
//   20/05/26 11:29
//   R. Marco Antônio Ribeiro - Vila Nova Florinea, Assis - SP, 19803-260
//   CONTATO CLIENTE
//   CACILDA SOUZA DA SILVA LUCIANO
//   INFORMAÇÃO ADICIONAL
//   BREVE RELATO: ENCANADOR - VAZAMENTO NA VALVULA DO VASO SANITARIO
//   TELEFONE: 18996341999

function parsearMapfre(raw) {
  const linhas = raw.split('\n').map(l => l.trim()).filter(Boolean)

  // Retorna a próxima linha não vazia após a que contém `label`
  function proximaLinha(label) {
    for (let i = 0; i < linhas.length - 1; i++) {
      if (new RegExp(label, 'i').test(linhas[i])) {
        for (let j = i + 1; j < linhas.length; j++) {
          if (linhas[j]) return linhas[j]
        }
      }
    }
    return ''
  }

  // Retorna tudo após o label na mesma linha  (label seguido de ":" ou espaço)
  function mesmLinha(label) {
    for (const l of linhas) {
      const m = l.match(new RegExp('^' + label + '[:\\s]+(.+)$', 'i'))
      if (m) return m[1].trim()
    }
    return ''
  }

  // DD/MM/YY ou DD/MM/YYYY → YYYY-MM-DD
  function normData(v) {
    if (!v) return ''
    const m4 = v.match(/(\d{2})[/.](\d{2})[/.](\d{4})/)
    if (m4) return `${m4[3]}-${m4[2]}-${m4[1]}`
    const m2 = v.match(/(\d{2})[/.](\d{2})[/.](\d{2})\b/)
    if (m2) return `20${m2[3]}-${m2[2]}-${m2[1]}`
    return ''
  }

  // CEP em qualquer ponto do texto (só dígitos)
  function extrairCep() {
    const m = raw.match(/\b(\d{5})-?(\d{3})\b/)
    return m ? m[1] + m[2] : ''
  }

  // Detecta e parseia linha de endereço sem label
  // Formatos suportados:
  //   "R. STREET, 595 - BAIRRO, CIDADE - SP, 19803-260"
  //   "R. STREET - BAIRRO, CIDADE - SP, 19803-260"
  //   "Brasil /// R. STREET, 595 - BAIRRO, CIDADE - SP, 19803-260, BRASIL// EXTRA"
  function parsearEndereco() {
    for (const linha of linhas) {
      let l = linha
        .replace(/^Brasil\s*\/+\s*/i, '')   // prefixo "Brasil ///"
        .replace(/,?\s*BRASIL\b.*$/i, '')    // sufixo ", BRASIL//..." ou ", BRASIL"
        .trim()

      if (!l.match(/^(R\.|Rua\s|Av\.|Avenida\s|Al\.|Alameda\s|Est\.|Estrada\s|Pç\.|Praça\s|Tv\.|Travessa\s)/i)) continue

      // Remove CEP e tudo depois
      l = l.replace(/,?\s*\d{5}-\d{3}\b.*$/, '').trim()

      // Split por " - "
      const parts = l.split(/\s+-\s+/)
      if (parts.length < 2) return { endereco: l, numero: '' }

      // parts[0]: rua (e talvez número separado por vírgula)
      const comNum = parts[0].match(/^(.+?),\s*(\d+\S*)$/)
      const rua    = comNum ? comNum[1].trim() : parts[0].trim()
      const numero = comNum ? comNum[2].replace(/\D.*$/, '') : ''

      // parts[1]: "BAIRRO, CIDADE" — bairro é tudo menos o último segmento
      const segms  = parts[1].split(',')
      const bairro = segms.length > 1 ? segms.slice(0, -1).join(',').trim() : ''
      const cidade = segms[segms.length - 1].trim()

      // Endereco = rua + bairro (convenção do sistema, igual ao preenchimento por CEP)
      const endereco = bairro ? `${rua} - ${bairro}` : rua

      return { endereco, numero, cidade }
    }
    return { endereco: '', numero: '', cidade: '' }
  }

  // ── Extração dos campos ──────────────────────────────────────────────────

  // ASSISTANCE 126233080 (sem dois-pontos)
  const assistM = raw.match(/\bASSISTANCE\s+(\S+)/i)
  const num_assist = assistM ? assistM[1] : ''

  // SERVICE ENCANADOR (primeira linha que começa com SERVICE, excluindo DATE OF SERVICE)
  let servico = ''
  for (const l of linhas) {
    if (/^SERVICE\s+/i.test(l) && !/DATE/i.test(l)) {
      servico = l.replace(/^SERVICE\s+/i, '').trim()
      break
    }
  }

  // CONTATO CLIENTE → próxima linha é o nome
  const nome_segurado = proximaLinha('CONTATO CLIENTE')

  // TELEFONE: 18996341999
  const tel_segurado = mesmLinha('TELEFONE').replace(/\D/g, '')

  // BREVE RELATO: pode continuar nas próximas linhas
  let desc_problema = ''
  for (let i = 0; i < linhas.length; i++) {
    const m = linhas[i].match(/^BREVE RELATO[:\s]+(.+)/i)
    if (m) {
      desc_problema = m[1].trim()
      for (let j = i + 1; j < linhas.length; j++) {
        const prox = linhas[j]
        // Para ao encontrar um novo cabeçalho de seção
        if (/^(TELEFONE|COBERTURA|TIME OF|INFORMAÇÃO|CONTATO)/i.test(prox)) break
        if (/^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]+$/.test(prox) && prox.length < 40) break
        desc_problema += ' ' + prox
      }
      break
    }
  }

  // DATE OF SERVICE → próxima linha com padrão de data
  let data_agendada = ''
  for (let i = 0; i < linhas.length; i++) {
    if (/DATE OF SERVICE/i.test(linhas[i])) {
      for (let j = i + 1; j < linhas.length; j++) {
        const v = normData(linhas[j])
        if (v) { data_agendada = v; break }
      }
      break
    }
  }

  const { endereco, numero, cidade } = parsearEndereco()
  const cep = extrairCep()

  return {
    seguradora:    'Mapfre',
    num_assist,
    nome_segurado,
    tel_segurado,
    cep,
    endereco,
    numero,
    cidade,
    servico,
    desc_problema,
    data_agendada,
  }
}

// ── Labels dos campos para exibição ─────────────────────────────────────────
const LABELS = {
  num_assist:    'Nº Assistência',
  nome_segurado: 'Segurado',
  tel_segurado:  'Telefone',
  cep:           'CEP',
  endereco:      'Endereço (rua + bairro)',
  numero:        'Número',
  cidade:        'Cidade',
  servico:       'Serviço',
  desc_problema: 'Breve Relato / Descrição',
  data_agendada: 'Data Agendada',
}

export default function ImportarMapfreModal({ onClose, onImportar }) {
  const [texto,   setTexto]   = useState('')
  const [parsed,  setParsed]  = useState(null)
  const [editado, setEditado] = useState({})

  function analisar() {
    const r = parsearMapfre(texto)
    setParsed(r)
    setEditado({ ...r })
  }

  function resetar() {
    setParsed(null)
    setEditado({})
    setTexto('')
  }

  const camposOk = parsed
    ? Object.keys(LABELS).filter(k => editado[k]).length
    : 0
  const total = Object.keys(LABELS).length
  const bom   = camposOk >= 6

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
                No app Mapfre, abra a OS e use <strong>Google Lens</strong> (Android) ou <strong>Live Text</strong> (iPhone) para selecionar e copiar todo o texto da tela. Cole abaixo.
              </div>
              <div className="field" style={{ marginTop: 16 }}>
                <label>Texto copiado da OS Mapfre</label>
                <textarea
                  rows={11}
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  placeholder={
                    'Cole o texto aqui. Exemplo do formato esperado:\n\n' +
                    'SERVICE ENCANADOR\n' +
                    'ASSISTANCE 126233080\n' +
                    'DATE OF SERVICE\n' +
                    '20/05/26 11:29\n' +
                    'R. Marco Antônio Ribeiro - Vila Nova Florinea, Assis - SP, 19803-260\n' +
                    'CONTATO CLIENTE\n' +
                    'CACILDA SOUZA DA SILVA LUCIANO\n' +
                    'BREVE RELATO: VAZAMENTO NA VALVULA DO VASO SANITARIO\n' +
                    'TELEFONE: 18996341999'
                  }
                  style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '.8rem' }}
                />
              </div>
            </>
          ) : (
            <>
              <div style={{
                background: bom ? '#eaf7ed' : '#fff8e1',
                border: `1px solid ${bom ? 'var(--success)' : '#f0a020'}`,
                borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '.85rem',
              }}>
                {bom
                  ? `✅ ${camposOk}/${total} campos reconhecidos. Revise e ajuste se necessário.`
                  : `⚠️ Só ${camposOk}/${total} campos reconhecidos. Preencha os campos em branco antes de importar.`
                }
              </div>

              <div className="os-grid">
                {Object.entries(LABELS).map(([campo, label]) => {
                  const vazio = !editado[campo]
                  const isTextarea = campo === 'desc_problema'
                  return (
                    <div key={campo} className="field"
                      style={isTextarea ? { gridColumn: '1 / -1' } : {}}>
                      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{label}</span>
                        {vazio && <span style={{ color: 'var(--danger)', fontSize: '.72rem', fontWeight: 600 }}>não encontrado</span>}
                      </label>
                      {isTextarea
                        ? <textarea rows={3}
                            value={editado[campo] || ''}
                            onChange={e => setEditado(p => ({ ...p, [campo]: e.target.value }))}
                            style={vazio ? { borderColor: '#f0a020' } : {}}
                          />
                        : <input
                            type={campo === 'data_agendada' ? 'date' : 'text'}
                            value={editado[campo] || ''}
                            onChange={e => setEditado(p => ({ ...p, [campo]: e.target.value }))}
                            style={vazio ? { borderColor: '#f0a020' } : {}}
                          />
                      }
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          {!parsed ? (
            <>
              <button className="btn-sm"
                style={{ background: 'var(--light)', color: 'var(--muted)', border: '1px solid var(--border)' }}
                onClick={onClose}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={analisar} disabled={!texto.trim()}
                style={{ padding: '9px 22px', fontSize: '.9rem' }}>
                🔍 Analisar Texto
              </button>
            </>
          ) : (
            <>
              <button className="btn-sm"
                style={{ background: 'var(--light)', color: 'var(--muted)', border: '1px solid var(--border)' }}
                onClick={resetar}>
                ↩ Colar novo texto
              </button>
              <button className="btn-primary" onClick={() => onImportar(editado)}
                style={{ padding: '9px 22px', fontSize: '.9rem' }}>
                📋 Abrir no formulário de OS
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
