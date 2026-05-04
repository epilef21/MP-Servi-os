# Phase 5: Compressão de Imagens no Orçamento — Research

**Researched:** 2026-05-04
**Domain:** browser-image-compression + Firebase Storage upload + React state/feedback
**Confidence:** HIGH

---

## Summary

Phase 5 adds image compression to `OrcamentoTecnicoPage.jsx` before uploading photos to Firebase Storage. The pattern is already proven in `FormPage.jsx`, but **it uses only the `uploadFoto` helper from `firebase.js`** — there is no compression in FormPage's current implementation either. Both files upload raw files.

The library `browser-image-compression` is mentioned in `docs/CLAUDE.md` as "instalado" but is **absent from `mp-react/package.json` and from `node_modules/`**. Installing it is Wave 0 work for this phase.

`OrcamentoTecnicoPage.jsx` currently has **no photo section at all** — no `<input type="file">`, no state for fotos, no upload call to Firebase Storage. The phase must add the entire photo capability from scratch, modeled on FormPage's section 6 (Fotos do Atendimento), and must integrate compression via `browser-image-compression` before the upload.

**Primary recommendation:** Install `browser-image-compression@2.0.2`, add a self-contained photo section (state + select handler with compression + preview grid + error message) to `OrcamentoTecnicoPage.jsx`, and call the existing `uploadFoto` helper from `firebase.js` inside `handleSubmit` after compression — exactly mirroring FormPage's photo block.

---

## Project Constraints (from CLAUDE.md)

The following directives from `docs/CLAUDE.md` apply to this phase:

- **Rule 3:** Imagens sempre comprimidas antes do upload — máx 400KB usando `browser-image-compression` [VERIFIED: docs/CLAUDE.md line 224-225]
- **Rule 7:** CSS: sempre usar variáveis CSS (`--primary`, `--accent`, etc.) — nunca hardcodar cores [VERIFIED: docs/CLAUDE.md line 236]
- **Rule 8:** Mobile first em todas as páginas públicas [VERIFIED: docs/CLAUDE.md line 238]
- **What not to do:** `❌ Não fazer upload de imagem sem compressão` [VERIFIED: docs/CLAUDE.md line 308]

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMG-01 | Técnico pode enviar fotos no orçamento comprimidas para máx 400KB antes do upload ao Storage | `browser-image-compression` with `maxSizeMB: 0.4` option directly enforces the limit |
| IMG-02 | Interface exibe feedback visual enquanto a compressão está em andamento | State variable `comprimindo: boolean` + CSS class `.foto-upload-progress` already exists in index.css |
| IMG-03 | Mensagem de erro amigável é exibida se a compressão falhar | `try/catch` around `imageCompression()` + inline error message using `var(--danger)` |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Image compression | Browser / Client | — | `browser-image-compression` runs entirely in the browser via Web Workers; no server involvement |
| Photo upload | Browser / Client → Firebase Storage | — | `uploadFoto()` in `firebase.js` calls Firebase Storage SDK directly from browser |
| Feedback state (`comprimindo`) | Browser / Client | — | Local React state; no server round-trip needed |
| Error display | Browser / Client | — | Local state + conditional JSX; purely presentational |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| browser-image-compression | 2.0.2 | Compress images client-side before upload | Only dependency required; already mandated by CLAUDE.md; pure browser, no server |
| firebase/storage (uploadBytes, getDownloadURL) | already installed (^12.12.0) | Upload compressed file to Firebase Storage | Already used via `uploadFoto` in firebase.js |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| URL.createObjectURL | browser native | Instant preview before compression | Used in FormPage pattern for previews |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| browser-image-compression | Canvas API resize | browser-image-compression handles EXIF rotation, progressive JPEG, quality tuning automatically; hand-rolling is an anti-pattern here |

**Installation (Wave 0 — required before any implementation):**
```bash
cd mp-react && npm install browser-image-compression@2.0.2
```

**Version verification:** `npm view browser-image-compression version` returned `2.0.2` [VERIFIED: npm registry, 2026-05-04]

---

## Architecture Patterns

### System Architecture Diagram

