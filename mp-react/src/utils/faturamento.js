// ============================================================
// faturamento.js — Regras de calendário de pagamento por seguradora
// + cálculo de data prevista, próximo dia útil e divergência de valor
// ============================================================
// Módulo 100% puro — sem dependência de Firebase/React (ver threat model 07-01).

// Seguradoras que liberam DOIS códigos por OS (mão de obra + deslocamento)
export const SEGS_COM_CODIGO = ['Mapfre', 'Allianz', 'Mondial']
// Seguradoras cuja fila monta automática pelo nº da assistência, sem código
export const SEGS_AUTO_NUM_ASSIST = ['Tempo', 'Maxpar']
// Status de OS considerados "finalizados"/faturáveis.
// Inclui 'concluido': o técnico terminou e a seguradora já pode liberar o código —
// é exatamente a OS que o admin fatura na prática (para Mapfre/Allianz o item só
// entra na fila se o código estiver preenchido, então não há risco de faturar cedo demais).
export const STATUS_FATURAVEIS = ['concluido', 'processado', 'enviado']

// Normaliza nome de seguradora para comparação (portais variam maiúsculas/espaços)
export function normSeguradora(s) {
  return String(s || '').trim().toLowerCase()
}

// Nº de dígitos do código por seguradora
// Mapfre = 8 dígitos ("movimento económico" MAWDY); Allianz/Mondial = 2 dígitos
export function digitosCodigo(seguradora) {
  return (seguradora === 'Allianz' || seguradora === 'Mondial') ? 2 : 8
}

// Regras de calendário PADRÃO (LOCKED — CONTEXT.md "Calendário de pagamento")
// Estrutura de faixa: { diaDe, diaAte, addMeses, diaPagto } ou { diaDe, diaAte, naoFaturavel:true }
export const REGRAS_FATURAMENTO_PADRAO = {
  Mapfre: {
    faixas: [
      { diaDe: 1,  diaAte: 10, addMeses: 1, diaPagto: 1  }, // envio 01–10 → paga dia 01 do mês seguinte
      { diaDe: 11, diaAte: 25, addMeses: 1, diaPagto: 16 }, // envio 11–25 → paga dia 16 do mês seguinte
      { diaDe: 26, diaAte: 31, addMeses: 2, diaPagto: 1  }, // envio 26–31 → paga dia 01 do 2º mês seguinte
    ],
  },
  Allianz: {
    faixas: [
      { diaDe: 1,  diaAte: 3,  addMeses: 0, diaPagto: 13 }, // 01–03 → dia 13 do mesmo mês
      { diaDe: 4,  diaAte: 10, addMeses: 0, diaPagto: 25 }, // 04–10 → dia 25 do mesmo mês
      { diaDe: 11, diaAte: 20, addMeses: 1, diaPagto: 3  }, // 11–20 → dia 03 do mês seguinte
      { diaDe: 21, diaAte: 25, addMeses: 1, diaPagto: 13 }, // 21–25 → dia 13 do mês seguinte
      { diaDe: 26, diaAte: 31, naoFaturavel: true         }, // 26–31 → NÃO faturada nem paga (FAT-08)
    ],
  },
}
// Mondial usa o mesmo calendário da Allianz
REGRAS_FATURAMENTO_PADRAO.Mondial = REGRAS_FATURAMENTO_PADRAO.Allianz

// Retorna as faixas de calendário customizadas do config (ConfigTab) com fallback
// para o padrão; retorna null quando a seguradora não tem calendário (Tempo/Maxpar).
export function getRegrasFaturamento(config, seguradora) {
  const custom = config?.calendarioFaturamento?.[seguradora]?.faixas
  if (Array.isArray(custom) && custom.length > 0) return custom
  return REGRAS_FATURAMENTO_PADRAO[seguradora]?.faixas || null
}

// Ajusta uma data para o próximo dia útil (empurra sábado/domingo para segunda).
// Feriados são IGNORADOS nesta versão (CONTEXT.md deferred).
export function proximoDiaUtil(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  return d
}

function fmtISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Calcula a data prevista de pagamento a partir da data de emissão da nota e do
// calendário da seguradora. dataEmissao no formato 'YYYY-MM-DD'.
// Retorna { data, naoFaturavel, semCalendario } — data é 'YYYY-MM-DD' ou null.
export function calcularDataPrevista(seguradora, dataEmissao, config) {
  const regras = getRegrasFaturamento(config, seguradora)
  if (!regras) return { data: null, naoFaturavel: false, semCalendario: true }

  if (!dataEmissao || typeof dataEmissao !== 'string') {
    return { data: null, naoFaturavel: false, semCalendario: true }
  }
  const [ano, mes, dia] = dataEmissao.split('-').map(Number)
  if (!ano || !mes || !dia) {
    return { data: null, naoFaturavel: false, semCalendario: true }
  }

  const faixa = regras.find(f => dia >= f.diaDe && dia <= f.diaAte)
  if (!faixa) return { data: null, naoFaturavel: false, semCalendario: true }

  if (faixa.naoFaturavel) {
    return { data: null, naoFaturavel: true, semCalendario: false }
  }

  const alvo = new Date(ano, (mes - 1) + faixa.addMeses, faixa.diaPagto)
  const ajustado = proximoDiaUtil(alvo)
  return { data: fmtISO(ajustado), naoFaturavel: false, semCalendario: false }
}

// Compara o valor liberado pela seguradora (código) com o valor registrado na OS.
// Retorna { diff, bateu } — diff positivo = código maior que OS.
export function getDivergenciaFat(valorCodigo, valorOS) {
  const vc = parseFloat(valorCodigo) || 0
  const vo = parseFloat(valorOS) || 0
  const diff = parseFloat((vc - vo).toFixed(2))
  return { diff, bateu: Math.abs(diff) < 0.005 }
}
