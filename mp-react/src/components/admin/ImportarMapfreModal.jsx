import { useState } from 'react'

// ── Helpers compartilhados ──────────────────────────────────────────────────

function linhasOf(raw) {
  return raw.split('\n').map(l => l.trim()).filter(Boolean)
}

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Busca label → valor. Tenta "LABEL: valor" na mesma linha primeiro,
// depois label isolado numa linha e valor na próxima.
function buscar(linhas, labels, exato = true) {
  const lst = [].concat(labels)
  for (const lb of lst) {
    for (const l of linhas) {
      const m = l.match(new RegExp('^' + escRe(lb) + '[:\\s]+(.+)$', 'i'))
      if (m) return m[1].trim()
    }
    for (let i = 0; i < linhas.length - 1; i++) {
      const lineNorm = linhas[i].toLowerCase().replace(/:$/, '').trim()
      const ok = exato
        ? lineNorm === lb.toLowerCase()
        : lineNorm.includes(lb.toLowerCase())
      if (ok) {
        for (let j = i + 1; j < linhas.length; j++) {
          if (linhas[j]) return linhas[j]
        }
      }
    }
  }
  return ''
}

// Formato tab: "Label\tValor" (comum em tabelas copiadas do Chrome)
function buscarTab(raw, labels) {
  for (const lb of [].concat(labels)) {
    const m = raw.match(new RegExp(escRe(lb) + '\\s*\\t\\s*([^\\n]+)', 'i'))
    if (m) return m[1].trim()
  }
  return ''
}

function extrairCep(raw) {
  const m = raw.match(/\b(\d{5})-?(\d{3})\b/)
  return m ? m[1] + m[2] : ''
}

// DD/MM/YY, DD/MM/YYYY ou YYYY-MM-DD → YYYY-MM-DD
function normData(v) {
  if (!v) return ''
  const m4 = v.match(/(\d{2})[/.](\d{2})[/.](\d{4})/)
  if (m4) return `${m4[3]}-${m4[2]}-${m4[1]}`
  const m2 = v.match(/(\d{2})[/.](\d{2})[/.](\d{2})\b/)
  if (m2) return `20${m2[3]}-${m2[2]}-${m2[1]}`
  return ''
}

// Primeira data no formato DD/MM/YYYY encontrada no texto
function primeiraData(raw) {
  const m = raw.match(/\b(\d{2}\/\d{2}\/\d{4})\b/)
  return m ? normData(m[1]) : ''
}

