import jsPDF from 'jspdf'

const MESES = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const STATUS_LABELS = {
  aguardando_tecnico: 'Aguardando Tecnico',
  pendente:           'Pendente',
  processado:         'Processado',
  enviado:            'Enviado',
}

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

function getLucroLocal(r) {
  const mos = parseFloat(r.mo_seguradora)      || 0
  const vpt = parseFloat(r.valor_prestador)    || 0
  const vds = parseFloat(r.valor_deslocamento) || 0
  return (mos || vpt || vds) ? (mos - vpt) + vds : null
}

export function agregarRelatorio(os, mes, ano) {
  const filtered = os.filter(r => {
    try {
      const d = r.criado_em?.toDate?.()
      return d && d.getMonth() + 1 === mes && d.getFullYear() === ano
    } catch { return false }
  })

  const porStatus     = {}
  const porSeguradora = {}
  const porTecnico    = {}
  let lucroTotal      = 0
  let osComLucro      = 0

  filtered.forEach(r => {
    const status = r.status || 'pendente'
    porStatus[status] = (porStatus[status] || 0) + 1

    const seg = r.seguradora || '(sem seguradora)'
    if (!porSeguradora[seg]) porSeguradora[seg] = { count: 0, lucro: 0 }
    porSeguradora[seg].count++

    const tec = r.tecnico_nome || '(sem tecnico)'
    if (!porTecnico[tec]) porTecnico[tec] = { count: 0, lucro: 0 }
    porTecnico[tec].count++

    const lucro = getLucroLocal(r)
    if (lucro !== null) {
      lucroTotal += lucro
      osComLucro++
      porSeguradora[seg].lucro += lucro
      porTecnico[tec].lucro   += lucro
    }
  })

  return {
    totalOS:      filtered.length,
    porStatus,
    lucroTotal,
    mediaPorOS:   osComLucro > 0 ? lucroTotal / osComLucro : 0,
    osComLucro,
    porSeguradora,
    porTecnico,
  }
}

export function gerarRelatorioMensalPdf(dados, mes, ano, nomeEmpresa) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W   = doc.internal.pageSize.getWidth()
  const H   = doc.internal.pageSize.getHeight()
  const M   = 14
  let y     = 0

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
    doc.text(title.toUpperCase(), M+3, y+4.8)
    y += 11
  }

  function twoCol(l1, v1, l2, v2) {
    checkPage(12)
    const hw = (W-M*2)/2
    doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(107,124,147)
    doc.text(l1.toUpperCase(), M, y)
    if (l2) doc.text(l2.toUpperCase(), M+hw, y)
    const lines1 = doc.splitTextToSize(s(v1), hw-4)
    const lines2 = l2 ? doc.splitTextToSize(s(v2), hw-4) : []
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(30,45,61)
    doc.text(lines1, M, y+4)
    if (l2) doc.text(lines2, M+hw, y+4)
    y += Math.max(lines1.length, lines2.length||1)*4+6
  }

  function tableRow(col1, col2, col3, isHeader) {
    checkPage(10)
    const cW = (W-M*2) / 3
    if (isHeader) {
      doc.setFillColor(26,63,168); doc.rect(M, y, W-M*2, 7, 'F')
      doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(7.5)
    } else {
      doc.setFillColor(245,248,252); doc.rect(M, y, W-M*2, 7, 'F')
      doc.setDrawColor(220,228,240); doc.line(M, y+7, M+W-M*2, y+7)
      doc.setTextColor(30,45,61); doc.setFont('helvetica','normal'); doc.setFontSize(8.5)
    }
    doc.text(s(col1), M+3,      y+4.8)
    doc.text(s(col2), M+cW+3,   y+4.8)
    doc.text(s(col3), M+cW*2+3, y+4.8)
    y += 7
  }

  // ── CABECALHO ────────────────────────────────────────────────
  doc.setFillColor(26,63,168)
  doc.rect(0, 0, W, 38, 'F')
  doc.setFillColor(240,90,26)
  doc.rect(0, 38, W, 2, 'F')

  doc.setTextColor(255,255,255)
  doc.setFont('helvetica','bold')
  doc.setFontSize(20)
  doc.text(s(nomeEmpresa || 'AssistHub'), M, 16)

  doc.setFontSize(9); doc.setFont('helvetica','normal')
  doc.text('Relatorio Mensal de Atendimentos', M, 24)

  doc.setFontSize(8)
  doc.text(`${MESES[mes-1]} / ${ano}`, W-M, 16, { align: 'right' })
  doc.text(`Total de OS: ${dados.totalOS}`, W-M, 24, { align: 'right' })

  y = 46

  // ── RESUMO GERAL ─────────────────────────────────────────────
  sectionHeader('Resumo Geral')
  twoCol('Total de OS no periodo', String(dados.totalOS), 'OS com dados financeiros', String(dados.osComLucro))
  twoCol('Lucro total', fmtBRL(dados.lucroTotal), 'Media por OS', fmtBRL(dados.mediaPorOS))

  // ── STATUS ──────────────────────────────────────────────────
  sectionHeader('OS por Status')
  tableRow('Status', 'Quantidade', 'Percentual', true)
  const total = dados.totalOS || 1
  Object.entries(dados.porStatus).forEach(([status, count]) => {
    const pct = `${((count / total) * 100).toFixed(1)}%`
    tableRow(STATUS_LABELS[status] || status, String(count), pct, false)
  })
  y += 4

  // ── LUCRATIVIDADE POR SEGURADORA ─────────────────────────────
  sectionHeader('Lucratividade por Seguradora (REL-03)')
  tableRow('Seguradora', 'OS', 'Lucro Total', true)
  Object.entries(dados.porSeguradora)
    .sort((a, b) => b[1].lucro - a[1].lucro)
    .forEach(([seg, { count, lucro }]) => {
      tableRow(seg, String(count), fmtBRL(lucro), false)
    })
  y += 4

  // ── OS E LUCRO POR TECNICO ────────────────────────────────────
  sectionHeader('OS e Lucro por Tecnico (REL-04)')
  tableRow('Tecnico', 'OS', 'Lucro Total', true)
  Object.entries(dados.porTecnico)
    .sort((a, b) => b[1].lucro - a[1].lucro)
    .forEach(([tec, { count, lucro }]) => {
      tableRow(tec, String(count), fmtBRL(lucro), false)
    })
  y += 4

  // ── RODAPE ───────────────────────────────────────────────────
  const pages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFillColor(26,63,168); doc.rect(0, H-12, W, 12, 'F')
    doc.setTextColor(255,255,255); doc.setFont('helvetica','normal'); doc.setFontSize(7)
    doc.text(`${s(nomeEmpresa || 'AssistHub')}  |  Relatorio gerado em ${new Date().toLocaleDateString('pt-BR')}`, M, H-4.5)
    doc.text(`Pagina ${i} de ${pages}`, W-M, H-4.5, { align: 'right' })
  }

  doc.save(`relatorio_${String(mes).padStart(2,'0')}_${ano}.pdf`)
}
