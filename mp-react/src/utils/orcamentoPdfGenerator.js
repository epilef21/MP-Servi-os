// jsPDF é carregado sob demanda dentro dos exports (generatePDFCliente /
// generatePDFSeguradora) para não entrar no bundle inicial do app.

// Substitui acentos para compatibilidade com jsPDF (fonte helvetica)
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
  if (!v && v !== 0) return 'R$ 0,00'
  const n = parseFloat(v)
  if (isNaN(n)) return String(v)
  return `R$ ${n.toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.')}`
}

// Cria a estrutura base do PDF e retorna helpers + doc.
// Recebe a classe jsPDF (carregada sob demanda pelos exports).
function criarDoc(jsPDF, titulo) {
  const doc = new jsPDF({ unit:'mm', format:'a4' })
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

  function textBlock(label, value) {
    checkPage(24)
    doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(107,124,147)
    doc.text(label.toUpperCase(), M, y); y += 4
    const lines = doc.splitTextToSize(s(value), W-M*2-4)
    const bh = lines.length*4+5
    doc.setFillColor(245,247,250); doc.rect(M, y, W-M*2, bh, 'F')
    doc.setDrawColor(208,218,232); doc.rect(M, y, W-M*2, bh, 'S')
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(30,45,61)
    doc.text(lines, M+3, y+4)
    y += bh+5
  }

  return { doc, W, H, M, getY:()=>y, setY:(v)=>{ y=v }, checkPage, sectionHeader, twoCol, textBlock }
}

// Desenha o cabeçalho azul com nome da empresa, logo e título
function desenharHeader(ctx, orc, empresa, titulo) {
  const { doc, W, M, setY } = ctx
  const nomeEmpresa = s(empresa?.nome || 'AssistHub')
  const telEmpresa  = s(empresa?.telefone || '')
  const cnpj        = s(empresa?.cnpj || '')

  doc.setFillColor(26,63,168)
  doc.rect(0, 0, W, 42, 'F')
  doc.setFillColor(240,90,26)
  doc.rect(0, 42, W, 2.5, 'F')

  // Logo da empresa (se existir)
  let xTexto = M
  if (empresa?.logoUrl) {
    try {
      doc.addImage(empresa.logoUrl, 'PNG', M, 6, 22, 22)
      xTexto = M + 26
    } catch (_) {}
  }

  doc.setTextColor(255,255,255)
  doc.setFont('helvetica','bold')
  doc.setFontSize(16)
  doc.text(nomeEmpresa, xTexto, 15)

  doc.setFontSize(8)
  doc.setFont('helvetica','normal')
  if (cnpj) doc.text(`CNPJ: ${cnpj}`, xTexto, 22)
  if (telEmpresa) doc.text(`Tel: ${telEmpresa}`, xTexto, cnpj ? 28 : 22)

  // Título e número no canto direito
  doc.setFont('helvetica','bold')
  doc.setFontSize(18)
  doc.text(titulo, W-M, 14, { align:'right' })
  doc.setFontSize(9)
  doc.text(s(orc.numero), W-M, 22, { align:'right' })

  setY(50)
}

// Desenha informações gerais do orçamento
function desenharInfos(ctx, orc) {
  const { twoCol } = ctx
  twoCol('Numero', orc.numero, 'Data de Emissao', fmtDate(orc.criado_em))
  twoCol('Valido ate', fmtDate(orc.validade), 'Status', s(orc.status?.replace(/_/g,' ')))
}

// Desenha dados do cliente
function desenharCliente(ctx, orc, labelTitulo) {
  const { sectionHeader, twoCol } = ctx
  sectionHeader(labelTitulo || 'Dados do Cliente')
  twoCol('Nome', orc.nome_cliente, 'Telefone', orc.tel_cliente)
  if (orc.email_cliente) twoCol('E-mail', orc.email_cliente, '', '')
  twoCol('Endereco', orc.endereco, 'Cidade', orc.cidade)
}

