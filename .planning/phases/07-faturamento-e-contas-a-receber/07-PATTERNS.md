# Phase 7: Faturamento e Contas a Receber - Pattern Map

**Mapped:** 2026-07-02
**Files analyzed:** 7 (5 canônicos do CONTEXT.md + 2 novos implícitos)
**Analogs found:** 7 / 7

## Achado crítico (ler antes de planejar)

`mp-react/src/components/admin/DetalheOSModal.jsx` **já tem** um sistema de "Tarifação" parcialmente implementado, com um ÚNICO código por OS:

- Campos gravados no doc da OS (`checklist/{osId}`): `fat_codigo`, `fat_valor_aprovado`, `fat_codigo_em`, `fat_item_id`, `fat_pontos`, `fat_km`, `fat_mo_manual`, `fat_lancado_em`.
- Fluxo em 3 passos já renderizado no modal (linhas 643-829): **1** calcular e copiar mensagem WhatsApp → **2** salvar código recebido da seguradora → **3** marcar como lançado no portal (grava só `fat_lancado_em`, sem seletor de nota/fatura).
- Já existe lógica de `codigoDigitos = seg === 'Allianz' || seg === 'Tempo' ? 2 : 8` (nota: o CONTEXT.md diz 2 dígitos para Allianz/Mondial e 8 para Mapfre — o código atual usa `'Tempo'` em vez de `'Mapfre'`/`'Mondial'` nessa checagem, o que já está desalinhado com a decisão nova; Tempo não tem código segundo o CONTEXT.md).

**Decisão da Fase 7 (CONTEXT.md, LOCKED):** Mapfre e Allianz/Mondial precisam de DOIS códigos por OS (mão de obra + deslocamento), cada um como item SEPARADO no checklist da fila. O campo único `fat_codigo`/`fat_valor_aprovado` atual não comporta isso.

**Implicação para o planner:** decidir entre (a) migrar `fat_codigo`/`fat_valor_aprovado` para um par `fat_codigo_mo`/`fat_valor_mo` + `fat_codigo_desloc`/`fat_valor_desloc` (mantendo `fat_lancado_em` → dois carimbos `fat_lancado_mo_em`/`fat_lancado_desloc_em`), ou (b) introduzir campos novos e aposentar os antigos. O padrão de código/UI (steps, `savingCodigo`, `marcarLancado`, `codigoDigitos`) é o analog direto a copiar — só a cardinalidade muda de 1 para 2 campos.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|----------------|
| `mp-react/src/components/admin/FinanceiroEmpresaTab.jsx` (nova aba interna "Faturamento") | component (tab container + sub-abas) | CRUD (Firestore subcollection) | próprias abas existentes no mesmo arquivo (`AbaDespesas`, `AbaImpostosFinanceiro`) | exact (mesmo arquivo, mesmo padrão) |
| `mp-react/src/components/admin/DetalheOSModal.jsx` (seção "Tarifação" — códigos MO/Deslocamento) | component (modal, seção financeira) | CRUD (update de doc único) | seção "Tarifação" já existente (linhas 46-294, 643-829) | exact (extensão do próprio padrão) |
| `mp-react/src/components/admin/ConfigTab.jsx` (calendários de pagamento por seguradora) | component (config form) | CRUD (merge em doc único `config`) | sub-aba "tarifas" (`tarifaForm`/`saveTarifas`, linhas 51-236, 372-450) | exact |
| `mp-react/src/contexts/AdminContext.jsx` | provider (leitura apenas) | request-response (distribuição de contexto) | já expõe `empresaId`, `reports`, `config`, `showToast`, `setReports` via `AdminPage.jsx` — nenhuma mudança estrutural esperada | exact (sem alteração) |
| `mp-react/src/utils/formatters.js` (possível nova função, ex. destaque de divergência de valor) | utility | transform | `fmtBRL`, `getLucro` (funções puras existentes) | exact |
| `mp-react/src/utils/faturamento.js` (NOVO — regras de calendário por seguradora, cálculo de data prevista, próximo dia útil) | utility / config | transform | `mp-react/src/utils/tarifas.js` (`getDeslocFaixas`, `calcDeslocamento`, tabelas por seguradora vindas de `config.tarifas`) | role-match forte |
| `mp-react/src/__tests__/faturamento.test.js` (NOVO — testes das funções puras de calendário) | test | transform | `mp-react/src/__tests__/formatters.test.js` | exact |