// ── Parser Mapfre (app mobile) ──────────────────────────────────────────────
// Labels em inglês: SERVICE, ASSISTANCE, DATE OF SERVICE, CONTATO CLIENTE,
// BREVE RELATO, TELEFONE. Endereço sem label, detectado por prefixo de logradouro.
// Data no formato DD/MM/YY (ano com 2 dígitos).
function parsearMapfre(raw) {
  const ls = linhasOf(raw)

  function proxLinha(label) {
    for (let i = 0; i < ls.length - 1; i++) {
      if (new RegExp(label, 'i').test(ls[i])) {
        for (let j = i + 1; j < ls.length; j++) if (ls[j]) return ls[j]
      }
    }
    return ''
  }

  const assistM = raw.match(/\bASSISTANCE\s+(\S+)/i)

  let servico = ''
  for (const l of ls) {
    if (/^SERVICE\s+/i.test(l) && !/DATE/i.test(l)) {
      servico = l.replace(/^SERVICE\s+/i, '').trim(); break
    }
  }

  let desc_problema = ''
  for (let i = 0; i < ls.length; i++) {
    const m = ls[i].match(/^BREVE RELATO[:\s]+(.+)/i)
    if (m) {
      desc_problema = m[1].trim()
      for (let j = i + 1; j < ls.length; j++) {
        if (/^(TELEFONE|COBERTURA|TIME OF|INFORMAÇÃO|CONTATO)/i.test(ls[j])) break
        if (/^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]+$/.test(ls[j]) && ls[j].length < 40) break
        desc_problema += ' ' + ls[j]
      }
      break
    }
  }

  let data_agendada = ''
  for (let i = 0; i < ls.length; i++) {
    if (/DATE OF SERVICE/i.test(ls[i])) {
      for (let j = i + 1; j < ls.length; j++) {
        const v = normData(ls[j]); if (v) { data_agendada = v; break }
      }
      break
    }
  }

  let endereco = '', numero = '', cidade = ''
  for (const linha of ls) {
    let l = linha
      .replace(/^Brasil\s*\/+\s*/i, '')
      .replace(/,?\s*BRASIL\b.*$/i, '')
      .trim()
    if (!l.match(/^(R\.|Rua\s|Av\.|Avenida\s|Al\.|Alameda\s|Est\.|Estrada\s|Pç\.|Praça\s|Tv\.|Travessa\s)/i)) continue
    l = l.replace(/,?\s*\d{5}-\d{3}\b.*$/, '').trim()
    const parts = l.split(/\s+-\s+/)
    if (parts.length < 2) { endereco = l; break }
    const comNum = parts[0].match(/^(.+?),\s*(\d+\S*)$/)
    const rua = comNum ? comNum[1].trim() : parts[0].trim()
    numero = comNum ? comNum[2].replace(/\D.*$/, '') : ''
    const segms = parts[1].split(',')
    const bairro = segms.length > 1 ? segms.slice(0, -1).join(',').trim() : ''
    cidade = segms[segms.length - 1].trim()
    endereco = bairro ? `${rua} - ${bairro}` : rua
    break
  }

  return {
    seguradora:    'Mapfre',
    num_assist:    assistM ? assistM[1] : '',
    nome_segurado: proxLinha('CONTATO CLIENTE'),
    tel_segurado:  buscar(ls, 'TELEFONE', false).replace(/\D/g, ''),
    cep:           extrairCep(raw),
    endereco, numero, cidade, servico, desc_problema, data_agendada,
  }
}

// ── Parser Portal Juvo / Tempo Assist ──────────────────────────────────────
// Ctrl+A numa OS do portal novo-portal-prestador.prd.tempoassist.cloud.
// Labels em português: "Nome da cobertura", "Assistência", "Previsão início",
// "Segurado". Endereço: linha com 8 dígitos + " - " (CEP sem hífen embutido).
function parsearJuvo(raw) {
  const ls = linhasOf(raw)

  const servico       = buscar(ls, ['Nome da cobertura', 'Serviço', 'Tipo de Serviço'])
  const num_assist    = buscar(ls, ['Assistência', 'Assistencia'])
  const nome_segurado = buscar(ls, ['Segurado', 'Nome do cliente', 'Nome Segurado'])

  const inicioRaw  = buscar(ls, ['Previsão início', 'Previsao inicio', 'Data início', 'Agendado', 'Data Agendada'])
  const dataM      = inicioRaw.match(/(\d{2}\/\d{2}\/\d{4})/)
  const data_agendada = dataM ? normData(dataM[1]) : primeiraData(raw)

  // Endereço: "17501300 - MARILIA - SP - RUA DONA JULIA NOMURA - 181 - BAIRRO FRAGATA"
  // (8 dígitos = CEP sem hífen, seguido de " - CIDADE - UF - RUA ...")
  let cep = '', cidade = '', endereco = '', numero = ''
  for (const linha of ls) {
    if (!/^\d{8}\s*-/.test(linha)) continue
    const parts = linha.split(/\s*-\s*/)
    cep    = (parts[0] || '').replace(/\D/g, '')
    cidade = (parts[1] || '').trim()
    // parts[2] = UF, parts[3] = rua (com ou sem número embutido)
    const endRaw = (parts[3] || '').trim()
    const emRua  = endRaw.match(/^(.*?)(\d+)(.*)$/)
    let bairro = ''
    if (emRua) {
      // Número embutido na rua: "RUA GUIZARDI220"
      endereco = emRua[1].trim()
      numero   = emRua[2] !== '0' ? emRua[2] : ''
      bairro   = (parts[4] || '').trim()
    } else {
      // Número em campo separado: parts[4]="181", parts[5]="BAIRRO FRAGATA"
      endereco = endRaw
      const cand = (parts[4] || '').trim()
      if (/^\d+$/.test(cand) && cand !== '0') {
        numero = cand
        bairro = (parts[5] || '').trim()
      } else {
        bairro = cand
      }
    }
    if (bairro) endereco = `${endereco} - ${bairro}`
    break
  }

  const desc_problema = buscar(ls, ['Descrição', 'Descricao', 'Descrição do problema'])

  return {
    seguradora: 'Tempo', num_assist, nome_segurado,
    tel_segurado: '', // portal não fornece telefone
    cep, endereco, numero, cidade,
    servico, desc_problema, data_agendada,
  }
}

