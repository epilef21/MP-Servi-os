---
phase: 05-compressao-imagens
reviewed: 2026-05-04T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - mp-react/package.json
  - mp-react/src/pages/OrcamentoTecnicoPage.jsx
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-05-04
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Phase 05 added browser-image-compression integration to `OrcamentoTecnicoPage.jsx`. The new code
introduces three states (`fotos`, `comprimindo`, `erroFoto`), two handlers (`handleFotoSelect`,
`removerFoto`), a compression/upload block inside `handleSubmit`, and Section 7 JSX.

The package dependency (`browser-image-compression ^2.0.2`) is correctly declared. The core
compression flow is structurally sound, but two critical defects were found: (1) the compressed
`Blob` returned by `browser-image-compression` has no `name` property, causing `uploadFoto` in
`firebase.js` to crash with an unhandled exception on every real upload; and (2) existing photos
already stored in Firestore are silently deleted on every re-submission because `fotosUrls` is
always rebuilt from the local `fotos` state, which is never pre-populated from `data.fotos` on
load. Three additional warnings cover memory leak exposure, unbounded file count, and a hidden
submit-button state inconsistency.

---

## Critical Issues

### CR-01: Compressed Blob has no `name` — `uploadFoto` crashes on every upload

**File:** `mp-react/src/pages/OrcamentoTecnicoPage.jsx:177` / `mp-react/src/firebase.js:189`

**Issue:** `imageCompression()` returns a `Blob` (or `File`-like object whose `name` property is
`undefined` in some runtime environments). `uploadFoto` in `firebase.js` calls
`file.name.split('.')` at line 189 to derive the file extension. When `file.name` is `undefined`,
`undefined.split` throws `TypeError: Cannot read properties of undefined (reading 'split')`.
This crash happens inside the `try/catch` in `handleSubmit`, so the catch block correctly aborts
the save — but `setComprimindo(false)` in the catch runs before `setSalvando(false)` at the
`finally` block of the *outer* try, meaning `setSalvando` is still `true` at the point the inner
catch shows the error message. More importantly, the upload always fails.