Observação: no padrão do projeto, sub-abas e modais NÃO viram arquivos próprios — são funções/componentes definidos dentro do próprio `FinanceiroEmpresaTab.jsx` (ex.: `function AbaDespesas(...)`, `function ModalLancamentoMensal(...)`). Uma futura "Aba Faturamento" e seus modais ("Fechar Nota") devem seguir essa mesma convenção, a menos que o arquivo fique grande demais (já tem 1465 linhas — avaliar extrair para `components/admin/faturamento/` se crescer muito).

---

## Pattern Assignments

### `FinanceiroEmpresaTab.jsx` — nova aba "📄 Faturamento" (component, CRUD)

**Analog:** o próprio arquivo — abas `despesas`/`impostos` e seus modais.

**Imports pattern** (linhas 1-20):
```javascript
import { useState, useEffect, useCallback } from 'react'
import {
  db,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from '../../firebase.js'
import { useAdminContext } from '../../contexts/AdminContext.jsx'
import { fmtBRL } from '../../utils/formatters.js'
```

**Estado inicial de formulário de modal** (linhas 79-95) — repetir esse padrão para o form de "Fechar Nota" (número da fatura + data de emissão):
```javascript
const FORM_DEDUCAO_INICIAL = {
  descricao: '', categoria: 'iss', valor: '', observacoes: '',
}
```

**Aba container + navegação por sub-abas** (linhas 98-140, 468-482):
```javascript
const [abaFin, setAbaFin] = useState('dre')
...
<div className="fin-tabs">
  {[
    { id: 'dre',          label: '📈 DRE Mensal'         },
    { id: 'despesas',     label: '💸 Despesas'            },
    { id: 'particulares', label: '🎨 Serv. Particulares'  },
    { id: 'impostos',     label: '🧾 Impostos e Fin.'     },
  ].map(t => (
    <button
      key={t.id}
      className={`fin-tab${abaFin === t.id ? ' active' : ''}`}
      onClick={() => setAbaFin(t.id)}
    >{t.label}</button>
  ))}
</div>
```
→ adicionar `{ id: 'faturamento', label: '📄 Faturamento' }` ao array e um bloco `{!carregando && abaFin === 'faturamento' && <AbaFaturamento .../>}` seguindo o padrão das linhas 491-538.

**Carga de dados do Firestore por subcoleção com filtro por mês** (linhas 142-190) — analog direto para carregar `notasFiscais` (filtradas por seguradora, não por mês):
```javascript
const recSnap = await getDocs(
  query(collection(db, `empresas/${empresaId}/despesasRecorrentes`), orderBy('criado_em', 'asc'))
)
const recorrentes = recSnap.docs.map(d => ({ id: d.id, ...d.data() }))
setDespesasRecorrentes(recorrentes)
```

**CRUD completo de uma subcoleção (criar/editar/excluir)** — analog canônico a copiar para `notasFiscais` (linhas 290-318, `salvarMensal`/`excluirMensal`):
```javascript
async function salvarMensal() {
  if (!formMensal.descricao.trim()) { showToast('Informe a descrição.', 'error'); return }
  setSalvandoMensal(true)
  try {
    const payload = {
      descricao:             formMensal.descricao.trim(),
      categoria:             formMensal.categoria,
      valor:                 parseFloat(formMensal.valor) || 0,
      mes_referencia:        mesRef,
      data_pagamento:        formMensal.data_pagamento || '',
      despesa_recorrente_id: formMensal.despesa_recorrente_id || '',
    }
    if (editandoMensal) {
      await updateDoc(doc(db, `empresas/${empresaId}/despesasMensais`, editandoMensal.id), payload)
    } else {
      await addDoc(collection(db, `empresas/${empresaId}/despesasMensais`), { ...payload, criado_em: serverTimestamp() })
    }
    setShowModalMensal(false)
    await carregarDados()
  } catch (e) { showToast('Erro ao salvar: ' + e.message, 'error') }
  finally { setSalvandoMensal(false) }
}
async function excluirMensal(l) {
  if (!window.confirm(`Excluir lançamento "${l.descricao}"?`)) return
  try {
    await deleteDoc(doc(db, `empresas/${empresaId}/despesasMensais`, l.id))
    await carregarDados()
  } catch (e) { showToast('Erro: ' + e.message, 'error') }
}
```