// Desenha dados do equipamento (linha branca)
function desenharEquipamento(ctx, orc) {
  if (orc.tipo !== 'linha_branca') return
  const { sectionHeader, twoCol } = ctx
  sectionHeader('Equipamento')
  twoCol('Tipo', orc.tipo_equipamento, 'Marca', orc.marca)
  twoCol('Modelo', orc.modelo, 'Voltagem', orc.voltagem)
  if (orc.num_serie) twoCol('No. Serie', orc.num_serie, 'Defeito Relatado', orc.defeito)
  else if (orc.defeito) twoCol('Defeito Relatado', orc.defeito, '', '')
}

// Desenha diagnóstico técnico
function desenharDiagnostico(ctx, orc) {
  if (!orc.diagnostico) return
  const { sectionHeader, textBlock } = ctx
  sectionHeader('Diagnostico Tecnico')
  textBlock('Descricao do Diagnostico', orc.diagnostico)
}

// Desenha tabela de itens — 4 colunas (cliente)
function desenharTabelaItens(ctx, itens, totalLabel, totalValor) {
  const { doc, W, M, getY, setY, checkPage } = ctx
  let y = getY()
  checkPage(20)

  const colDesc = W-M*2-20-30-32
  const colQtd  = 20
  const colUnit = 30
  const colTot  = 32

  doc.setFillColor(26,63,168); doc.rect(M, y, W-M*2, 7, 'F')
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(7.5)
  doc.text('DESCRICAO', M+3, y+4.8)
  doc.text('QTD', M+colDesc+1, y+4.8)
  doc.text('VLR UNIT.', M+colDesc+colQtd+1, y+4.8)
  doc.text('TOTAL', M+colDesc+colQtd+colUnit+2, y+4.8)
  y += 7

  ;(itens||[]).forEach((item, idx) => {
    checkPage(10); y = getY()
    const bg = idx%2===0 ? [252,252,252] : [245,248,252]
    doc.setFillColor(...bg); doc.rect(M, y, W-M*2, 7, 'F')
    doc.setDrawColor(220,228,240); doc.line(M, y+7, M+W-M*2, y+7)
    doc.setTextColor(30,45,61); doc.setFont('helvetica','normal'); doc.setFontSize(8.5)
    const descLines = doc.splitTextToSize(s(item.descricao), colDesc-4)
    const rowH = Math.max(descLines.length*4+4, 7)
    if (descLines.length > 1) {
      doc.setFillColor(...bg); doc.rect(M, y, W-M*2, rowH, 'F')
      doc.setDrawColor(220,228,240); doc.line(M, y+rowH, M+W-M*2, y+rowH)
    }
    doc.text(descLines, M+3, y+4)
    doc.text(String(item.quantidade||1), M+colDesc+2, y+4)
    doc.text(fmtBRL(item.valor_unit), M+colDesc+colQtd+1, y+4)
    doc.text(fmtBRL(item.valor_total), M+colDesc+colQtd+colUnit+1, y+4)
    setY(y + rowH)
  })

  y = getY(); checkPage(10)
  doc.setFillColor(232,240,251); doc.rect(M, y, W-M*2, 8, 'F')
  doc.setDrawColor(180,200,230); doc.rect(M, y, W-M*2, 8, 'S')
  doc.setTextColor(26,63,168); doc.setFont('helvetica','bold'); doc.setFontSize(9)
  doc.text((totalLabel||'TOTAL').toUpperCase(), M+3, y+5.5)
  doc.text(fmtBRL(totalValor), M+W-M*2-2, y+5.5, { align:'right' })
  setY(y+12)
}

