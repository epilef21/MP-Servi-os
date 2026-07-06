// drePdf.js — montagem pura das linhas do DRE + geracao de PDF (jsPDF sob demanda)
// Espelha o padrao de utils/relatorioMensalPdf.js: import dinamico do jsPDF,
// nunca estatico, para nao inflar o bundle inicial do app.

const MESES = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function s(v) {
  if (!v && v !== 0) return '—'
  return String(v)
    .replace(/[áàãâä]/g,'a').replace(/[ÁÀÃÂÄ]/g,'A')
    .replace(/[éèêë]/g,'e').replace(/[ÉÈÊË]/g,'E')
    .replace(/[íìîï]/g,'i').replace(/[ÍÌÎÏ]/g,'I')
    .replace(/[óòõôö]/g,'o').replace(/[ÓÒÕÔÖ]/g,'O')
    .replace(/[úùûü]/g,'u').replace(/[ÚÙÛÜ]/g,'U')
    .replace(/[ç]/g,'c').replace(/[Ç]/g,'C')
    .replace(/[ñ]/g,'n').replace(/[Ñ]/g,'N')
}

function fmtBRL(v) {
  const n = parseFloat(v)
  if (isNaN(n)) return '—'
  return `R$ ${n.toFixed(2).replace('.',',')}`
}

// Nome do mes por extenso + ano a partir de mesRef ('YYYY-MM'), sem new Date()/toISOString.
function nomeMesAno(mesRef) {
  const partes = String(mesRef || '').split('-')
  const ano = partes[0]
  const mesNum = parseInt(partes[1], 10)
  const nomeMes = (mesNum >= 1 && mesNum <= 12) ? MESES[mesNum - 1] : ''
  return { nomeMes, ano: ano || '' }
}

// montarLinhasDre — PURA (sem jsPDF, sem React). Recebe o objeto `dre` produzido por
// calcularDRE() em FinanceiroEmpresaTab.jsx e devolve um array ordenado de linhas
// descrevendo o DRE, respeitando as mesmas condicoes de exibicao da tela AbaDRE.
export function montarLinhasDre(dre) {
  const linhas = []

  // ── RECEITA BRUTA ──
  linhas.push({ tipo: 'secao', label: '(+) Receita Bruta', valor: null })
  linhas.push({ tipo: 'linha', label: `OS Seguradoras (${dre.qtdOS} OS)`, valor: dre.receitaOS })
  linhas.push({ tipo: 'linha', label: 'Servicos Particulares', valor: dre.receitaParticulares })
  if (dre.margemMaterial !== 0) {
    linhas.push({ tipo: 'linha', label: 'Margem em Material', valor: dre.margemMaterial })
  }
  linhas.push({ tipo: 'subtotal', label: 'TOTAL RECEITA BRUTA', valor: dre.receitaTotal })

  // ── DEDUCOES DA RECEITA ──
  linhas.push({ tipo: 'secao', label: '(-) Deducoes da Receita Bruta', valor: null })
  if (!dre.deducoes || dre.deducoes.length === 0) {
    linhas.push({ tipo: 'linha', label: 'Nenhum imposto lancado este mes. A Receita Liquida esta igual a Receita Bruta.', valor: 0 })
  } else {
    dre.deducoes.forEach(d => {
      linhas.push({ tipo: 'linha', label: d.descricao, valor: d.valor })
    })
  }
  linhas.push({ tipo: 'subtotal', label: 'TOTAL DEDUCOES', valor: dre.totalDeducoes })

  // ── RECEITA LIQUIDA ──
  linhas.push({ tipo: 'resultado', label: '(=) RECEITA LIQUIDA', valor: dre.receitaLiquida })

  // ── CUSTOS VARIAVEIS ──
  linhas.push({ tipo: 'secao', label: '(-) Custos Variaveis', valor: null })
  linhas.push({ tipo: 'linha', label: 'Pagamento Tecnicos', valor: dre.custoTecnicos })
  linhas.push({ tipo: 'linha', label: 'Custo Material Real', valor: dre.custoMaterial })
  if (dre.custoParticulares > 0) {
    linhas.push({ tipo: 'linha', label: 'Custo Servicos Particulares', valor: dre.custoParticulares })
  }
  linhas.push({ tipo: 'subtotal', label: 'TOTAL CUSTOS VARIAVEIS', valor: dre.custoVariavelTotal })

  // ── LUCRO BRUTO ──
  linhas.push({ tipo: 'resultado', label: '(=) LUCRO BRUTO', valor: dre.lucroBruto })

  // ── RESULTADO FINANCEIRO ──
  linhas.push({ tipo: 'secao', label: '(+/-) Resultado Financeiro', valor: null })
  if (!dre.resultFinanceiro || dre.resultFinanceiro.length === 0) {
    linhas.push({ tipo: 'linha', label: 'Nenhuma taxa ou juro lancado', valor: 0 })
  } else {
    if (dre.despesasFin > 0) {
      linhas.push({ tipo: 'linha', label: 'Taxas e tarifas', valor: dre.despesasFin })
    }
    if (dre.receitasFin > 0) {
      linhas.push({ tipo: 'linha', label: 'Juros / rendimentos recebidos', valor: dre.receitasFin })
    }
  }
  linhas.push({ tipo: 'subtotal', label: 'TOTAL RESULTADO FINANCEIRO', valor: dre.saldoFinanceiro })

  // ── DESPESAS FIXAS (agrupadas) ──
  linhas.push({ tipo: 'secao', label: '(-) Despesas Fixas', valor: null })
  const grupos = dre.despesasPorGrupo || {}
  if (Object.keys(grupos).length === 0) {
    linhas.push({ tipo: 'linha', label: 'Nenhuma despesa lancada neste mes', valor: 0 })
  } else {
    Object.values(grupos).forEach(g => {
      linhas.push({ tipo: 'secao', label: g.label, valor: null })
      g.itens.forEach(d => {
        linhas.push({ tipo: 'linha', label: d.descricao, valor: d.valor })
      })
      const nomeGrupo = String(g.label).split(' ').slice(1).join(' ')
      linhas.push({ tipo: 'subtotal', label: `Subtotal ${nomeGrupo}`, valor: g.subtotal })
    })
  }
  linhas.push({ tipo: 'subtotal', label: 'TOTAL DESPESAS FIXAS', valor: dre.totalDespesas })

  // ── LUCRO LIQUIDO ──
  const margem = typeof dre.margemLiquida === 'number' ? dre.margemLiquida.toFixed(1) : '0.0'
  linhas.push({ tipo: 'resultado', label: `(=) LUCRO LIQUIDO — Margem: ${margem}%`, valor: dre.lucroLiquido })

  return linhas
}