**Erro/loading pattern** — sempre `try/catch` com `showToast(msg, 'error')` no catch e `setSalvando*(false)` no finally; nunca deixa o erro subir sem toast.

**Render de modal condicional** (linhas 550-583) — analog para o modal "Fechar Nota":
```javascript
{showModalMensal && (
  <ModalLancamentoMensal
    form={formMensal} setForm={setFormMensal}
    salvando={salvandoMensal} editando={!!editandoMensal}
    mesRef={mesRef}
    onSalvar={salvarMensal} onFechar={() => setShowModalMensal(false)}
  />
)}
```

---

### `DetalheOSModal.jsx` — códigos de faturamento MO + Deslocamento (component, CRUD)

**Analog:** seção "Tarifação" já existente no próprio arquivo (linhas 46-51, 247-294, 643-829).

**Estado do form de código** (linhas 46-51):
```javascript
const [tarifForm,     setTarifForm]     = useState({ pontos: '1', km: '', moManual: '' })
const [codigoForm,    setCodigoForm]    = useState({ codigo: '', valor_aprovado: '' })
const [savingCodigo,  setSavingCodigo]  = useState(false)
const [savingLancado, setSavingLancado] = useState(false)
```

**Salvar código recebido → grava no doc da OS e sincroniza estado local + financeiro** (linhas 247-280) — copiar esse padrão duplicando para MO e Deslocamento:
```javascript
setSavingCodigo(true)
try {
  const valorAprov = parseFloat(codigoForm.valor_aprovado) || 0
  const payload    = {
    fat_codigo:         codigoForm.codigo.trim(),
    fat_valor_aprovado: valorAprov,
    fat_codigo_em:      serverTimestamp(),
    // Alimenta automaticamente o fechamento financeiro
    mo_seguradora:      valorAprov,
  }
  await atualizarOS(empresaId, selected.id, payload)
  const updated = { ...selected, ...payload }
  setReports(p => p.map(r => r.id === selected.id ? updated : r))
  setSelected(updated)
  showToast('🔑 Código salvo! Financeiro atualizado.')
} catch (e) { showToast('Erro: ' + e.message, 'error') }
finally { setSavingCodigo(false) }
```

**Marcar como lançado — grava um único timestamp** (linhas 283-294) — para a Fase 7, este é o analog do checkbox "lançado no portal" do checklist, mas terá que virar 2 timestamps (MO e Deslocamento) ou um por item da fila (se a fila for modelada como itens de subcoleção em vez de campos na OS):
```javascript
async function marcarLancado() {
  setSavingLancado(true)
  try {
    const payload = { fat_lancado_em: serverTimestamp() }
    await atualizarOS(empresaId, selected.id, payload)
    const updated = { ...selected, ...payload }
    setReports(p => p.map(r => r.id === selected.id ? updated : r))
    setSelected(updated)
    showToast(`✅ Lançado no portal ${selected.seguradora || ''}!`)
  } catch (e) { showToast('Erro: ' + e.message, 'error') }
  finally { setSavingLancado(false) }
}
```

