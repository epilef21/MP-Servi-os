import html2canvas from 'html2canvas'

function fmtDate(d) {
  if (!d) return '—'
  if (typeof d === 'string' && d.includes('-')) {
    const [y,m,day] = d.split('-')
    return `${day}/${m}/${y}`
  }
  return d
}
function fmtSN(v) {
  if (v === 'sim') return '✅ Sim'
  if (v === 'nao') return '❌ Não'
  return '—'
}
function fmtBRL(v) {
  const n = parseFloat(v)
  if (isNaN(n)) return '—'
  return `R$ ${n.toFixed(2).replace('.',',')}`
}

export async function generatePNG(r) {
  // Create a temporary off-screen div
  const container = document.createElement('div')
  container.id = 'png-report-container'

  const lucro = (parseFloat(r.maoDeObraSeguradora)||0) - ((parseFloat(r.valorPagoTecnico)||0) + (parseFloat(r.kmDeslocamento)||0))
  const lucroColor = lucro >= 0 ? '#2d8a4e' : '#c0392b'

  const checkupHtml = (r.checkup||[]).map(c => {
    const label = typeof c === 'object' ? `${c.item}${c.quant?` (Qtd: ${c.quant})`:''}` : c
    return `<span style="background:#e8f0fb;color:#1a3a5c;border:1px solid #c0d0e8;border-radius:5px;padding:3px 9px;font-size:12px;font-weight:600;display:inline-block;margin:3px 3px 3px 0;">${label}</span>`
  }).join('')

  container.innerHTML = `
    <div style="width:600px;font-family:Arial,sans-serif;background:#fff;padding:0;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.15);">
      <!-- HEADER -->
      <div style="background:#1a3a5c;padding:20px 24px;display:flex;align-items:center;gap:14px;">
        <div style="width:48px;height:48px;background:#e8a020;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;">🏠</div>
        <div>
          <div style="font-size:22px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:1px;">MP Serviços</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:2px;">Relatório Técnico de Atendimento</div>
        </div>
        <div style="margin-left:auto;text-align:right;">
          <div style="font-size:12px;color:#e8a020;font-weight:700;">OS: ${r.num_assist||'—'}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:2px;">${fmtDate(r.data_chegada)}</div>
        </div>
      </div>
      <div style="height:3px;background:#e8a020;"></div>

      <div style="padding:20px 24px;">
        <!-- ATENDIMENTO -->
        <div style="margin-bottom:16px;">
          <div style="font-size:11px;font-weight:700;color:#6b7c93;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e0e8f0;padding-bottom:6px;margin-bottom:10px;">📋 Dados do Atendimento</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div><div style="font-size:10px;color:#6b7c93;font-weight:700;text-transform:uppercase;">Seguradora</div><div style="font-size:14px;font-weight:600;color:#1e2d3d;margin-top:2px;">${r.seguradora||'—'}</div></div>
            <div><div style="font-size:10px;color:#6b7c93;font-weight:700;text-transform:uppercase;">Serviço</div><div style="font-size:14px;font-weight:600;color:#1e2d3d;margin-top:2px;">${r.servico||'—'}</div></div>
            <div><div style="font-size:10px;color:#6b7c93;font-weight:700;text-transform:uppercase;">Chegada</div><div style="font-size:14px;color:#1e2d3d;margin-top:2px;">${r.hora_chegada||'—'}</div></div>
            <div><div style="font-size:10px;color:#6b7c93;font-weight:700;text-transform:uppercase;">Saída</div><div style="font-size:14px;color:#1e2d3d;margin-top:2px;">${r.hora_saida||'—'}</div></div>
          </div>
        </div>

        <!-- SEGURADO -->
        <div style="margin-bottom:16px;">
          <div style="font-size:11px;font-weight:700;color:#6b7c93;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e0e8f0;padding-bottom:6px;margin-bottom:10px;">👤 Segurado</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div><div style="font-size:10px;color:#6b7c93;font-weight:700;text-transform:uppercase;">Nome</div><div style="font-size:14px;font-weight:600;color:#1e2d3d;margin-top:2px;">${r.nome_segurado||'—'}</div></div>
            <div><div style="font-size:10px;color:#6b7c93;font-weight:700;text-transform:uppercase;">Cidade</div><div style="font-size:14px;color:#1e2d3d;margin-top:2px;">${r.cidade||'—'}</div></div>
            <div style="grid-column:1/-1;"><div style="font-size:10px;color:#6b7c93;font-weight:700;text-transform:uppercase;">Endereço</div><div style="font-size:13px;color:#1e2d3d;margin-top:2px;">${r.endereco||'—'}</div></div>
          </div>
        </div>

        <!-- SERVIÇO -->
        <div style="margin-bottom:16px;">
          <div style="font-size:11px;font-weight:700;color:#6b7c93;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e0e8f0;padding-bottom:6px;margin-bottom:10px;">📝 Serviço Realizado</div>
          <div style="background:#f5f7fa;border-radius:7px;padding:10px 12px;font-size:13px;line-height:1.5;color:#1e2d3d;">${r.desc_servico||'—'}</div>
        </div>

        <!-- CHECKUP -->
        ${checkupHtml ? `<div style="margin-bottom:16px;">
          <div style="font-size:11px;font-weight:700;color:#6b7c93;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e0e8f0;padding-bottom:6px;margin-bottom:10px;">✅ Chek-Up</div>
          <div>${checkupHtml}</div>
        </div>` : ''}

        <!-- CONCLUSÃO -->
        <div style="margin-bottom:16px;">
          <div style="font-size:11px;font-weight:700;color:#6b7c93;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e0e8f0;padding-bottom:6px;margin-bottom:10px;">🏁 Conclusão</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;">
            <div><div style="font-size:10px;color:#6b7c93;font-weight:700;text-transform:uppercase;">Solucionado</div><div style="font-size:13px;font-weight:600;margin-top:2px;">${fmtSN(r.problema_solucionado)}</div></div>
            <div><div style="font-size:10px;color:#6b7c93;font-weight:700;text-transform:uppercase;">Retorno</div><div style="font-size:13px;font-weight:600;margin-top:2px;">${fmtSN(r.havera_retorno)}</div></div>
            <div><div style="font-size:10px;color:#6b7c93;font-weight:700;text-transform:uppercase;">Garantia</div><div style="font-size:13px;font-weight:600;margin-top:2px;">${fmtSN(r.garantia)}</div></div>
            <div><div style="font-size:10px;color:#6b7c93;font-weight:700;text-transform:uppercase;">Excedente</div><div style="font-size:13px;font-weight:600;margin-top:2px;">${r.excedente||'—'}</div></div>
          </div>
        </div>

        <!-- FINANCEIRO -->
        ${r.maoDeObraSeguradora || r.valorPagoTecnico ? `
        <div style="margin-bottom:16px;background:linear-gradient(135deg,#f5f7fa,#eaf0f7);border-radius:10px;padding:14px 16px;border:1px solid #d0dae8;">
          <div style="font-size:11px;font-weight:700;color:#6b7c93;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">💰 Financeiro</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;">
            <div><div style="font-size:10px;color:#6b7c93;font-weight:700;text-transform:uppercase;">Mão de Obra</div><div style="font-size:14px;font-weight:700;color:#1e2d3d;margin-top:2px;">${fmtBRL(r.maoDeObraSeguradora)}</div></div>
            <div><div style="font-size:10px;color:#6b7c93;font-weight:700;text-transform:uppercase;">KM</div><div style="font-size:14px;font-weight:700;color:#1e2d3d;margin-top:2px;">${r.kmDeslocamento||'—'}</div></div>
            <div><div style="font-size:10px;color:#6b7c93;font-weight:700;text-transform:uppercase;">Pago Técnico</div><div style="font-size:14px;font-weight:700;color:#1e2d3d;margin-top:2px;">${fmtBRL(r.valorPagoTecnico)}</div></div>
            <div style="background:${lucroColor};border-radius:7px;padding:8px 10px;"><div style="font-size:10px;color:rgba(255,255,255,0.8);font-weight:700;text-transform:uppercase;">Lucro Real</div><div style="font-size:17px;font-weight:900;color:#fff;margin-top:2px;">${fmtBRL(lucro)}</div></div>
          </div>
        </div>` : ''}

        <!-- ASSINATURAS -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
          <div>
            <div style="font-size:10px;color:#6b7c93;font-weight:700;text-transform:uppercase;margin-bottom:6px;">Assinatura Prestador</div>
            <div style="border:1.5px solid #d0dae8;border-radius:7px;background:#f5f7fa;height:80px;overflow:hidden;display:flex;align-items:center;justify-content:center;">
              ${r.assinatura_prestador ? `<img src="${r.assinatura_prestador}" style="max-height:72px;max-width:100%;object-fit:contain;">` : '<span style="color:#aaa;font-size:12px;">Não registrada</span>'}
            </div>
          </div>
          <div>
            <div style="font-size:10px;color:#6b7c93;font-weight:700;text-transform:uppercase;margin-bottom:6px;">Assinatura Segurado</div>
            <div style="border:1.5px solid #d0dae8;border-radius:7px;background:#f5f7fa;height:80px;overflow:hidden;display:flex;align-items:center;justify-content:center;">
              ${r.assinatura_segurado ? `<img src="${r.assinatura_segurado}" style="max-height:72px;max-width:100%;object-fit:contain;">` : '<span style="color:#aaa;font-size:12px;">Não registrada</span>'}
            </div>
          </div>
        </div>
      </div>

      <!-- FOOTER -->
      <div style="background:#1a3a5c;padding:10px 24px;display:flex;justify-content:space-between;align-items:center;">
        <span style="color:rgba(255,255,255,0.6);font-size:11px;">MP Serviços  |  (14) 99609-5296 / 98833-6561</span>
        <span style="color:rgba(255,255,255,0.4);font-size:10px;">ID: ${r.id?.slice(0,8)||'—'}</span>
      </div>
    </div>
  `

  Object.assign(container.style, {
    position: 'fixed',
    top: '-9999px',
    left: '-9999px',
    width: '600px',
    zIndex: '-1',
  })

  document.body.appendChild(container)

  try {
    const canvas = await html2canvas(container.firstElementChild, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    })

    const link = document.createElement('a')
    link.download = `relatorio_${(r.nome_segurado||'mp').replace(/\s+/g,'_')}_${r.data_chegada||'data'}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  } finally {
    document.body.removeChild(container)
  }
}