// ── Parser Maxpar (prestador.maxpar.com) ────────────────────────────────────
// Formato real do Ctrl+A (descoberto em 21/05/2026):
// - Nº OS: "Ordem de Serviço" → próxima linha
// - Segurado: "Beneficiário" → próxima linha
// - Serviço: linha ANTES de "Item de Cobertura" (exibido como título na UI)
// - Data: DD/MM/YYYY que aparece antes de "Agendamento"
// - Endereço: "Endereço" → "Origem" (sub-cabeçalho) → "Rua X, NUM, BAIRRO, Cidade"
// - Descrição: "Observação: X" inline (evita a linha vazia "Observação\n-")
// - Telefone: não fornecido pelo portal
function parsearMaxpar(raw) {
  const ls = linhasOf(raw)

  // Nº OS: "Ordem de Serviço" → próxima linha (ex: "A26051959063/2")
  const num_assist = buscar(ls, ['Ordem de Serviço', 'Ordem de Servico'])

  // Segurado: "Beneficiário" → próxima linha
  const nome_segurado = buscar(ls, ['Beneficiário', 'Beneficiario', 'Nome do Beneficiário', 'Nome do Beneficiario'])

  // Serviço: linha imediatamente ANTES de "Item de Cobertura"
  // (a UI exibe o tipo de serviço como título, e "Item de Cobertura" como legenda abaixo)
  let servico = ''
  for (let i = 1; i < ls.length; i++) {
    if (/^Item de Cobertura$/i.test(ls[i])) { servico = ls[i - 1]; break }
  }
  if (!servico) servico = buscar(ls, ['Tipo de Serviço', 'Tipo de Servico'])

  // Data: DD/MM/YYYY que aparece imediatamente antes de "Agendamento"
  let data_agendada = ''
  for (let i = 0; i < ls.length; i++) {
    if (/^Agendamento$/i.test(ls[i])) {
      for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
        const v = normData(ls[j]); if (v) { data_agendada = v; break }
      }
      break
    }
  }
  if (!data_agendada) data_agendada = primeiraData(raw)

  // Endereço: "Endereço" → pula sub-cabeçalho "Origem" → "Rua X, NUM, BAIRRO, Cidade"
  let endereco = '', numero = '', cidade = ''
  for (let i = 0; i < ls.length - 1; i++) {
    if (!/^Endere[çc]o$/i.test(ls[i])) continue
    let j = i + 1
    if (j < ls.length && /^Origem$/i.test(ls[j])) j++ // pula sub-cabeçalho
    for (; j < ls.length; j++) {
      if (!ls[j] || /^(Ponto de refer[êe]ncia|Observa[çc][ãa]o:|Destino)/i.test(ls[j])) break
      // Parseia "Rua X, 301, VILA CENTRAL, Assis"
      const parts = ls[j].split(', ')
      const temNum = parts.length >= 2 && /^\d/.test(parts[1])
      if (parts.length >= 4 && temNum) {
        numero   = parts[1].replace(/\D.*$/, '')
        const bairro = parts.slice(2, -1).join(', ').trim()
        cidade   = parts[parts.length - 1].trim()
        endereco = bairro ? `${parts[0].trim()} - ${bairro}` : parts[0].trim()
      } else if (parts.length === 3 && temNum) {
        numero   = parts[1].replace(/\D.*$/, '')
        cidade   = parts[2].trim()
        endereco = parts[0].trim()
      } else if (parts.length >= 2) {
        cidade   = parts[parts.length - 1].trim()
        endereco = parts.slice(0, -1).join(', ').trim()
      } else {
        endereco = ls[j]
      }
      break
    }
    break
  }

  // Descrição: "Observação: X" inline (ignora linhas com apenas "-")
  let desc_problema = ''
  for (const l of ls) {
    const m = l.match(/^Observa[çc][ãa]o[:\s]+(.+)$/i)
    if (m && m[1].trim() !== '-') { desc_problema = m[1].trim(); break }
  }
  if (!desc_problema) {
    const qq = buscar(ls, 'O que aconteceu?')
    if (qq && qq !== '-') desc_problema = qq
  }

  return {
    seguradora: 'Maxpar', num_assist, nome_segurado,
    tel_segurado: '', // portal não fornece telefone no acionamento
    cep: extrairCep(raw), endereco, numero, cidade,
    servico, desc_problema, data_agendada,
  }
}

