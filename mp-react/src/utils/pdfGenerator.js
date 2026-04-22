import jsPDF from 'jspdf'

// ── Fix: use standard font, replace accented chars for PDF ──
function sanitize(str) {
  if (!str) return '—'
  return String(str)
    .replace(/[áàãâä]/g,'a').replace(/[ÁÀÃÂÄ]/g,'A')
    .replace(/[éèêë]/g,'e').replace(/[ÉÈÊË]/g,'E')
    .replace(/[íìîï]/g,'i').replace(/[ÍÌÎÏ]/g,'I')
    .replace(/[óòõôö]/g,'o').replace(/[ÓÒÕÔÖ]/g,'O')
    .replace(/[úùûü]/g,'u').replace(/[ÚÙÛÜ]/g,'U')
    .replace(/[ç]/g,'c').replace(/[Ç]/g,'C')
    .replace(/[ñ]/g,'n').replace(/[Ñ]/g,'N')
}
function s(v) { return sanitize(v) }

function fmtDate(d) {
  if (!d) return '—'
  if (typeof d === 'string' && d.includes('-')) {
    const [y,m,day] = d.split('-')
    return `${day}/${m}/${y}`
  }
  return d
}
function fmtSN(v) {
  if (v === 'sim') return 'SIM'
  if (v === 'nao') return 'NAO'
  return '—'
}
function fmtBRL(v) {
  if (!v && v !== 0) return '—'
  const n = parseFloat(v)
  if (isNaN(n)) return String(v)
  return `R$ ${n.toFixed(2).replace('.',',')}`
}

