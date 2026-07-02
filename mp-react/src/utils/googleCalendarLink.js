// Link manual para o técnico adicionar a OS à própria agenda — sem OAuth, sem login.
// Abre o Google Calendar com os dados pré-preenchidos para salvar com um clique.

function getHorarioFaixa(faixa) {
  const map = {
    manha:    { inicio: '08:00', fim: '12:00' },
    tarde:    { inicio: '13:00', fim: '17:00' },
    dia_todo: { inicio: '08:00', fim: '17:00' },
  }
  return map[faixa] || null
}

function fmtGoogleDate(dataStr, horaStr) {
  const [ano, mes, dia] = dataStr.split('-')
  const [h, m] = horaStr.split(':')
  return `${ano}${mes}${dia}T${h}${m}00`
}

export function buildGoogleCalendarLink(os, slug) {
  if (!os.data_agendada) return null

  const titulo = encodeURIComponent(
    `OS ${os.num_assist || ''} - ${os.nome_segurado || ''}`.trim()
  )

  const checklistLink = slug
    ? `${window.location.origin}/${slug}?os=${os.id}${os.publicToken ? '&t=' + os.publicToken : ''}`
    : ''

  const descricao = encodeURIComponent(
    `Seguradora: ${os.seguradora || '-'}\n` +
    `Serviço: ${os.servico || '-'}\n` +
    `Cliente: ${os.nome_segurado || '-'}\n` +
    `Telefone: ${os.tel_segurado || '-'}` +
    (os.desc_problema ? `\n\nDescrição: ${os.desc_problema}` : '') +
    (checklistLink ? `\n\n🔗 Preencher Checklist:\n${checklistLink}` : '')
  )
  const endereco = encodeURIComponent(
    `${os.endereco || ''}${os.numero ? ', ' + os.numero : ''} - ${os.cidade || ''}`
  )

  const faixaInfo = getHorarioFaixa(os.faixa_horario)
  let datesParam

  if (faixaInfo) {
    const inicio = fmtGoogleDate(os.data_agendada, faixaInfo.inicio)
    const fim    = fmtGoogleDate(os.data_agendada, faixaInfo.fim)
    datesParam = `${inicio}/${fim}`
  } else {
    // Evento de dia inteiro: Google Calendar usa [início, fim) então fim = dia seguinte
    const [ano, mes, dia] = os.data_agendada.split('-')
    const diaSeguite = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia) + 1)
    const segFmt = diaSeguite.toISOString().slice(0, 10).replace(/-/g, '')
    datesParam = `${ano}${mes}${dia}/${segFmt}`
  }

  return (
    `https://calendar.google.com/calendar/render?` +
    `action=TEMPLATE&text=${titulo}&dates=${datesParam}` +
    `&details=${descricao}&location=${endereco}`
  )
}
