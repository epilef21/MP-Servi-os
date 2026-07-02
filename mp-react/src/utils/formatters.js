// Utilitarios de formatacao e mascaramento puros — sem dependencias externas.
// Extraidos de AdminPage.jsx para permitir testes isolados.

export function fmtDate(d) {
  if (!d) return '—'
  if (typeof d === 'string') {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return d
    if (d.includes('-')) {
      const [y, m, day] = d.split('-')
      return `${day}/${m}/${y}`
    }
  }
  if (d?.toDate) {
    const dt = d.toDate()
    return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`
  }
  return '—'
}

export function fmtBRL(v) {
  const n = parseFloat(v)
  if (isNaN(n)) return '—'
  return `R$ ${n.toFixed(2).replace('.', ',')}`
}

export function getLucro(r) {
  const mos = parseFloat(r.mo_seguradora)      || 0
  const vpt = parseFloat(r.valor_prestador)    || 0
  const vds = parseFloat(r.valor_deslocamento) || 0
  return (mos || vpt || vds) ? (mos - vpt) + vds : null
}

export function maskPhone(v) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
}

export function fmtDatetime(ts) {
  if (!ts) return '—'
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleString('pt-BR')
  } catch { return '—' }
}

export function fmtSN(v) {
  return v === 'sim' ? '✅ Sim' : v === 'nao' ? '❌ Não' : '—'
}

export function maskCNPJ(v) {
  const d = v.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}