export function generatePDF(r) {
  const doc = new jsPDF({ unit:'mm', format:'a4' })
  const W   = doc.internal.pageSize.getWidth()
  const H   = doc.internal.pageSize.getHeight()
  const M   = 14

  let y = 0

  // ── HEADER ───────────────────────────────────────────────────
  doc.setFillColor(26,63,168)
  doc.rect(0,0,W,38,'F')
  doc.setFillColor(240,90,26)
  doc.rect(0,38,W,2,'F')

  doc.setTextColor(255,255,255)
  doc.setFont('helvetica','bold')
  doc.setFontSize(20)
  doc.text('ASSISTHUB',M,16)

  doc.setFontSize(9); doc.setFont('helvetica','normal')
  doc.text('Relatorio Tecnico de Atendimento ao Segurado',M,24)

  doc.setFontSize(8)
  doc.text(`Assistencia: ${s(r.num_assist)}`,W-M,13,{align:'right'})
  doc.text(`Data: ${fmtDate(r.data_chegada)}`,W-M,20,{align:'right'})
  doc.text(`Chegada: ${s(r.hora_chegada)||'—'}  Saida: ${s(r.hora_saida)||'—'}`,W-M,27,{align:'right'})

  y = 46

  // ── HELPERS ──────────────────────────────────────────────────
  function checkPage(needed=20) {
    if (y > H - needed) { doc.addPage(); y = 16 }
  }
  function sectionHeader(title) {
    checkPage(14)
    doc.setFillColor(240,245,252)
    doc.rect(M,y,W-M*2,7,'F')
    doc.setDrawColor(208,218,232)
    doc.rect(M,y,W-M*2,7,'S')
    doc.setTextColor(26,63,168); doc.setFont('helvetica','bold'); doc.setFontSize(8)
    doc.text(title.toUpperCase(),M+3,y+4.8)
    y += 11
  }
  function twoCol(l1,v1,l2,v2) {
    checkPage(12)
    const hw = (W-M*2)/2
    doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(107,124,147)
    doc.text(l1.toUpperCase(),M,y)
    if(l2) doc.text(l2.toUpperCase(),M+hw,y)
    const lines1 = doc.splitTextToSize(s(v1),hw-4)
    const lines2 = l2 ? doc.splitTextToSize(s(v2),hw-4) : []
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(30,45,61)
    doc.text(lines1,M,y+4)
    if(l2) doc.text(lines2,M+hw,y+4)
    y += Math.max(lines1.length,lines2.length||1)*4+6
  }
  function textBlock(label,value) {
    checkPage(24)
    doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(107,124,147)
    doc.text(label.toUpperCase(),M,y); y+=4
    const lines = doc.splitTextToSize(s(value),W-M*2-4)
    const bh = lines.length*4+5
    doc.setFillColor(245,247,250); doc.rect(M,y,W-M*2,bh,'F')
    doc.setDrawColor(208,218,232); doc.rect(M,y,W-M*2,bh,'S')
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(30,45,61)
    doc.text(lines,M+3,y+4)
    y += bh+5
  }

  // ── SECTION 1 ────────────────────────────────────────────────
  sectionHeader('Dados do Atendimento')
  twoCol('Seguradora',r.seguradora,'No. Assistencia',r.num_assist)
  twoCol('Servico',r.servico,'','')

  // ── SECTION 2 ────────────────────────────────────────────────
  sectionHeader('Dados do Segurado')
  twoCol('Nome Completo',r.nome_segurado,'Telefone',r.tel_segurado)
  twoCol('Endereco',r.endereco,'Cidade',r.cidade)

  // ── SECTION 3 ────────────────────────────────────────────────
  sectionHeader('Descricoes')
  textBlock('Descricao do Problema e Servico a Realizar',r.desc_problema)
  if(r.avarias) textBlock('Avarias Pre-Existentes',r.avarias)
  textBlock('Descricao do Servico Realizado',r.desc_servico)
  if(r.pecas) textBlock('Pecas / Materiais Utilizados',r.pecas)

  // ── SECTION 4: CHECK-UP ──────────────────────────────────────
  sectionHeader('Chek-Up Realizado')
  if(r.checkup?.length>0) {
    const cols=2; const itemW=(W-M*2)/cols
    r.checkup.forEach((item,idx) => {
      const col=idx%cols; const xPos=M+col*itemW
      if(col===0&&idx>0) y+=7
      checkPage(12)
      doc.setFillColor(232,240,251); doc.rect(xPos,y,itemW-3,6,'F')
      doc.setDrawColor(192,208,232); doc.rect(xPos,y,itemW-3,6,'S')
      doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(26,63,168)
      const lbl = item.quant ? `${s(item.item)}  (Qtd: ${item.quant})` : s(item.item)
      doc.text(lbl,xPos+3,y+4.2)
    })
    y+=10
  } else {
    doc.setFont('helvetica','italic'); doc.setFontSize(8); doc.setTextColor(107,124,147)
    doc.text('Nenhum item de chek-up marcado.',M,y); y+=8
  }

  // ── SECTION 5: CONCLUSÃO ─────────────────────────────────────
  sectionHeader('Conclusao do Servico')
  checkPage(16)
  const qW=(W-M*2)/4
  ;[
    ['Prob. Solucionado',fmtSN(r.problema_solucionado)],
    ['Havera Retorno',fmtSN(r.havera_retorno)],
    ['Garantia 90d',fmtSN(r.garantia)],
    ['Excedente',s(r.excedente)||'—'],
  ].forEach(([lbl,val],idx) => {
    const xPos=M+idx*qW
    doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(107,124,147)
    doc.text(lbl.toUpperCase(),xPos,y)
    doc.setFont('helvetica','bold'); doc.setFontSize(9)
    const color=val==='SIM'?[45,138,78]:val==='NAO'?[192,57,43]:[30,45,61]
    doc.setTextColor(...color)
    doc.text(val,xPos,y+5)
  })
  y+=12
  if(r.especifique) textBlock('Especificacao',r.especifique)

  // ── SECTION 6: ASSINATURAS ───────────────────────────────────
  if(y > H-60) { doc.addPage(); y=16 }
  sectionHeader('Assinaturas')
  const sigW=(W-M*2-10)/2; const sigH=30; const sigY=y
  doc.setFillColor(245,247,250); doc.rect(M,sigY,sigW,sigH,'F')
  doc.setDrawColor(208,218,232); doc.rect(M,sigY,sigW,sigH,'S')
  doc.rect(M+sigW+10,sigY,sigW,sigH,'F')
  doc.rect(M+sigW+10,sigY,sigW,sigH,'S')
  doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(107,124,147)
  doc.text('ASSINATURA DO PRESTADOR',M+2,sigY+3)
  doc.text('ASSINATURA DO SEGURADO',M+sigW+12,sigY+3)
  if(r.assinatura_prestador) { try { doc.addImage(r.assinatura_prestador,'PNG',M+2,sigY+5,sigW-4,sigH-8) } catch{} }
  if(r.assinatura_segurado)  { try { doc.addImage(r.assinatura_segurado,'PNG',M+sigW+12,sigY+5,sigW-4,sigH-8) } catch{} }
  y = sigY+sigH+8

  // ── FOOTER ───────────────────────────────────────────────────
  const pages = doc.internal.getNumberOfPages()
  for(let i=1;i<=pages;i++) {
    doc.setPage(i)
    doc.setFillColor(26,63,168); doc.rect(0,H-12,W,12,'F')
    doc.setTextColor(255,255,255); doc.setFont('helvetica','normal'); doc.setFontSize(7)
    doc.text('AssistHub  |  assisthub.com.br',M,H-4.5)
    doc.text(`Pagina ${i} de ${pages}`,W-M,H-4.5,{align:'right'})
  }

  const fname=`relatorio_${s(r.nome_segurado).replace(/\s+/g,'_')}_${r.data_chegada||'data'}.pdf`
  doc.save(fname)
}
