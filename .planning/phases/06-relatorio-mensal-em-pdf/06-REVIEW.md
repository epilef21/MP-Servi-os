---
phase: 06-relatorio-mensal-em-pdf
reviewed: 2026-05-04T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - mp-react/src/utils/relatorioMensalPdf.js
  - mp-react/src/pages/AdminPage.jsx
findings:
  critical: 3
  warning: 4
  info: 3
  total: 10
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-05-04
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed the new PDF report utility (`relatorioMensalPdf.js`) and the phase 6 additions to `AdminPage.jsx` (import, 3 useState lines, `gerarRelatorio`, sidebar item, and the `abaAtiva === 'relatorio'` JSX section).

The aggregation logic is structurally correct and the jsPDF rendering pipeline is well-organised. However, three blockers were found: (1) the `checkPage` guard does not account for the 12 mm footer band, so content rows can paint over the footer on long reports; (2) `MESES[mes-1]` can be `undefined` if `mes` is ever outside 1–12, crashing `doc.text()`; (3) `gerarRelatorio` reads `relMes`/`relAno` from React state that may not yet reflect a just-scheduled state update, producing a report for the wrong period.

Four warnings cover a duplicated `getLucro` helper, a misleading "Média por OS" denominator, a fragile option-value parse, and a silent division-by-zero guard. Three info items cover duplicate constant declarations, missing ARIA label, and potential emoji corruption in the PDF footer.

---

## Critical Issues

### CR-01: `checkPage` does not reserve footer space — content overwrites footer band

**File:** `mp-react/src/utils/relatorioMensalPdf.js:90-91`

**Issue:** The footer is rendered at `H-12` (a 12 mm band). `checkPage(needed)` triggers a page break only when `y > H - needed`, where callers pass 10–20. Because `needed` is never 12 mm greater than the actual content height, rows that fall in the last 12 mm of the printable area are rendered directly on top of the footer background. This produces visually corrupted pages on any report long enough to span the bottom margin.

Concrete scenario: a `tableRow` call with `needed=10` triggers `checkPage` at `y > H-10 = 287`. A row starting at `y=282` passes the guard, then `rect` draws a 7 mm box from `y=282` to `y=289`, which overlaps the `H-12=285` footer band.

**Fix:**
```js
// Reserve footer height in the threshold — use H - 12 - needed
function checkPage(needed = 20) {
  if (y + needed > H - 12) { doc.addPage(); y = 16 }
}
```
Change the condition from `y > H - needed` to `y + needed > H - 12`. The footer is always 12 mm tall, so the usable area ends at `H - 12`.

---

### CR-02: `MESES[mes-1]` is `undefined` for out-of-range `mes` — crashes `doc.text()`

**File:** `mp-react/src/utils/relatorioMensalPdf.js:153`

**Issue:** `MESES` has 12 entries (indices 0–11). `mes` is used as a 1-based month number, so `MESES[mes-1]` is the lookup. No validation is performed on `mes` before this access. If `mes` is `0`, `13`, or `NaN` (which can happen if the `<select>` option string parse in `AdminPage.jsx:2063` fails), the expression evaluates to `undefined`.

jsPDF's `doc.text()` does not accept `undefined` — it throws a runtime exception. The PDF generation silently fails with no error shown to the user (there is no try/catch around `gerarRelatorioMensalPdf` in AdminPage).

**Fix:**
```js
// Validate at the top of gerarRelatorioMensalPdf
export function gerarRelatorioMensalPdf(dados, mes, ano, nomeEmpresa) {
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    console.error('gerarRelatorioMensalPdf: mes invalido', mes)
    return
  }
  // ... rest of function
  doc.text(`${MESES[mes-1]} / ${ano}`, W-M, 16, { align: 'right' })
```

Also, the caller in `AdminPage.jsx:2211` should be wrapped in a try/catch or display a user-facing error toast on failure.

---

### CR-03: `gerarRelatorio` may read stale `relMes`/`relAno` state

**File:** `mp-react/src/pages/AdminPage.jsx:570-572`

**Issue:** React state updates (`setRelMes`, `setRelAno`) triggered in the `onChange` handler are asynchronous — they are queued for the next render. The `gerarRelatorio` function closes over the current render's `relMes`/`relAno`. In normal use (user picks period, then clicks the button in the next event), this is fine because a re-render happens between the two interactions.

However, the function reads state directly:

```js
function gerarRelatorio() {
  setRelDados(agregarRelatorio(reports, relMes, relAno))
}
```