```
[User selects file(s)]
        |
        v
[handleFotoSelect]
   - URL.createObjectURL → preview state
   - setFotos([...existing, newFile])
        |
        v
[handleSubmit triggered]
        |
        v
[setComprimindo(true)]   ← IMG-02: feedback starts
        |
        v
[imageCompression(file, { maxSizeMB: 0.4, maxWidthOrHeight: 1920, useWebWorker: true })]
   try { compressed ← result }
   catch { setErroFoto('Não foi possível comprimir...'); setComprimindo(false); return }
        |
        v
[setComprimindo(false)]   ← IMG-02: feedback ends
        |
        v
[uploadFoto(compressed, empresaId, orcamentoId)]
        |
        v
[updateDoc with fotosUrls array]   ← Firebase Firestore
```

### Recommended Project Structure

No new files needed. All changes go into one existing file:

```
mp-react/src/
├── pages/
│   └── OrcamentoTecnicoPage.jsx   ← MODIFY: add photo section
└── (no new files)
```

### Pattern 1: browser-image-compression usage (from official docs)

**What:** Import and call `imageCompression(file, options)` — returns a Promise of compressed File/Blob.
**When to use:** Immediately before upload, inside the submit handler or a dedicated compression step.

```javascript
// Source: [CITED: https://github.com/Donaldcwl/browser-image-compression#readme]
import imageCompression from 'browser-image-compression'

const options = {
  maxSizeMB: 0.4,           // 400KB hard limit (IMG-01)
  maxWidthOrHeight: 1920,   // preserve reasonable resolution
  useWebWorker: true,       // non-blocking (IMG-02 — UI stays responsive)
}

try {
  const compressed = await imageCompression(file, options)
  // compressed is a File/Blob — pass directly to uploadFoto
} catch (err) {
  // IMG-03: show friendly error, do not crash
  setErroFoto('Não foi possível comprimir a imagem. Verifique o arquivo e tente novamente.')
}
```

### Pattern 2: FormPage photo state (VERIFIED: FormPage.jsx lines 120-123, 248-261, 289-304)

The reference pattern in FormPage uses three state variables:

```javascript
const [fotos,         setFotos]         = useState([])       // { file, preview }[]
const [fotosUrls,     setFotosUrls]     = useState([])       // uploaded URLs (pre-existing)
const [uploadingFoto, setUploadingFoto] = useState(false)    // feedback flag
```

`handleFotoSelect` adds `{ file, preview: URL.createObjectURL(f) }` objects. The submit handler iterates `fotos`, calls upload, and collects URLs.

For OrcamentoTecnicoPage, use the same shape but rename `uploadingFoto` → `comprimindo` to reflect that compression happens before upload (making the feedback text accurate: "Comprimindo fotos..." rather than "Enviando fotos...").

### Pattern 3: uploadFoto helper (VERIFIED: firebase.js lines 188-194)

```javascript
// Already exported from firebase.js — import directly:
// import { ..., uploadFoto } from '../firebase.js'

export async function uploadFoto(file, empresaId, osId) {
  const ext  = file.name.split('.').pop()
  const path = `empresas/${empresaId}/fotos/${osId}/${Date.now()}.${ext}`
  const ref  = storageRef(storage, path)
  await uploadBytes(ref, file)
  return getDownloadURL(ref)
}
```

Pass the **compressed** file (not the original) as the first argument.
Use `orcamentoId` (from `useParams()`) as the `osId` parameter — the storage path will correctly scope photos to the orçamento.

### Pattern 4: Feedback UI (VERIFIED: index.css lines 191, FormPage.jsx line 725)

The CSS class `.foto-upload-progress` already exists in `index.css`:

```css
.foto-upload-progress { font-size:.78rem; color:var(--muted); margin-top:8px; text-align:center; }
```

FormPage uses it like:
```jsx
{uploadingFoto && <p className="foto-upload-progress">⏳ Enviando fotos...</p>}
```

For OrcamentoTecnicoPage, adapt to:
```jsx
{comprimindo && <p className="foto-upload-progress">⏳ Comprimindo fotos...</p>}
```