// gerarDrePdf — carrega jsPDF sob demanda e monta o PDF do DRE do mes,
// reaproveitando o layout de relatorioMensalPdf.js.
export async function gerarDrePdf(dre, mesRef, nomeEmpresa) {
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 14
  let y = 0

  function checkPage(needed = 20) {
    if (y > H - needed) { doc.addPage(); y = 16 }
  }

  function sectionHeader(title) {
    checkPage(14)
    doc.setFillColor(240,245,252)
    doc.rect(M, y, W-M*2, 7, 'F')
    doc.setDrawColor(208,218,232)
    doc.rect(M, y, W-M*2, 7, 'S')
    doc.setTextColor(26,63,168)
    doc.setFont('helvetica','bold')
    doc.setFontSize(8)
    doc.text(s(title).toUpperCase(), M+3, y+4.8)
    y += 11
  }

  function tableRow(label, valor, destaque) {
    checkPage(10)
    if (destaque) {
      doc.setFillColor(26,63,168); doc.rect(M, y, W-M*2, 7, 'F')
      doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(8.5)
    } else {
      doc.setFillColor(245,248,252); doc.rect(M, y, W-M*2, 7, 'F')
      doc.setDrawColor(220,228,240); doc.line(M, y+7, M+W-M*2, y+7)
      doc.setTextColor(30,45,61); doc.setFont('helvetica','normal'); doc.setFontSize(8.5)
    }
    doc.text(s(label), M+3, y+4.8)
    doc.text(fmtBRL(valor), W-M-3, y+4.8, { align: 'right' })
    y += 7
  }

  const { nomeMes, ano } = nomeMesAno(mesRef)

  // ── CABECALHO ──
  doc.setFillColor(26,63,168)
  doc.rect(0, 0, W, 38, 'F')
  doc.setFillColor(240,90,26)
  doc.rect(0, 38, W, 2, 'F')

  doc.setTextColor(255,255,255)
  doc.setFont('helvetica','bold')
  doc.setFontSize(20)
  doc.text(s(nomeEmpresa || 'AssistHub'), M, 16)

  doc.setFontSize(9); doc.setFont('helvetica','normal')
  doc.text('Demonstrativo de Resultado (DRE)', M, 24)

  doc.setFontSize(8)
  doc.text(`${nomeMes} / ${ano}`, W-M, 16, { align: 'right' })

  y = 46

  montarLinhasDre(dre).forEach(l => {
    if (l.tipo === 'secao') {
      sectionHeader(l.label)
    } else if (l.tipo === 'subtotal') {
      tableRow(l.label, l.valor, false)
    } else if (l.tipo === 'resultado') {
      tableRow(l.label, l.valor, true)
    } else {
      tableRow(l.label, l.valor, false)
    }
  })

  // ── RODAPE ──
  const pages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFillColor(26,63,168); doc.rect(0, H-12, W, 12, 'F')
    doc.setTextColor(255,255,255); doc.setFont('helvetica','normal'); doc.setFontSize(7)
    doc.text(`${s(nomeEmpresa || 'AssistHub')}  |  DRE gerado em ${new Date().toLocaleDateString('pt-BR')}`, M, H-4.5)
    doc.text(`Pagina ${i} de ${pages}`, W-M, H-4.5, { align: 'right' })
  }

  doc.save(`dre_${mesRef}.pdf`)
}