**UI do passo "código recebido" com nº de dígitos dinâmico por seguradora** (linhas 761-801) — copiar e duplicar para MO/Deslocamento:
```javascript
const codigoDigitos = seg === 'Allianz' || seg === 'Tempo' ? 2 : 8
...
<div className="md-field">
  <label>Código ({codigoDigitos} dígitos)</label>
  <input
    value={codigoForm.codigo}
    onChange={e => setCodigoForm(p => ({ ...p, codigo: e.target.value }))}
    placeholder={'X'.repeat(codigoDigitos)}
    maxLength={codigoDigitos}
    style={{ fontFamily: 'monospace', fontSize: '1.05rem', fontWeight: 700, letterSpacing: 3 }}
  />
</div>
```
⚠️ Atenção: a condição atual usa `seg === 'Tempo'` para 2 dígitos — pelo CONTEXT.md (linhas 22-25) deveria ser `'Allianz'`/`'Mondial'` (2 dígitos) vs `'Mapfre'` (8 dígitos); Tempo/Maxpar não usam código algum. Corrigir essa condição faz parte do escopo da Fase 7.

**Botão de ação com estado desabilitado condicional** (linhas 817-826):
```javascript
<button
  disabled={savingLancado || !selected.fat_codigo}
  onClick={marcarLancado}
  title={!selected.fat_codigo ? 'Salve o código primeiro (passo 2)' : ''}
  style={{ background: !selected.fat_codigo ? '#aaa' : '#2d8a4e', ... }}
>
  {savingLancado ? '⏳ Salvando...' : `✅ Marcar como lançado no portal ${seg}`}
</button>
```

---

### `ConfigTab.jsx` — calendários de pagamento editáveis por seguradora (component, CRUD)

**Analog:** sub-aba "tarifas" (linhas 51-52, 124-135, 213-236, 372-450) — mesmo formato de "config editável por seguradora, mesclado num único doc `config`".

**Imports** (linhas 1-17):
```javascript
import {
  db, auth, storage,
  refConfig, refEmpresa,
  updateDoc, doc,
  storageRef, uploadBytes, getDownloadURL,
  PLANOS,
} from '../../firebase.js'
import { useAdminContext } from '../../contexts/AdminContext.jsx'
import { TABELAS, DESL_FAIXAS_PADRAO } from '../../utils/tarifas.js'
```

**Inicialização do form a partir do `config` salvo, com fallback para padrão** (linhas 124-133) — analog para inicializar `calendarioForm` a partir de `config.calendarioFaturamento` (ou nome equivalente) com fallback para as regras LOCKED do CONTEXT.md:
```javascript
const tf = {}
segs.forEach(seg => {
  const saved  = config?.tarifas?.[seg]?.deslocamento
  const def    = DESL_FAIXAS_PADRAO
  tf[seg] = {
    ate200km:   String(saved?.ate200km   ?? def.ate200km),
    acima200km: String(saved?.acima200km ?? def.acima200km),
  }
})
setTarifaForm(tf)
```

**Salvar mesclando com o que já existe (não sobrescrever outras seguradoras)** (linhas 213-236) — analog direto:
```javascript
async function saveTarifas() {
  if (!empresaId) return
  setSavingTarifa(true)
  try {
    const tarifasAtuais = config?.tarifas || {}
    const tarifas = { ...tarifasAtuais }
    Object.entries(tarifaForm).forEach(([seg, vals]) => {
      tarifas[seg] = {
        ...(tarifasAtuais[seg] || {}),
        deslocamento: {
          ate200km:   parseFloat(vals.ate200km)   || DESL_FAIXAS_PADRAO.ate200km,
          acima200km: parseFloat(vals.acima200km) || DESL_FAIXAS_PADRAO.acima200km,
        },
      }
    })
    await updateDoc(refConfig(empresaId), { tarifas })
    showToast('✅ Tarifas de deslocamento salvas!')
  } catch (e) {
    showToast('Erro ao salvar: ' + e.message, 'error')
  } finally {
    setSavingTarifa(false)
  }
}
```