// Desenha tabela de itens com divisão — 5 colunas (seguradora)
function desenharTabelaItensDivisao(ctx, itens, totalSeg, totalCli) {
  const { doc, W, M, getY, setY, checkPage } = ctx
  let y = getY()
  checkPage(20)

  const totalW  = W-M*2
  const colDesc = totalW - 18 - 26 - 26 - 26
  const colQtd  = 18
  const colUnit = 26
  const colSeg  = 26
  const colCli  = 26

  doc.setFillColor(26,63,168); doc.rect(M, y, totalW, 7, 'F')
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(7)
  doc.text('DESCRICAO',  M+3,                           y+4.8)
  doc.text('QTD',        M+colDesc+1,                   y+4.8)
  doc.text('VLR UNIT.',  M+colDesc+colQtd+1,            y+4.8)
  doc.text('SEGURADORA', M+colDesc+colQtd+colUnit+1,    y+4.8)
  doc.text('CLIENTE',    M+colDesc+colQtd+colUnit+colSeg+1, y+4.8)
  y += 7

  ;(itens||[]).forEach((item, idx) => {
    checkPage(10); y = getY()
    const bg = idx%2===0 ? [252,252,252] : [245,248,252]
    doc.setFillColor(...bg); doc.rect(M, y, totalW, 7, 'F')
    doc.setDrawColor(220,228,240); doc.line(M, y+7, M+totalW, y+7)
    doc.setTextColor(30,45,61); doc.setFont('helvetica','normal'); doc.setFontSize(8)
    const descLines = doc.splitTextToSize(s(item.descricao), colDesc-4)
    const rowH = Math.max(descLines.length*4+4, 7)
    if (descLines.length > 1) {
      doc.setFillColor(...bg); doc.rect(M, y, totalW, rowH, 'F')
      doc.setDrawColor(220,228,240); doc.line(M, y+rowH, M+totalW, y+rowH)
    }
    doc.text(descLines, M+3, y+4)
    doc.text(String(item.quantidade||1),              M+colDesc+2,                    y+4)
    doc.text(fmtBRL(item.valor_unit),                 M+colDesc+colQtd+1,             y+4)
    doc.text(fmtBRL(parseFloat(item.paga_seguradora)||0), M+colDesc+colQtd+colUnit+1, y+4)
    doc.text(fmtBRL(parseFloat(item.paga_cliente)||0), M+colDesc+colQtd+colUnit+colSeg+1, y+4)
    setY(y + rowH)
  })

  y = getY(); checkPage(10)
  doc.setFillColor(232,240,251); doc.rect(M, y, totalW, 8, 'F')
  doc.setDrawColor(180,200,230); doc.rect(M, y, totalW, 8, 'S')
  doc.setTextColor(26,63,168); doc.setFont('helvetica','bold'); doc.setFontSize(8.5)
  doc.text('TOTAIS', M+3, y+5.5)
  doc.text(fmtBRL(totalSeg), M+colDesc+colQtd+colUnit+1, y+5.5)
  doc.text(fmtBRL(totalCli), M+colDesc+colQtd+colUnit+colSeg+1, y+5.5)
  setY(y+12)
}

// Desenha condições em caixa destacada
function desenharCondicoes(ctx, orc) {
  const { doc, W, M, getY, setY, checkPage } = ctx
  checkPage(28)
  let y = getY()

  doc.setFillColor(232,240,251)
  doc.rect(M, y, W-M*2, 24, 'F')
  doc.setDrawColor(180,200,230); doc.rect(M, y, W-M*2, 24, 'S')

  const col = (W-M*2) / 3
  const items = [
    { label:'GARANTIA',          value: s(orc.garantia         || '—') },
    { label:'PRAZO DE EXECUCAO', value: s(orc.prazo_execucao   || '—') },
    { label:'FORMA DE PAGAMENTO',value: s(orc.forma_pagamento  || '—') },
  ]
  items.forEach((it, idx) => {
    const x = M + idx * col + 4
    doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(107,124,147)
    doc.text(it.label, x, y + 6)
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(26,63,168)
    doc.text(it.value, x, y + 14)
  })
  setY(y + 28)
}

// Desenha observações
function desenharObs(ctx, orc) {
  if (!orc.observacoes) return
  const { textBlock } = ctx
  textBlock('Observacoes', orc.observacoes)
}

// Desenha aprovação (se já aprovado)
function desenharAprovacao(ctx, orc) {
  if (orc.status !== 'aprovado' && orc.status !== 'executado') return
  const { doc, W, H, M, getY, setY, checkPage, sectionHeader } = ctx
  sectionHeader('Aprovacao do Cliente')
  let y = getY()
  checkPage(45)
  twoColSimples(ctx, 'Aprovado por', orc.aprovado_por, 'Data', fmtDate(orc.aprovado_em))
  y = getY()
  if (orc.assinatura_cliente) {
    checkPage(40)
    y = getY()
    const sigW = (W-M*2-10)/2
    const sigH = 28
    doc.setFillColor(245,247,250); doc.rect(M, y, sigW, sigH, 'F')
    doc.setDrawColor(208,218,232); doc.rect(M, y, sigW, sigH, 'S')
    doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(107,124,147)
    doc.text('ASSINATURA DO CLIENTE', M+2, y+3)
    try { doc.addImage(orc.assinatura_cliente,'PNG',M+2,y+5,sigW-4,sigH-8) } catch(_) {}
    setY(y+sigH+6)
  }
}