// ── Parser Mondial Assistance (vianet.webmondial.com.br) ───────────────────
// Ctrl+A na OS do Mondial — tabela copiada como "Label\tValor" ou "Label\nValor".
// Labels: "Segurado", "Local", "Bairro", "Cidade", "CEP", "Produto",
//         "Serviço", "Assistência", "Problema".
function parsearMondial(raw) {
  const ls = linhasOf(raw)

  function val(labels) {
    const lst = [].concat(labels)
    // Tenta formato tab primeiro (Chrome copia tabelas com tabs)
    const tv = buscarTab(raw, lst)
    if (tv) return tv
    // Fallback: próxima linha
    return buscar(ls, lst)
  }

  // Número OS: label "Assistência" ou padrão numérico isolado (ex: "52032799")
  let num_assist = val(['Assistência', 'Assistencia'])
  if (!num_assist) {
    for (const l of ls) {
      if (/^\d{6,}$/.test(l) || /^[A-Z]\d{6,}(\/\d+)?$/.test(l)) { num_assist = l; break }
    }
  }

  // Seguradora: "Produto" → "MONDIAL ASSISTANCE - ALLIANZ SEGUROS" → pega [1]
  const produtoRaw = val(['Produto'])
  const prodParts  = produtoRaw.split(' - ')
  const seguradora = prodParts.length >= 2 ? prodParts[1].trim() : 'Mondial'

  // Endereço: "Local" → "Rua das Flores, 123" — última vírgula separa número
  // Portal Mondial grava "R RUA X" (prefixo redundante) — remove o "R " inicial
  const localRaw   = val(['Local']).replace(/^R\s+(?=RUA|AV\.|AVENIDA|AL\.|ALAMEDA|EST\.|ESTRADA|PÇ\.|PRAÇA|TV\.|TRAVESSA)/i, '')
  const lastComma  = localRaw.lastIndexOf(', ')
  const enderecoBruto = lastComma > 0 ? localRaw.slice(0, lastComma).trim() : localRaw
  const numeroBruto   = lastComma > 0 ? localRaw.slice(lastComma + 2).trim()  : ''
  const bairro     = val(['Bairro'])
  const endereco   = bairro ? `${enderecoBruto} - ${bairro}` : enderecoBruto

  const cidadeRaw  = val(['Cidade'])
  const cidade     = cidadeRaw.replace(/\s*-\s*[A-Z]{2}$/, '').trim()

  // Telefone: "TEL: XXXXXXXX" no campo Importante/Descrição, ou padrão de fone
  let tel_segurado = ''
  for (const l of ls) {
    const tm = l.match(/TEL[:\s]+(\d{10,11})/i)
    if (tm) { tel_segurado = tm[1]; break }
    const pm = l.match(/\(?(\d{2})\)?\s*9?\d{4}[-\s]?\d{4}/)
    if (pm) { tel_segurado = pm[0].replace(/\D/g, ''); break }
  }
  if (tel_segurado.length === 13 && tel_segurado.startsWith('55')) tel_segurado = tel_segurado.slice(2)
  if (tel_segurado.length === 12 && tel_segurado.startsWith('55')) tel_segurado = tel_segurado.slice(2)

  const data_agendada = primeiraData(raw)

  return {
    seguradora, num_assist,
    nome_segurado: val(['Segurado']),
    tel_segurado,
    cep: (val(['CEP']) || '').replace(/\D/g, '') || extrairCep(raw),
    endereco, numero: numeroBruto, cidade,
    servico:       (() => {
      // Mondial tem duas linhas: "CONSERTO RESIDENCIAL" (genérico) + "ELETRODOMÉSTICO" (específico)
      // Pega a segunda linha não-vazia após o label "Serviço"
      for (let i = 0; i < ls.length - 1; i++) {
        if (ls[i].toLowerCase().replace(/:$/, '').trim() === 'serviço') {
          let count = 0
          for (let j = i + 1; j < ls.length; j++) {
            if (ls[j]) { count++; if (count === 2) return ls[j] }
          }
        }
      }
      return val(['Serviço', 'Servico'])
    })(),
    desc_problema: val(['Problema', 'Referências', 'Referencia']),
    data_agendada,
  }
}