### Pattern 5: Error display (VERIFIED: OrcamentoTecnicoPage.jsx diagnostic error pattern, lines 317-319)

OrcamentoTecnicoPage already has a precedent for inline field errors:

```jsx
{erros.diagnostico && (
  <span style={{ color:'var(--danger)', fontSize:'.78rem' }}>{erros.diagnostico}</span>
)}
```

For IMG-03, add a dedicated `erroFoto` state and display it the same way below the upload area.

### Anti-Patterns to Avoid

- **Compressing inside handleFotoSelect:** Compression is async and blocks UI. Do it inside handleSubmit where `setSalvando(true)` already gates the button. The user sees the preview instantly from `URL.createObjectURL(f.file)` on select, then sees the compression spinner on submit.
- **Compressing in Promise.all without per-file error isolation:** If one file fails, the whole batch fails. Accept this — show one error message for the batch (keeps complexity low for a 1-plan phase).
- **Using `resetMocks: true` or `restoreMocks: true`** in tests — project rule: `clearMocks: true` only (irrelevant to this non-test phase, noted for awareness).
- **Hardcoding colors** — always use CSS variables (`var(--danger)`, `var(--muted)`, etc.).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image compression to 400KB | Canvas drawImage + quality loop | browser-image-compression | Handles EXIF rotation, format detection, progressive reduction, memory management — dozens of edge cases |
| Firebase Storage upload | Custom fetch/XHR | uploadFoto() from firebase.js | Already handles multi-tenant path scoping, getDownloadURL |

**Key insight:** Custom canvas compression requires a quality-bisection loop, EXIF stripping, and format-aware encoding. browser-image-compression handles all of this and is the project-mandated solution.

---

## Critical Finding: Library Not Installed

`browser-image-compression` is **NOT present** in `mp-react/package.json` or `mp-react/node_modules/`. It appears in `docs/CLAUDE.md` under "DEPENDÊNCIAS PRINCIPAIS" as "instalado" but this is aspirational documentation, not current state. [VERIFIED: npm deps check 2026-05-04 — `package.json` has no entry; `node_modules/browser-image-compression` absent]

**Impact:** Wave 0 of plan 05-01 MUST include `npm install browser-image-compression@2.0.2` before any implementation task.

---

## OrcamentoTecnicoPage — Current State (What's Missing)