function twoColSimples(ctx, l1, v1, l2, v2) {
  const { doc, W, M, getY, setY } = ctx
  let y = getY()
  const hw = (W-M*2)/2
  doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(107,124,147)
  doc.text(l1.toUpperCase(), M, y)
  if (l2) doc.text(l2.toUpperCase(), M+hw, y)
  const lines1 = doc.splitTextToSize(s(v1), hw-4)
  const lines2 = l2 ? doc.splitTextToSize(s(v2), hw-4) : []
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(30,45,61)
  doc.text(lines1, M, y+4)
  if (l2) doc.text(lines2, M+hw, y+4)
  setY(y + Math.max(lines1.length, lines2.length||1)*4+6)
}

// Desenha o rodapé azul em todas as páginas
function desenharFooter(ctx, empresa) {
  const { doc, W, H, M } = ctx
  const pages = doc.internal.getNumberOfPages()
  for (let i=1;i<=pages;i++) {
    doc.setPage(i)
    doc.setFillColor(26,63,168); doc.rect(0, H-12, W, 12, 'F')
    doc.setTextColor(255,255,255); doc.setFont('helvetica','normal'); doc.setFontSize(7)
    doc.text(s(empresa?.nome||'AssistHub') + (empresa?.telefone ? '  |  Tel: '+s(empresa.telefone) : ''), M, H-4.5)
    doc.text(`Pagina ${i} de ${pages}`, W-M, H-4.5, { align:'right' })
  }
}

// ── VERSÃO CLIENTE ───────────────────────────────────────────
// Mostra apenas o que o cliente paga. Sem valores da seguradora.
export async function generatePDFCliente(orc, empresa) {
  const { default: jsPDF } = await import('jspdf')
  const ctx = criarDoc(jsPDF, 'ORCAMENTO')
  desenharHeader(ctx, orc, empresa, 'ORCAMENTO')

  const { sectionHeader, textBlock, doc, W, M, getY, setY } = ctx

  // Infos gerais
  ctx.twoCol('Numero', orc.numero, 'Data de Emissao', fmtDate(orc.criado_em))
  ctx.twoCol('Valido ate', fmtDate(orc.validade), '', '')

  // Cliente
  desenharCliente(ctx, orc, 'Dados do Cliente')

  // Equipamento
  desenharEquipamento(ctx, orc)

  // Diagnóstico
  desenharDiagnostico(ctx, orc)

  // Itens — mostrar apenas valores do cliente
  const itensMostrar = (orc.itens||[]).map(it => ({
    ...it,
    valor_unit: it.paga_cliente && it.quantidade
      ? parseFloat(it.paga_cliente) / Math.max(parseInt(it.quantidade)||1, 1)
      : it.valor_unit,
    valor_total: it.paga_cliente !== undefined && it.paga_cliente !== ''
      ? parseFloat(it.paga_cliente)||0
      : it.valor_total,
  }))

  // Para cenário particular/fora_contrato: mostrar tudo
  const totalMostrar = (orc.cenario === 'particular' || orc.cenario === 'fora_contrato')
    ? orc.total_geral
    : orc.total_cliente

  sectionHeader('Servicos e Valores')

  if (orc.cenario === 'material_cliente' || orc.cenario === 'seguradora_cobre_tudo') {
    desenharTabelaItens(ctx, itensMostrar.filter(it => (parseFloat(it.paga_cliente)||0) > 0), 'TOTAL DO CLIENTE', totalMostrar)
    let y = getY()
    doc.setFont('helvetica','italic'); doc.setFontSize(8); doc.setTextColor(107,124,147)
    doc.text('* Parte do servico e coberta pela seguradora.', M, y); setY(y+6)
  } else {
    desenharTabelaItens(ctx, itensMostrar, 'TOTAL GERAL', totalMostrar)
  }

  // Condições
  desenharCondicoes(ctx, orc)

  // Observações
  desenharObs(ctx, orc)

  // Nota de garantia
  sectionHeader('Nota de Garantia')
  textBlock('',
    orc.garantia_obs ||
    'A garantia e valida somente para pecas e materiais fornecidos por nossa empresa. ' +
    'Caso o cliente opte por adquirir materiais de outro fornecedor, a garantia sobre as pecas nao se aplica.'
  )

  // Aprovação
  desenharAprovacao(ctx, orc)

  desenharFooter(ctx, empresa)

  const nome = s(orc.nome_cliente||'cliente').replace(/\s+/g,'_')
  ctx.doc.save(`orcamento_cliente_${s(orc.numero)}_${nome}.pdf`)
}