Proof path:
1. `handleFotoSelect` stores `{ file: File, preview: ... }` — original `File` object with a `.name`.
2. `imageCompression(f.file, opts)` on line 176 resolves to a `Blob` (MDN: "The return value is a
   Promise that resolves to a compressed image as a `Blob` object").
3. `uploadFoto(c, ...)` receives that `Blob`; `c.name` is `undefined`.
4. `file.name.split('.')` — `TypeError`.

**Fix:** Either (a) fix `uploadFoto` to accept a fallback name, or (b) explicitly reconstruct a
`File` after compression so the name is preserved:

```js
// In handleSubmit, replace line 176-177 with:
const comprimidas = await Promise.all(
  fotos.map(async f => {
    const blob = await imageCompression(f.file, opts)
    // Preserve original filename so uploadFoto can derive the extension
    return new File([blob], f.file.name, { type: blob.type })
  })
)
fotosUrls = await Promise.all(
  comprimidas.map(c => uploadFoto(c, empresaId, orcamentoId))
)
```

---

### CR-02: Existing photos are silently wiped on every re-submission

**File:** `mp-react/src/pages/OrcamentoTecnicoPage.jsx:204–214`

**Issue:** `fotos` state is always initialized to `[]` on mount (line 58) and is never populated
from `data.fotos` during the `carregar()` effect (lines 75–101). When the technician opens an
orçamento that already has `fotos: [url1, url2]` in Firestore and then submits the form (even
without adding any new photos), the `updateDoc` call at line 204 sets `fotos: []` — permanently
deleting all previously uploaded photo URLs from the record.

Additionally, even if the technician uploads new photos and the status transitions from
`aguardando_tecnico` to `em_revisao`, the guard at line 255 (`orc.status !== 'aguardando_tecnico'`)
will prevent re-entry, so this wipe scenario is limited to the first submission. However, if an
admin resets the status back to `aguardando_tecnico`, the technician's previously stored photos
are destroyed on next submission with no new photos selected.

**Fix:** Preserve existing URLs and append new ones:

```js
// In carregar(), after line 96, add:
if (data.fotos?.length) setFotosExistentes(data.fotos)  // new state for existing URLs

// Add new state:
const [fotosExistentes, setFotosExistentes] = useState([])

// In handleSubmit, merge:
fotosUrls = [...fotosExistentes, ...fotosUrls]

// In updateDoc payload:
fotos: fotosUrls,
```

---

## Warnings

### WR-01: `comprimindo` spinner shown but submit button not disabled during compression

**File:** `mp-react/src/pages/OrcamentoTecnicoPage.jsx:591–598`

**Issue:** The submit button is disabled only when `salvando` is true (line 594). `comprimindo`
is set to `true` at line 173 *before* the compression `await`, but `setSalvando(true)` is called
at line 169, so the button is correctly disabled during compression too — *however*, if the error
path in the inner `catch` (line 178) fires, `setComprimindo(false)` and `setSalvando(false)` are
called inside the inner `catch`, but `setSalvando(false)` is also in the outer `finally` (line
224). This means after a compression error the button will visually re-enable correctly, but
`setSalvando` is called twice (`false` inside catch at line 181, then `false` again at line 224 in
finally). This is not a crash but indicates fragile state management — if the finally block were
ever changed to set salvando to true, the double-call logic would break silently.

More concretely: if the network fails *after* compression succeeds but before `updateDoc`
completes, `setComprimindo` is already `false` but `setSalvando` remains `true` until the outer
`finally`. This means the UX shows no compression spinner but the button stays disabled — correct
behaviour but confusing if `comprimindo` were later tied to its own UI section. The state machine
needs unification.

**Fix:** Remove `setComprimindo(false)` and `setSalvando(false)` from the inner catch; let the
outer `finally` always reset `salvando`. Handle the foto-error display without early returns if
possible, or at minimum ensure the inner catch does not duplicate the `setSalvando(false)` already
in the outer `finally`:

```js
// inner catch — only set the foto error, then re-throw so outer finally runs:
} catch (e) {
  setErroFoto('Não foi possível comprimir as imagens. Verifique os arquivos e tente novamente.')
  setComprimindo(false)
  return   // setSalvando(false) handled by outer finally
}
// outer finally already calls setSalvando(false) — no duplicate needed
```

(Note: the current code returns before the outer try, so `setSalvando(false)` in the outer finally
never runs for the compression-error path — the inner catch calls it explicitly at line 181. This
is actually correct but fragile: the `setSalvando(false)` at line 181 is the *only* reset for that
path. If that line is deleted, the button stays permanently disabled after a compression failure.)

---

### WR-02: Object URL memory leak — previews never revoked when component unmounts

**File:** `mp-react/src/pages/OrcamentoTecnicoPage.jsx:149, 155–161`

**Issue:** `URL.createObjectURL(f)` is called for every selected file in `handleFotoSelect`
(line 149). `URL.revokeObjectURL` is called only when the user explicitly removes a photo via
`removerFoto` (line 158). If the component unmounts (user navigates away, closes the tab) while
`fotos` still contains items, all object URLs created for those previews are leaked for the
lifetime of the browser document. On mobile (the primary use case given "Toque para adicionar
fotos"), this can contribute to memory pressure.

**Fix:** Add a cleanup `useEffect` that revokes all outstanding object URLs on unmount:

```js
useEffect(() => {
  return () => {
    fotos.forEach(f => URL.revokeObjectURL(f.preview))
  }
}, [fotos])
```

---

### WR-03: No limit on the number of photos — unbounded upload cost and payload size

**File:** `mp-react/src/pages/OrcamentoTecnicoPage.jsx:147–153`

**Issue:** `handleFotoSelect` appends all selected files unconditionally. The `multiple` attribute
on the `<input>` (line 553) allows the user to select hundreds of files at once. Each file is
compressed and uploaded via `Promise.all` with no concurrency limit and no maximum count. This can
exhaust Firebase Storage write quotas, saturate mobile data, and cause the browser tab to OOM on
very large batches.

**Fix:** Enforce a maximum total photo count (e.g. 10) at the selection stage:

```js
function handleFotoSelect(e) {
  const MAX_FOTOS = 10
  const files = Array.from(e.target.files)
  const disponiveis = MAX_FOTOS - fotos.length
  if (disponiveis <= 0) {
    setErroFoto(`Máximo de ${MAX_FOTOS} fotos atingido.`)
    e.target.value = ''
    return
  }
  const selecionadas = files.slice(0, disponiveis)
  if (files.length > disponiveis) {
    setErroFoto(`Apenas ${disponiveis} foto(s) adicionada(s). Limite de ${MAX_FOTOS}.`)
  } else {
    setErroFoto('')
  }
  const novas = selecionadas.map(f => ({ file: f, preview: URL.createObjectURL(f) }))
  setFotos(prev => [...prev, ...novas])
  e.target.value = ''
}
```

---

## Info

### IN-01: `key={idx}` in photo thumbnail grid — unstable key after removal

**File:** `mp-react/src/pages/OrcamentoTecnicoPage.jsx:573`

**Issue:** Photos are rendered with `key={idx}` (array index). When `removerFoto(idx)` removes an
item from the middle of the array, React re-keys all subsequent thumbnails, potentially causing
incorrect img element reuse and stale `src` values between renders.

**Fix:** Use a stable key. The simplest approach is to add a unique `id` to each foto object at
creation time:

```js
// in handleFotoSelect:
const novas = files.map(f => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
  file: f,
  preview: URL.createObjectURL(f),
}))

// in JSX:
{fotos.map(f => (
  <div key={f.id} className="foto-thumb">
    ...
  </div>
))}
```

---

### IN-02: SUPERADMIN_EMAIL hardcoded in firebase.js — email exposed in bundle

**File:** `mp-react/src/firebase.js:85`

**Issue:** (Pre-existing, not introduced by phase 05, but surfaced during cross-file review.)

```js
export const SUPERADMIN_EMAIL = import.meta.env.VITE_SUPERADMIN_EMAIL || 'tvf23407@gmail.com'
```

The fallback value `'tvf23407@gmail.com'` is a real email address baked into the production
JavaScript bundle. Anyone who inspects the minified bundle can read it. The environment variable
approach is correct; the hardcoded fallback defeats that protection.

**Fix:** Remove the fallback and throw if the variable is absent, consistent with how
`VITE_FIREBASE_API_KEY` is treated:

```js
export const SUPERADMIN_EMAIL = import.meta.env.VITE_SUPERADMIN_EMAIL
if (!SUPERADMIN_EMAIL) {
  throw new Error('VITE_SUPERADMIN_EMAIL não configurado.')
}
```

---

_Reviewed: 2026-05-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