**Sub-abas do ConfigTab** (linhas 250-260) — atenção: já existe uma sub-aba `configAba === 'calendario'` mas ela é sobre **Google Calendar** (integração de agenda), não sobre datas de pagamento. NÃO reaproveitar essa aba — criar uma nova sub-aba (ex. `'faturamento'`) ou uma seção dentro de `'tarifas'`:
```javascript
{[
  { id: 'empresa',    label: '🏢 Minha Empresa'  },
  { id: 'tarifas',    label: '🧾 Tarifas'         },
  { id: 'calendario', label: '📅 Calendário'      }, // ← já usado p/ Google Calendar, não confundir
  { id: 'conta',      label: '👤 Minha Conta'    },
].map(t => (
  <button key={t.id} className={`config-tab-btn${configAba === t.id ? ' active' : ''}`}
    onClick={() => setConfigAba(t.id)}>
```

---

### `utils/faturamento.js` (NOVO) — regras de calendário e cálculo de data prevista (utility, transform)

**Analog:** `mp-react/src/utils/tarifas.js` (arquivo inteiro, 140 linhas) — funções puras que recebem `config` + parâmetros e devolvem valores calculados, sem I/O.

**Padrão de "faixas com fallback para padrão"** (linhas 90-93 de `tarifas.js`):
```javascript
export function getDeslocFaixas(config, seguradora) {
  return config?.tarifas?.[seguradora]?.deslocamento || DESL_FAIXAS_PADRAO
}
```
→ copiar para `getRegrasFaturamento(config, seguradora)` retornando as faixas de data (Mapfre/Allianz/Mondial) com fallback para as regras LOCKED do CONTEXT.md quando `config` ainda não tiver sido customizado pelo admin.

**Padrão de função pura de cálculo** (linhas 96-100):
```javascript
export function calcDeslocamento(km, faixas) {
  if (!km || km <= 0) return 0
  const taxa = km <= 200 ? (faixas?.ate200km || 1.20) : (faixas?.acima200km || 1.80)
  return parseFloat((km * taxa).toFixed(2))
}
```
→ mesmo padrão para `calcularDataPrevista(seguradora, dataEmissao, regras)`, incluindo o ajuste para o próximo dia útil (fim de semana) e o aviso de "não faturável" no período 26-31 da Allianz (FAT-08).

**Tabelas de dados constantes exportadas por seguradora** (linhas 79-88):
```javascript
export const TABELAS = {
  Mapfre: TABELA_MAPFRE,
}
export const DESL_FAIXAS_PADRAO = {
  ate200km:   1.20,
  acima200km: 1.80,
}
```
→ mesmo formato para `REGRAS_FATURAMENTO_PADRAO = { Mapfre: {...}, Allianz: {...} }` (constantes LOCKED do CONTEXT.md, usadas como fallback antes de o admin editar em ConfigTab).

---

### `formatters.js` — possível formatter de divergência de valor (utility, transform)

**Analog:** `getLucro` (linhas 26-31) — função pura que recebe um objeto de OS e devolve um número/derivado, sem depender de estado React:
```javascript
export function getLucro(r) {
  const mos = parseFloat(r.mo_seguradora)      || 0
  const vpt = parseFloat(r.valor_prestador)    || 0
  const vds = parseFloat(r.valor_deslocamento) || 0
  return (mos || vpt || vds) ? (mos - vpt) + vds : null
}
```
→ mesmo padrão para uma função tipo `getDivergenciaFat(os)` que compara `fat_valor_mo` (ou aprovado) com o valor da OS e devolve a diferença (usada para destacar verde/vermelho conforme decisão LOCKED "Valores").

---

## Shared Patterns

### Firestore CRUD de subcoleção por empresa
**Source:** `FinanceiroEmpresaTab.jsx` linhas 142-190 (leitura) e 290-318 (escrita)
**Apply to:** qualquer nova subcoleção (`notasFiscais`, fila de faturamento se for modelada como subcoleção)
```javascript
const snap = await getDocs(
  query(collection(db, `empresas/${empresaId}/NOME_SUBCOLECAO`), where('campo', '==', valor))
)
setEstado(snap.docs.map(d => ({ id: d.id, ...d.data() })))
```

### Toast + try/catch em toda operação assíncrona
**Source:** repetido em todo `FinanceiroEmpresaTab.jsx`, `ConfigTab.jsx`, `DetalheOSModal.jsx`
**Apply to:** todos os handlers novos de salvar/excluir/marcar
```javascript
try {
  await operacaoFirestore(...)
  showToast('✅ Mensagem de sucesso!')
} catch (e) {
  showToast('Erro: ' + e.message, 'error')
} finally {
  setSalvando(false)
}
```