// ── Configuração dos portais ────────────────────────────────────────────────

const PORTAIS = {
  mapfre:  { label: 'Mapfre (app mobile — Google Lens/Live Text)', parser: parsearMapfre },
  juvo:    { label: 'Portal Juvo / Tempo Assist',                  parser: parsearJuvo   },
  maxpar:  { label: 'Maxpar (prestador.maxpar.com)',               parser: parsearMaxpar },
  mondial: { label: 'Mondial Assistance',                          parser: parsearMondial },
}

const INSTRUCOES = {
  mapfre:  'No app Mapfre, abra a OS e use Google Lens (Android) ou Live Text (iPhone) para selecionar e copiar todo o texto da tela.',
  juvo:    'No Portal Juvo (Tempo Assist), abra a OS → pressione Ctrl+A para selecionar tudo → Ctrl+C para copiar → cole aqui.',
  maxpar:  'No Maxpar (prestador.maxpar.com), abra a OS → Ctrl+A → Ctrl+C → cole aqui.',
  mondial: 'No Mondial (vianet.webmondial.com.br), abra a OS → Ctrl+A → Ctrl+C → cole aqui.',
}

const PLACEHOLDER = {
  mapfre: [
    'Exemplo do texto esperado do app Mapfre:',
    '',
    'SERVICE ENCANADOR',
    'ASSISTANCE 126233080',
    'DATE OF SERVICE',
    '20/05/26 11:29',
    'R. Marco Antônio Ribeiro - Vila Nova Florinea, Assis - SP, 19803-260',
    'CONTATO CLIENTE',
    'CACILDA SOUZA DA SILVA LUCIANO',
    'BREVE RELATO: VAZAMENTO NA VALVULA DO VASO SANITARIO',
    'TELEFONE: 18996341999',
  ].join('\n'),
  juvo: [
    'Exemplo do texto esperado do Portal Juvo:',
    '',
    'Nome da cobertura',
    'HIDRÁULICO',
    'Assistência',
    'A26041786782/2',
    'Previsão início',
    '15/05/2026, 08:00:00',
    '17501300 - MARILIA - SP - RUA DONA JULIA NOMURA - 181 - BAIRRO FRAGATA',
    'Segurado',
    'JOÃO DA SILVA',
  ].join('\n'),
  maxpar: [
    'Exemplo do formato real do Maxpar (Ctrl+A na OS):',
    '',
    'ELETRICISTA',
    'Item de Cobertura',
    '22/05/2026',
    '13h00 - 18h00',
    'Agendamento',
    'Ordem de Serviço',
    'A26051959063/2',
    'Beneficiário',
    'Lucas de Lima Gomes Da Silva',
    'Endereço',
    'Origem',
    'Rua João Pessoa, 301, VILA CENTRAL, Assis',
    'Observação: Problemas nas tomadas',
  ].join('\n'),
  mondial: [
    'Exemplo do texto esperado do Mondial:',
    '',
    'Assistência\t52032799',
    'Produto\tMONDIAL ASSISTANCE - ALLIANZ SEGUROS',
    'Segurado\tMARIA SILVA',
    'Local\tRua das Flores, 123',
    'Bairro\tCentro',
    'Cidade\tSão Paulo - SP',
    'CEP\t01310-100',
    'Serviço\tReparo Hidráulico',
    'Problema\tVazamento na torneira',
  ].join('\n'),
}