If any parent interaction or test calls `setRelMes` and then immediately calls `gerarRelatorio` without a render cycle in between (e.g., a programmatic call or a rapidly automated user interaction), the aggregation will use the previous month/year. The stable pattern is to derive the current values from the DOM or use a `useCallback` with explicit dependencies, so it is explicit which values are used.

**Fix:**
```js
// Pass current values explicitly to remove the stale-closure risk
function gerarRelatorio() {
  setRelDados(agregarRelatorio(reports, relMes, relAno))
}
// Keep as-is for normal interactive use, but add a dependency comment:
// relMes and relAno are reset to null via setRelDados(null) on change,
// so the button is only visible after a re-render with the new values.
```

The concrete safe fix is to read the values from the select element's current value instead of from state, or add a `useEffect` that auto-clears `relDados` on dependency change (which already happens via `setRelDados(null)` in `onChange` — so the "Gerar Relatório" button must be clicked after the render, making stale reads impossible in practice through the UI). This blocker is therefore **only exploitable in automated/programmatic paths**, but should be documented clearly and hardened.

A robust fix that eliminates the risk entirely:

```js
// Read the values explicitly at call time from the event handler
<button
  className="btn-primary"
  onClick={() => setRelDados(agregarRelatorio(reports, relMes, relAno))}
  style={{ minWidth: 160 }}
>
  📊 Gerar Relatório
</button>
```

This removes the intermediate `gerarRelatorio` function and makes the data dependency explicit in JSX.

---

## Warnings

### WR-01: `getLucroLocal` is a byte-for-byte duplicate of `getLucro` in AdminPage

**File:** `mp-react/src/utils/relatorioMensalPdf.js:30-35` and `mp-react/src/pages/AdminPage.jsx:79-84`

**Issue:** Both functions implement the same formula: `(mos - vpt) + vds`, return `null` when all fields are falsy, and use the same field names (`mo_seguradora`, `valor_prestador`, `valor_deslocamento`). If the business formula changes (e.g., adding a new cost field), only one copy is likely to be updated, causing a silent discrepancy between the dashboard display and the PDF report.

**Fix:** Export `getLucro` from a shared utility (e.g., `mp-react/src/utils/financeiro.js`) and import it in both `AdminPage.jsx` and `relatorioMensalPdf.js`:

```js
// mp-react/src/utils/financeiro.js
export function getLucro(r) {
  const mos = parseFloat(r.mo_seguradora)      || 0
  const vpt = parseFloat(r.valor_prestador)    || 0
  const vds = parseFloat(r.valor_deslocamento) || 0
  return (mos || vpt || vds) ? (mos - vpt) + vds : null
}
```

---

### WR-02: `mediaPorOS` denominator is `osComLucro`, not `totalOS` — label is misleading

**File:** `mp-react/src/utils/relatorioMensalPdf.js:76` and `AdminPage.jsx:2124-2126`

**Issue:** The metric is labelled "Média por OS" in both the card (`metric-label`) and the PDF (`twoCol`). The divisor is `osComLucro` — the count of OS that have at least one financial field populated. If 10 OS exist in the period and only 3 have financial data, the "Média por OS" shows the average across 3, not 10. The displayed value is numerically misleading: it is inflated by a factor of `totalOS / osComLucro` relative to what the label implies.

**Fix:** Either change the label to "Média por OS com Financeiro" in both the JSX (AdminPage line 2126) and the PDF utility (line 161), or change the divisor to `filtered.length` (total OS):

```js
// Option A — fix the label (recommended, since the intent is to show avg of profitable OS)
twoCol('Lucro total', fmtBRL(dados.lucroTotal), 'Media por OS financeiro', fmtBRL(dados.mediaPorOS))

// Option B — fix the denominator (if true average across all OS is desired)
mediaPorOS: filtered.length > 0 ? lucroTotal / filtered.length : 0,
```

---

### WR-03: Option value parse via `split('-')` is fragile for negative years

**File:** `mp-react/src/pages/AdminPage.jsx:2063`

**Issue:** The option `value` string is `"${relMes}-${relAno}"` (e.g., `"1-2025"`). The parse is:

```js
const [m, a] = e.target.value.split('-').map(Number)
```

If the year were ever negative (e.g., `"1--2025"` or `"1-NaN"`), `split('-')` yields more than two elements and `a` silently becomes `NaN`. Subsequent calls to `agregarRelatorio(reports, NaN, NaN)` would return an empty `filtered` array (because `d.getFullYear() === NaN` is always `false`), producing a blank report with no error.

