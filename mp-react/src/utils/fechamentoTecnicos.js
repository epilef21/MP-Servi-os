// ============================================================
// fechamentoTecnicos.js — Agrupamento de OS por técnico e cálculo do total a pagar
// ============================================================
// Módulo 100% puro — sem dependência de Firebase/React (ver threat model 08-01).

// Normaliza nome do técnico (OS.tecnico_nome é texto livre — digitado ou vindo do cadastro)
// para casar com o técnico cadastrado. trim + lowercase + colapsa espaços internos.
export function normNome(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

// OS pertencem ao mês pelo criado_em — MESMO critério do calcularDRE (consistência LOCKED no CONTEXT.md).
export function osDoMes(reports, mesRef) {
  return (reports || []).filter(r => {
    try {
      const d = r.criado_em?.toDate?.()
      return d && d.toISOString().slice(0, 7) === mesRef
    } catch { return false }
  })
}

// Agrupa as OS do mês por técnico somando valor_prestador.
// Chave do grupo: normNome(os.tecnico_nome) — o nome sempre existe na OS; tecnico_id nem
// sempre (técnico digitado manualmente não tem id). Cada grupo carrega tecnicoId
// (primeiro tecnico_id não vazio visto) para o consumidor casar com o cadastro por ID
// PRIMEIRO, com fallback pelo nome normalizado.
// Retorna [{ tecnicoNome, tecnicoNorm, tecnicoId, osList, total, count }] ordenado por tecnicoNome.
export function agruparPorTecnico(reports, mesRef) {
  const doMes = osDoMes(reports, mesRef)
  const grupos = {}
  for (const os of doMes) {
    const norm = normNome(os.tecnico_nome)
    if (!grupos[norm]) {
      grupos[norm] = {
        tecnicoNome: (os.tecnico_nome || '').trim() || '(sem técnico)',
        tecnicoNorm: norm,
        tecnicoId: '',
        osList: [],
        total: 0,
        count: 0,
      }
    }
    if (!grupos[norm].tecnicoId && os.tecnico_id) grupos[norm].tecnicoId = os.tecnico_id
    grupos[norm].osList.push(os)
    grupos[norm].total += parseFloat(os.valor_prestador) || 0
    grupos[norm].count += 1
  }
  return Object.values(grupos).sort((a, b) => a.tecnicoNome.localeCompare(b.tecnicoNome))
}

// Acha o doc de fechamento (mesmo técnico normalizado + mês) numa lista já carregada do Firestore.
export function acharFechamento(fechamentos, tecnicoNorm, mesRef) {
  return (fechamentos || []).find(
    f => f.tecnico_norm === tecnicoNorm && f.mes_referencia === mesRef
  ) || null
}

// Status derivado: 'pago' só quando existe doc pago; 'pendente' NUNCA é gravado (igual às notas da Fase 7).
export function statusFechamento(fechamento) {
  return fechamento?.status === 'pago' ? 'pago' : 'pendente'
}