// ── Labels para exibição no formulário de revisão ───────────────────────────

const LABELS = {
  num_assist:    'Nº Assistência',
  nome_segurado: 'Segurado',
  tel_segurado:  'Telefone',
  cep:           'CEP',
  endereco:      'Endereço (+ Bairro)',
  numero:        'Número',
  cidade:        'Cidade',
  servico:       'Serviço',
  desc_problema: 'Descrição / Breve Relato',
  data_agendada: 'Data Agendada',
}

// ── Componente ──────────────────────────────────────────────────────────────

export default function ImportarMapfreModal({ onClose, onImportar }) {
  const [portal,  setPortal]  = useState('mapfre')
  const [texto,   setTexto]   = useState('')
  const [parsed,  setParsed]  = useState(null)
  const [editado, setEditado] = useState({})

  function analisar() {
    const r = PORTAIS[portal].parser(texto)
    setParsed(r)
    setEditado({ ...r })
  }

  function resetar() {
    setParsed(null); setEditado({}); setTexto('')
  }

  const camposOk = parsed ? Object.keys(LABELS).filter(k => editado[k]).length : 0
  const total    = Object.keys(LABELS).length
  const bom      = camposOk >= 6

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <h2>📋 Importar OS por Texto</h2>
          <button className="btn-sm"
            style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }}
            onClick={onClose}>
            ✕ Fechar
          </button>
        </div>

        <div className="modal-body">
          {!parsed ? (
            <>
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Portal de origem</label>
                <select value={portal} onChange={e => { setPortal(e.target.value); setTexto('') }}>
                  {Object.entries(PORTAIS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              <div className="os-callout">
                {INSTRUCOES[portal]}
              </div>

              <div className="field" style={{ marginTop: 12 }}>
                <label>Texto copiado</label>
                <textarea
                  key={portal}
                  rows={11}
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  placeholder={PLACEHOLDER[portal]}
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
                  ? `✅ ${camposOk}/${total} campos reconhecidos — ${PORTAIS[portal].label}. Revise e ajuste se necessário.`
                  : `⚠️ Só ${camposOk}/${total} campos — ${PORTAIS[portal].label}. Preencha os em branco antes de importar.`
                }
              </div>

              <div className="os-grid">
                {Object.entries(LABELS).map(([campo, label]) => {
                  const vazio = !editado[campo]
                  const isTA  = campo === 'desc_problema'
                  return (
                    <div key={campo} className="field"
                      style={isTA ? { gridColumn: '1 / -1' } : {}}>
                      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{label}</span>
                        {vazio && (
                          <span style={{ color: 'var(--danger)', fontSize: '.72rem', fontWeight: 600 }}>
                            não encontrado
                          </span>
                        )}
                      </label>
                      {isTA
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