// ── VERSÃO SEGURADORA ────────────────────────────────────────
// Mostra apenas o que a seguradora paga. Inclui nº assistência.
// Sem valores do cliente.
export async function generatePDFSeguradora(orc, empresa) {
  const { default: jsPDF } = await import('jspdf')
  const ctx = criarDoc(jsPDF, 'ORCAMENTO TECNICO')
  desenharHeader(ctx, orc, empresa, 'ORCAMENTO TECNICO')

  const { sectionHeader, doc, M, getY, setY } = ctx

  // Infos gerais + seguradora
  ctx.twoCol('Numero', orc.numero, 'Data de Emissao', fmtDate(orc.criado_em))
  ctx.twoCol('Seguradora', orc.seguradora, 'No. Assistencia', orc.num_assist)
  ctx.twoCol('Valido ate', fmtDate(orc.validade), '', '')

  // Segurado
  desenharCliente(ctx, orc, 'Dados do Segurado')

  // Equipamento
  desenharEquipamento(ctx, orc)

  // Diagnóstico
  desenharDiagnostico(ctx, orc)

  // Detecta se há divisão entre seguradora e cliente
  const todosItens = orc.itens || []
  const temDivisao = todosItens.some(it =>
    (parseFloat(it.paga_seguradora)||0) > 0 && (parseFloat(it.paga_cliente)||0) > 0
  )
  const itensSeg = todosItens.filter(it => (parseFloat(it.paga_seguradora)||0) > 0)

  sectionHeader('Servicos e Valores')

  if (todosItens.length === 0 || itensSeg.length === 0) {
    let y = getY()
    doc.setFont('helvetica','italic'); doc.setFontSize(8); doc.setTextColor(107,124,147)
    doc.text('Nenhum item coberto pela seguradora neste orcamento.', M, y)
    setY(y+6)
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(30,45,61)
    // Mostra tabela simples de todos os itens como referência
    if (todosItens.length > 0) {
      const itensRef = todosItens.map(it => ({
        ...it,
        valor_unit: parseFloat(it.valor_unit)||0,
        valor_total: parseFloat(it.valor_total)||0,
      }))
      desenharTabelaItens(ctx, itensRef, 'TOTAL GERAL', orc.total_geral)
      y = getY()
      doc.setFont('helvetica','italic'); doc.setFontSize(7.5); doc.setTextColor(107,124,147)
      doc.text('* Divisao entre seguradora e cliente nao configurada neste orcamento.', M, y)
      setY(y+8)
    }
  } else if (temDivisao) {
    desenharTabelaItensDivisao(ctx, todosItens, orc.total_seguradora, orc.total_cliente)
  } else {
    const itensSegMapped = itensSeg.map(it => ({
      ...it,
      valor_unit: parseFloat(it.paga_seguradora) / Math.max(parseInt(it.quantidade)||1, 1),
      valor_total: parseFloat(it.paga_seguradora)||0,
    }))
    desenharTabelaItens(ctx, itensSegMapped, 'TOTAL SEGURADORA', orc.total_seguradora)
  }

  // Condições
  desenharCondicoes(ctx, orc)

  // Observações
  desenharObs(ctx, orc)

  // Aprovação
  desenharAprovacao(ctx, orc)

  desenharFooter(ctx, empresa)

  const nome = s(orc.nome_cliente||'segurado').replace(/\s+/g,'_')
  ctx.doc.save(`orcamento_seguradora_${s(orc.numero)}_${nome}.pdf`)
}