### Confirmação nativa antes de excluir
**Source:** `FinanceiroEmpresaTab.jsx` linha 260, 313, 365 — `window.confirm(...)`
**Apply to:** exclusão de nota fiscal / reversão de "lançado"

### Config mesclado em doc único, nunca sobrescrever seguradoras não editadas
**Source:** `ConfigTab.jsx` `saveTarifas` (linhas 213-236)
**Apply to:** salvar regras de calendário por seguradora em `config.calendarioFaturamento` (ou nome equivalente)

### Sincronizar `reports` local após update de OS (evita novo fetch)
**Source:** `DetalheOSModal.jsx` linhas 268-271, 288-290
**Apply to:** qualquer gravação de campo `fat_*` na OS
```javascript
await atualizarOS(empresaId, selected.id, payload)
const updated = { ...selected, ...payload }
setReports(p => p.map(r => r.id === selected.id ? updated : r))
setSelected(updated)
```

### Testes de funções puras (Vitest, sem mocks)
**Source:** `mp-react/src/__tests__/formatters.test.js` (linhas 1-60)
**Apply to:** `utils/faturamento.js` — nenhum `vi.mock` necessário, pois são funções puras
```javascript
import { describe, it, expect } from 'vitest'
import { fmtBRL } from '../utils/formatters'

describe('fmtBRL', () => {
  it('formata numero inteiro positivo', () => {
    expect(fmtBRL(100)).toBe('R$ 100,00')
  })
})
```

### Filtro em memória de `reports` (fila de faturamento)
**Source:** `OrdensServicoTab.jsx` linhas 1-25
**Apply to:** montar a fila automática de Tempo/Maxpar (OS finalizadas, agrupadas por seguradora)
```javascript
const filtered = useMemo(() => {
  return reports.filter(r =>
    r.seguradora === seguradoraAlvo &&
    r.status === 'concluido' /* ou status equivalente a "finalizada" */
  )
}, [reports, seguradoraAlvo])
```

---

## No Analog Found

| File/Conceito | Role | Data Flow | Motivo |
|------|------|-----------|--------|
| Coleção `empresas/{empresaId}/notasFiscais` (modelo de dados) | model | CRUD | Não existe conceito de "nota agrupando múltiplos itens com status derivado (aguardando/paga/atrasada)" em nenhuma subcoleção atual — as mais próximas (`despesasMensais`, `resultadoFinanceiroMensal`) são lançamentos individuais, não agregações com status calculado. Usar `despesasMensais` como ponto de partida estrutural (mesmo padrão de subcoleção + `mes_referencia`), mas o cálculo de status "atrasada" (derivado de `hoje > data_prevista`) precisa ser escrito do zero — é lógica nova, não uma cópia de padrão existente. |
| Checklist "lançado no portal" com progresso persistente entre sessões, por ITEM da fila (não por OS inteira) | component | event-driven / CRUD | O único checklist-like existente é o passo único `fat_lancado_em` no doc da OS (`DetalheOSModal.jsx`). Não há precedente de granularidade "por item dentro de uma fila" (MO separado de Deslocamento) — decisão de modelagem é do planner (Claude's Discretion no CONTEXT.md). |

---

## Metadata

**Analog search scope:** `mp-react/src/components/admin/`, `mp-react/src/contexts/`, `mp-react/src/utils/`, `mp-react/src/pages/AdminPage.jsx`, `mp-react/src/__tests__/`
**Files scanned:** FinanceiroEmpresaTab.jsx, DetalheOSModal.jsx, ConfigTab.jsx, AdminContext.jsx, formatters.js, formatters.test.js, tarifas.js, OrdensServicoTab.jsx, TecnicosTab.jsx, AdminPage.jsx, orcamentoFluxo.test.jsx, authContext.test.jsx
**Pattern extraction date:** 2026-07-02