| Capability | FormPage.jsx has it? | OrcamentoTecnicoPage.jsx has it? |
|------------|---------------------|----------------------------------|
| `<input type="file" accept="image/*">` | Yes (line 718) | **No** |
| Photo state (`fotos`, `fotosUrls`) | Yes (lines 120-122) | **No** |
| Preview grid (`.foto-grid`) | Yes (lines 727-736) | **No** |
| `uploadFoto` import | Yes (line 10) | **No** |
| Feedback state (`uploadingFoto`) | Yes (line 123) | **No** |
| Upload call in submit | Yes (lines 289-304) | **No** |
| Compression (imageCompression) | **No** | **No** (this phase adds it to BOTH the select phase isn't needed; only compression on submit path) |

Note: FormPage itself does NOT compress — it uploads raw files. OrcamentoTecnicoPage will be the first page with actual compression applied.

---

## Exact Changes Required for OrcamentoTecnicoPage.jsx

### 1. Import additions (top of file)

```javascript
import imageCompression from 'browser-image-compression'
import { db, doc, getDoc, updateDoc, serverTimestamp, uploadFoto } from '../firebase.js'
//                                                                   ^^^^^^^^^^^ add uploadFoto
```

### 2. New state variables (near existing state declarations)

```javascript
const [fotos,      setFotos]      = useState([])    // { file, preview }[]
const [comprimindo,setComprimindo]= useState(false)  // IMG-02
const [erroFoto,   setErroFoto]   = useState('')     // IMG-03
```

### 3. New handler: handleFotoSelect

```javascript
function handleFotoSelect(e) {
  const files = Array.from(e.target.files)
  const novas = files.map(f => ({ file: f, preview: URL.createObjectURL(f) }))
  setFotos(p => [...p, ...novas])
  setErroFoto('')
  e.target.value = ''
}

function removerFoto(idx) {
  setFotos(p => {
    const n = [...p]
    URL.revokeObjectURL(n[idx].preview)
    n.splice(idx, 1)
    return n
  })
}
```

### 4. Compression + upload block in handleSubmit (before updateDoc call)

```javascript
let fotosUrls = []
if (fotos.length > 0) {
  setComprimindo(true)
  try {
    const opts = { maxSizeMB: 0.4, maxWidthOrHeight: 1920, useWebWorker: true }
    const compressed = await Promise.all(fotos.map(f => imageCompression(f.file, opts)))
    fotosUrls = await Promise.all(compressed.map(c => uploadFoto(c, empresaId, orcamentoId)))
  } catch (e) {
    setErroFoto('Não foi possível comprimir as imagens. Verifique os arquivos e tente novamente.')
    setComprimindo(false)
    setSalvando(false)
    return
  }
  setComprimindo(false)
}
```

Add `fotos: fotosUrls` to the `updateDoc` payload.

### 5. New JSX section (after Seção 6 — Observações, before Botão enviar)

```jsx
{/* Seção 7 — Fotos */}
<div className="orc-section-pub">
  <div className="orc-section-title">📷 Fotos do Atendimento</div>
  <label className="foto-upload-area">
    <input type="file" accept="image/*" multiple onChange={handleFotoSelect} />
    <div className="foto-upload-icon">📷</div>
    <div className="foto-upload-text">
      <strong>Toque para adicionar fotos</strong><br />
      Aceita múltiplas imagens • Máx 400KB por foto após compressão
    </div>
  </label>
  {comprimindo && <p className="foto-upload-progress">⏳ Comprimindo fotos...</p>}
  {erroFoto && (
    <p style={{ color: 'var(--danger)', fontSize: '.82rem', marginTop: 8 }}>{erroFoto}</p>
  )}
  {fotos.length > 0 && (
    <div className="foto-grid">
      {fotos.map((f, idx) => (
        <div key={idx} className="foto-thumb">
          <img src={f.preview} alt={`foto ${idx + 1}`} />
          <button className="foto-thumb-remove" onClick={() => removerFoto(idx)}>✕</button>
        </div>
      ))}
    </div>
  )}
</div>
```

---

## Common Pitfalls

### Pitfall 1: Library not installed

**What goes wrong:** `import imageCompression from 'browser-image-compression'` throws module resolution error at build time.
**Why it happens:** The library is documented as installed but is absent from `package.json` and `node_modules`.
**How to avoid:** Plan Wave 0 must run `npm install browser-image-compression@2.0.2` first.
**Warning signs:** Vite build error "Cannot find module 'browser-image-compression'".

### Pitfall 2: Passing original file instead of compressed file to uploadFoto

**What goes wrong:** IMG-01 is not satisfied — files larger than 400KB reach Firebase Storage.
**Why it happens:** Copy-paste from FormPage's upload block, which passes `f.file` (raw). Must pass the compressed output.
**How to avoid:** The compression step must assign the compressed result to a new variable (`compressed`) before passing to `uploadFoto`.

### Pitfall 3: Calling setSalvando(false) without calling setComprimindo(false) in the error path

**What goes wrong:** UI remains stuck showing "Comprimindo fotos..." indefinitely after an error.
**Why it happens:** Early `return` in catch block without resetting both state flags.
**How to avoid:** In the catch block, reset both `setComprimindo(false)` and `setSalvando(false)` before returning.

### Pitfall 4: uploadFoto called with wrong osId

**What goes wrong:** Photos are uploaded to a Storage path scoped to a wrong or missing ID.
**Why it happens:** `uploadFoto(file, empresaId, osId)` — the third parameter should be `orcamentoId` (from `useParams()`), not a new temp ID.
**How to avoid:** Pass `orcamentoId` directly — it is already available at the top of the component.

### Pitfall 5: Forgetting to add `fotos: fotosUrls` to the updateDoc payload

**What goes wrong:** Images are uploaded to Storage but the Firestore document has no reference to them; photos are orphaned.
**How to avoid:** The `updateDoc` call at the end of `handleSubmit` must include `fotos: fotosUrls` in the object.

### Pitfall 6: Inline style colors instead of CSS variables

**What goes wrong:** Violates CLAUDE.md rule 7; inconsistent theming.
**How to avoid:** Error text must use `style={{ color: 'var(--danger)' }}`, not `style={{ color: '#c0392b' }}` or any literal color.

---

## Code Examples

### Verified import and options

```javascript
// Source: [CITED: https://github.com/Donaldcwl/browser-image-compression#readme]
import imageCompression from 'browser-image-compression'

const options = {
  maxSizeMB: 0.4,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
}
const compressedFile = await imageCompression(originalFile, options)
// compressedFile.size will be <= 400 * 1024 bytes (400KB)
```

### Verified uploadFoto signature

```javascript
// Source: [VERIFIED: mp-react/src/firebase.js lines 188-194]
// uploadFoto(file, empresaId, osId) → Promise<string (download URL)>
const url = await uploadFoto(compressedFile, empresaId, orcamentoId)
```

### Verified CSS classes available (no new CSS needed)

```css
/* Source: [VERIFIED: mp-react/src/index.css] */
.foto-upload-area    /* dashed border upload zone */
.foto-upload-icon    /* emoji icon */
.foto-upload-text    /* descriptive text */
.foto-grid           /* thumbnail grid */
.foto-thumb          /* individual thumbnail container */
.foto-thumb-remove   /* X button overlay */
.foto-upload-progress /* muted feedback text */
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw file upload (FormPage current behavior) | Compressed file upload (this phase target) | Phase 5 | Files reliably <= 400KB before reaching Storage |

**Note:** FormPage itself does not compress — it is the reference for the photo UI pattern only, not the compression pattern. OrcamentoTecnicoPage will be the first page to use compression correctly.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `uploadFoto` from `firebase.js` accepts a compressed Blob/File object without modification | Code Examples | Low — File API guarantees Blob interface; uploadBytes accepts any Blob |
| A2 | Firestore `orcamentos/{orcamentoId}` document schema accepts a `fotos` array field | Changes Required | Low — Firestore is schemaless; any field can be added |

---

## Open Questions (RESOLVED)

1. **Should photos be optional or block submit if compression fails?**
   - RESOLVED: Block submit — catch block resets both `comprimindo` and `salvando` states then returns early, guiding the user to retry or remove the problematic file. If the user selected files, all must be processed or explicitly removed before submitting.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| browser-image-compression (npm) | IMG-01 | ✗ not installed | — | None — must install |
| Firebase Storage SDK | upload | ✓ (via firebase ^12.12.0) | ^12.12.0 | — |
| Node.js / npm | install step | ✓ | available in project | — |

**Missing dependencies with no fallback:**
- `browser-image-compression` — must be installed in Wave 0 before any implementation.

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: mp-react/src/pages/FormPage.jsx] — complete photo section pattern (state, handlers, JSX, upload call)
- [VERIFIED: mp-react/src/pages/OrcamentoTecnicoPage.jsx] — full file read; confirmed no existing photo section
- [VERIFIED: mp-react/src/firebase.js lines 188-194] — uploadFoto signature and multi-tenant path
- [VERIFIED: mp-react/src/index.css] — all .foto-* CSS classes confirmed present
- [VERIFIED: mp-react/package.json] — browser-image-compression confirmed absent
- [VERIFIED: npm registry `npm view browser-image-compression version`] — latest: 2.0.2

### Secondary (MEDIUM confidence)
- [CITED: https://github.com/Donaldcwl/browser-image-compression#readme] — `imageCompression(file, options)` API, `maxSizeMB` and `useWebWorker` options

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Library API (browser-image-compression): HIGH — official docs confirmed, version verified via npm
- Target file structure (OrcamentoTecnicoPage): HIGH — full file read, absence of photo section confirmed
- Reference pattern (FormPage): HIGH — full file read, exact lines documented
- CSS availability: HIGH — index.css read and all classes verified
- Library installation status: HIGH — package.json and node_modules both confirmed absent

**Research date:** 2026-05-04
**Valid until:** 2026-06-04 (stable libraries)