The option values are currently generated inline and are always positive integers, so this is a latent fragility rather than an active bug — but the parse should be hardened.

**Fix:**
```js
onChange={e => {
  const parts = e.target.value.split('-')
  const m = Number(parts[0])
  const a = Number(parts[1])
  if (!Number.isFinite(m) || !Number.isFinite(a)) return
  setRelMes(m)
  setRelAno(a)
  setRelDados(null)
}}
```

---

### WR-04: `total = dados.totalOS || 1` silently corrupts percentages when `totalOS === 0`

**File:** `mp-react/src/utils/relatorioMensalPdf.js:166`

**Issue:**
```js
const total = dados.totalOS || 1
Object.entries(dados.porStatus).forEach(([status, count]) => {
  const pct = `${((count / total) * 100).toFixed(1)}%`
  ...
})
```

When `totalOS === 0`, `porStatus` is an empty object so `Object.entries` iterates zero times — the guard is never actually exercised. This creates a false sense of safety: if `porStatus` somehow contains entries but `totalOS` is `0` (which cannot happen with the current aggregation logic, but could if `dados` were constructed externally or via a future refactor), percentages would be calculated as `count * 100%` instead of `Infinity%`, producing silently wrong data in the PDF.

**Fix:** Use an explicit guard:
```js
Object.entries(dados.porStatus).forEach(([status, count]) => {
  const pct = dados.totalOS > 0
    ? `${((count / dados.totalOS) * 100).toFixed(1)}%`
    : '—'
  tableRow(STATUS_LABELS[status] || status, String(count), pct, false)
})
```

---

## Info

### IN-01: `MESES_NOMES` constant re-declared inline in JSX IIFE on every render

**File:** `mp-react/src/pages/AdminPage.jsx:2070`

**Issue:** The month name array is declared inside the IIFE within the JSX, which means it is allocated on every render of the `relatorio` tab. This duplicates the `MESES` constant in `relatorioMensalPdf.js` (with correct accents in AdminPage vs. stripped accents in the utility), and the JSX version uses Portuguese accents (`Março`, `Fevereiro`) while the PDF version uses `Marco` — creating a visible inconsistency between the period selector and the PDF header.

**Fix:** Declare a module-level constant at the top of the component file (or import from a shared location) and reference it in JSX:

```js
// At module level, outside the component
const MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
```

---

### IN-02: `<select>` period picker has no accessible label

**File:** `mp-react/src/pages/AdminPage.jsx:2059`

**Issue:** The `<select>` element is preceded by a `<span className="filter-label">Período:</span>` but the two elements are not associated via `<label htmlFor>` or `aria-labelledby`. Screen readers will announce the select as an unlabelled control.

**Fix:**
```jsx
<label htmlFor="rel-periodo" className="filter-label">Período:</label>
<select
  id="rel-periodo"
  className="filter-input"
  value={`${relMes}-${relAno}`}
  onChange={...}
>
```

---

### IN-03: `nomeEmpresa` with emoji or non-Latin characters will produce garbled PDF footer text

**File:** `mp-react/src/utils/relatorioMensalPdf.js:199`

**Issue:** The sanitiser `s()` strips Portuguese accents but does not handle emoji, Arabic, Cyrillic, or other non-Latin characters. The footer calls:

```js
doc.text(`${s(nomeEmpresa || 'AssistHub')}  |  Relatorio gerado em ...`, ...)
```

jsPDF's built-in `helvetica` font does not include emoji or extended Unicode glyphs. If a company name contains such characters (e.g., `"Minha Empresa 🏢"`), jsPDF silently drops or substitutes unknown code points, producing corrupted footer text.

**Fix:** Add a fallback that removes any character outside the Basic Latin + Latin-1 Supplement block before passing to jsPDF:

```js
function s(v) {
  if (!v && v !== 0) return '—'
  return String(v)
    .replace(/[áàãâä]/g,'a').replace(/[ÁÀÃÂÄ]/g,'A')
    // ... existing replacements ...
    .replace(/[ç]/g,'c').replace(/[Ç]/g,'C')
    .replace(/[ñ]/g,'n').replace(/[Ñ]/g,'N')
    .replace(/[^\x20-\x7E]/g, '')  // strip non-ASCII after accent normalisation
}
```

---

_Reviewed: 2026-05-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
