# Phase 4: Fluxos Críticos — Research

**Researched:** 2026-05-19
**Domain:** Vitest 4.1.5 + RTL 16 — testes de componentes React com Firebase mockado
**Confidence:** HIGH (baseado em leitura direta do código-fonte existente e padrões já estabelecidos nas Phases 1-3)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**OS-01..06: Estratégia de Stub Component (AdminPage)**
- D-01: Nunca renderizar `AdminPage.jsx` nos testes
- D-02: Stub components mínimos diretamente no arquivo `osFluxo.test.jsx`
- D-03: `OSListaStub` chama `getOSdaEmpresa` no mount e renderiza resultados
- D-04: `window.confirm` mockado via `vi.spyOn(window, 'confirm').mockReturnValue(true)` + `vi.restoreAllMocks()` no afterEach
- D-05: `deleteDoc` no stub usará a versão mockada via `vi.mock('../firebase')`

**ORC-01..06: Renderizar Componentes Reais**
- D-06: `OrcamentoTecnicoPage.jsx` renderizado diretamente (~250 linhas — dentro do limite)
- D-07: `AprovarOrcamentoPage.jsx` renderizado diretamente, ambos via `FakeAuthProvider`
- D-08: `MemoryRouter` com `initialEntries={['/empresa-teste/orc-123']}` + `Route path="/:slug/:orcamentoId"`

**SignatureCanvas**
- D-09: Mock via `vi.mock('react-signature-canvas', ...)` com `forwardRef` + `useImperativeHandle`
- D-10: Canvas vazio simulado via `isEmpty: () => true` em override por teste

**Mocks adicionais**
- D-11: `browser-image-compression` → retorna Blob falso
- D-12: `validarUpload` → `vi.fn().mockResolvedValue(undefined)`
- D-13: `comprimirImagem` → retorna o mesmo arquivo sem transformação
- D-14: `uploadFoto` em `../firebase` → `mockResolvedValue('https://storage.example.com/foto.jpg')`

**Firebase (extensão Padrão C)**
- D-15: Adicionar ao mock: `deleteDoc`, `uploadFoto`, `serverTimestamp` (novo) — além dos já existentes
- D-16: Dois arquivos: `osFluxo.test.jsx` (OS-01..06) e `orcamentoFluxo.test.jsx` (ORC-01..06)

### Claude's Discretion
- Formato exato dos stub components (inline vs factory function)
- Conteúdo exato dos campos do `osForm` nos stubs
- Ordem dos `describe` blocks dentro de cada arquivo
- `userEvent.setup()` vs `userEvent` direto — preferir `userEvent.setup()`

### Deferred Ideas (OUT OF SCOPE)
- Testes de `excluirOrcamento` (AdminPage)
- Testes de `saveFin` (financeiro de OS)
- Testes de `handleReprovar` (reprovação de orçamento)
- Testes de geração de PDF
- Testes de upload real de fotos
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OS-01 | Admin pode criar OS via formulário | Stub OSFormStub chama `criarOS(empresaId, payload)` — mock retorna `{ id: 'os-novo' }` |
| OS-02 | Admin pode editar dados de OS existente | Stub OSEditStub chama `atualizarOS(empresaId, osId, atendForm)` |
| OS-03 | Admin pode alterar status de OS | Stub OSStatusStub chama `atualizarOS(empresaId, osId, { status: 'concluido' })` |
| OS-04 | Admin pode excluir OS e ela desaparece da lista | Stub OSExcluirStub chama `deleteDoc(doc(...))` após `window.confirm()` mockado |
| OS-05 | Lista de OS exibe estado vazio corretamente | OSListaStub com `getOSdaEmpresa` retornando `[]` — exibe mensagem de vazio |
| OS-06 | Lista de OS exibe conjunto retornado pelo Firebase | OSListaStub com `getOSdaEmpresa` retornando 2 itens — exibe ambos |
| ORC-01 | Técnico preenche formulário de orçamento com itens | Renderizar OrcamentoTecnicoPage com `getDoc` retornando orçamento `aguardando_tecnico` |
| ORC-02 | Técnico assina orçamento digitalmente antes de enviar | Mock SignatureCanvas com `isEmpty: () => false` e `onEnd` acionável |
| ORC-03 | Orçamento é salvo no Firestore com dados corretos | Verificar `updateDoc` chamado com `status: 'em_revisao'` e campos corretos |
| ORC-04 | Cliente visualiza orçamento na página de aprovação | Renderizar AprovarOrcamentoPage com `getDoc` retornando orçamento `enviado_cliente` |
| ORC-05 | Cliente aprova orçamento e assinatura é registrada | Preencher `nomeAssinar`, acionar `onEnd` no canvas, clicar "Aprovar e Assinar" |
| ORC-06 | Orçamento aprovado atualiza status no Firestore | Verificar `updateDoc` chamado com `status: 'aprovado'` e `assinatura_cliente` |
</phase_requirements>

---

## Summary

Esta fase adiciona testes de comportamento para os dois fluxos de negócio mais críticos do AssistHub: CRUD de Ordens de Serviço (OS-01..06) e o ciclo técnico-cliente de orçamentos (ORC-01..06). Os padrões de mock e infraestrutura foram completamente estabelecidos nas Phases 1-3 — o Padrão C (`vi.mock('../firebase', () => ({...}))` inline + imports depois) funciona corretamente com `clearMocks: true`.

O desafio central desta fase é que OS-01..06 não podem renderizar o `AdminPage.jsx` (3264 linhas). A solução aprovada pelo usuário são stub components mínimos no próprio arquivo de teste que replicam apenas a lógica do handler relevante. Esses stubs se baseiam diretamente nas funções reais (`criarOS`, `atualizarOS`, `deleteDoc`) que já estão nos mocks.

Para ORC-01..06 os componentes reais podem ser renderizados, mas exigem preparação cuidadosa: `getDoc` precisa retornar um snapshot válido que faça `loadingOrc` chegar a `false` e `orc` ter os dados corretos. O `useEmpresa` requer slug na URL via `MemoryRouter` + `Routes` + `Route path="/:slug/:orcamentoId"`. A `SignatureCanvas` deve ser mockada inteiramente com `forwardRef` + `useImperativeHandle`.

**Recomendação principal:** Usar `userEvent.setup()` (não `userEvent` direto) para todos os cliques e digitação — padrão RTL 16 recomendado. Usar `waitFor` para aguardar estado assíncrono após eventos que disparam promises (handleSubmit, handleAprovar).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Criar/editar/excluir OS | Stub component no teste | Firebase mock | AdminPage não pode ser renderizado — stub isola o handler |
| Listar OS | Stub component no teste | `getOSdaEmpresa` mock | Mesmo motivo — simula mount e fetch |
| Preencher orçamento técnico | OrcamentoTecnicoPage (componente real) | Firebase mock + mocks de imagem | Componente tem ~250 linhas, renderizável diretamente |
| Aprovar orçamento (cliente) | AprovarOrcamentoPage (componente real) | Firebase mock + SignatureCanvas mock | Componente real; SignatureCanvas requer forwardRef mock |
| Resolução de empresa | useEmpresa hook + MemoryRouter | `getEmpresaBySlug` / `getConfigEmpresa` mocks | Hook usa `useParams` — requer Routes com path parametrizado |

---

## Standard Stack

### Core (já instalado — verificado em package.json)

| Biblioteca | Versão instalada | Papel nos testes |
|-----------|-----------------|-----------------|
| vitest | ^4.1.5 | Runner, vi.mock, vi.spyOn, vi.fn |
| @testing-library/react | ^16.3.2 | render, screen, waitFor, act, renderHook |
| @testing-library/user-event | ^14.6.1 | userEvent.setup(), click, type |
| @testing-library/jest-dom | ^6.9.1 | toBeInTheDocument, toHaveBeenCalledWith |
| jsdom | ^25.0.1 | Ambiente DOM para Vitest |
| react-signature-canvas | ^1.1.0-alpha.2 | Precisa ser mockado completamente |
| browser-image-compression | ^2.0.2 | Precisa ser mockado |

[VERIFIED: package.json lido diretamente]

### Infraestrutura já existente

| Arquivo | O que fornece |
|---------|--------------|
| `src/test-utils/renderWithProviders.jsx` | FakeAuthProvider + MemoryRouter com route e authOverrides |
| `src/test-utils/mockFirebase.js` | createFirebaseMocks() com todos os vi.fn básicos |
| `src/test-utils/setupTests.js` | jest-dom + cleanup afterEach |
| `vitest.config.js` | globals: true, jsdom, clearMocks: true |
| `.env.test` | Stubs VITE_FIREBASE_* para evitar erro de avaliação de módulo |

[VERIFIED: todos os arquivos lidos diretamente]

---

## Architecture Patterns

### Diagrama de dados: OS-01..06 (Stub Component)

```
Arquivo de teste (osFluxo.test.jsx)
  |
  ├── vi.mock('../firebase', () => ({...}))   ← Padrão C — topo do arquivo
  |     - criarOS, atualizarOS, deleteDoc, doc, db (todos vi.fn)
  |     - getOSdaEmpresa: vi.fn().mockResolvedValue([])
  |
  ├── Stub Component (inline no teste)
  |     - Replica apenas a lógica do handler relevante
  |     - Chama funções Firebase mockadas
  |     - Expõe botão ou estado via DOM para assertivas
  |
  └── describe('OS-XX: ...', () => {
        beforeEach: configura mockImplementation se necessário
        it: render stub, userEvent.click, waitFor, expect
      })
```

### Diagrama de dados: ORC-01..06 (Componente real)

```
Arquivo de teste (orcamentoFluxo.test.jsx)
  |
  ├── vi.mock('../firebase', ...) — inclui getDoc, updateDoc, uploadFoto, serverTimestamp
  ├── vi.mock('react-signature-canvas', ...) — forwardRef com toDataURL/isEmpty/clear
  ├── vi.mock('browser-image-compression', ...)
  ├── vi.mock('../utils/validarUpload', ...)
  ├── vi.mock('../utils/comprimirImagem', ...)
  |
  ├── Wrapper de rota:
  |     MemoryRouter initialEntries={['/empresa-teste/orc-123']}
  |       Routes > Route path="/:slug/:orcamentoId"
  |         element={<OrcamentoTecnicoPage />} (ou AprovarOrcamentoPage)
  |
  ├── Precondição de getDoc:
  |     getDoc.mockResolvedValue({
  |       exists: () => true,
  |       id: 'orc-123',
  |       data: () => ({ status: 'aguardando_tecnico', nome_cliente: 'João', ... })
  |     })
  |
  ├── useEmpresa resolve internamente via getEmpresaBySlug mockado
  |     → retorna empresaId: 'emp-test-1'
  |     → remove loadingEmpresa (false após await)
  |
  └── Sequência de waitFor:
        1. waitFor(() => expect(screen.getByText('...')).toBeInTheDocument())
           — confirma que loadingEmpresa + loadingOrc chegaram a false
        2. userEvent: type no campo, click no botão
        3. waitFor(() => expect(updateDoc).toHaveBeenCalledWith(...))
```

### Padrão C — vi.mock com imports depois (OBRIGATÓRIO)

Já estabelecido na Phase 3. Regra crítica: **todos os `import` de funções Firebase devem vir DEPOIS do bloco `vi.mock`**.

```javascript
// CORRETO — Padrão C
vi.mock('../firebase', () => ({
  auth: {}, db: {},
  doc: vi.fn(() => 'mock-ref'),
  getDoc: vi.fn(),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  serverTimestamp: vi.fn().mockReturnValue({ seconds: 1000000 }),
  uploadFoto: vi.fn().mockResolvedValue('https://storage.example.com/foto.jpg'),
  criarOS: vi.fn(),
  atualizarOS: vi.fn().mockResolvedValue(undefined),
  getOSdaEmpresa: vi.fn().mockResolvedValue([]),
  getEmpresaBySlug: vi.fn().mockResolvedValue(null),
  getConfigEmpresa: vi.fn().mockResolvedValue({}),
  PLANOS: { basico: { limiteOS: 50, preco: 97 } },
  SUPERADMIN_EMAIL: 'superadmin@test.com',
  onAuthStateChanged: vi.fn((auth, cb) => { cb(null); return () => {} }),
}))

// DEPOIS do vi.mock:
import { criarOS, atualizarOS, getOSdaEmpresa, getDoc, updateDoc, deleteDoc } from '../firebase'
```

[VERIFIED: padrão lido diretamente de authContext.test.jsx e rotasEmpresa.test.jsx]

### Stub Component para OS (padrão para OS-01..06)

```jsx
// Stub mínimo para OS-01 (criar OS)
function OSFormStub({ empresaId }) {
  const [criado, setCriado] = React.useState(null)
  async function handleSave() {
    const payload = {
      seguradora: 'Mapfre', num_assist: 'OS-001',
      nome_segurado: 'João Silva', tel_segurado: '11999990000',
      endereco: 'Rua Teste, 10', cidade: 'São Paulo',
      servico: 'Instalação', status: 'aguardando_tecnico',
    }
    const ref = await criarOS(empresaId, payload)
    setCriado(ref.id)
  }
  return (
    <div>
      <button onClick={handleSave}>Criar OS</button>
      {criado && <span data-testid="os-criada">{criado}</span>}
    </div>
  )
}
```

[ASSUMED: estrutura baseada no código de saveOs lido no AdminPage.jsx linhas 380-424. Campos mínimos suficientes para cobrir o requisito]

### Stub Component para OS-04 (excluir — com window.confirm)

```jsx
function OSExcluirStub({ empresaId, os, onExcluida }) {
  async function handleExcluir() {
    if (!window.confirm(`Excluir OS?`)) return
    await deleteDoc(doc(db, `empresas/${empresaId}/checklist`, os.id))
    onExcluida(os.id)
  }
  return <button onClick={handleExcluir}>Excluir</button>
}
```

No teste:
```javascript
const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
// ... renderizar e clicar
afterEach(() => vi.restoreAllMocks())
```

[VERIFIED: padrão de excluirOS lido no AdminPage.jsx linha 357-367]

### Stub Component para OS-05/06 (lista)

```jsx
function OSListaStub({ empresaId }) {
  const [lista, setLista] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  React.useEffect(() => {
    getOSdaEmpresa(empresaId).then(dados => {
      setLista(dados)
      setLoading(false)
    })
  }, [empresaId])
  if (loading) return <p>Carregando...</p>
  if (!lista.length) return <p data-testid="vazio">Nenhuma OS encontrada</p>
  return (
    <ul>
      {lista.map(os => <li key={os.id} data-testid="item-os">{os.nome_segurado}</li>)}
    </ul>
  )
}
```

[VERIFIED: lógica baseada em getOSdaEmpresa lida em firebase.js linha 129-133]

### Wrapper de rota para OrcamentoTecnicoPage / AprovarOrcamentoPage

Ambos os componentes usam `useParams()` para `{ slug, orcamentoId }`. O `useEmpresa` internamente lê `slug` via `useParams`. O wrapper de rota é obrigatório:

```jsx
function renderOrcamento(Component, { getDocRetorno, getEmpresaRetorno = null }) {
  const empresa = getEmpresaRetorno ?? { id: 'emp-test-1', nome: 'Empresa Teste', slug: 'empresa-teste', ativo: true, plano: 'basico' }
  getEmpresaBySlug.mockResolvedValue(empresa)
  getConfigEmpresa.mockResolvedValue({ nome: 'Empresa Teste' })
  getDoc.mockResolvedValue(getDocRetorno)

  return render(
    <MemoryRouter initialEntries={['/empresa-teste/orc-123']}>
      <Routes>
        <Route path="/:slug/:orcamentoId" element={<Component />} />
      </Routes>
    </MemoryRouter>
  )
}
```

[VERIFIED: padrão derivado do wrapper de rotasEmpresa.test.jsx + leitura direta de OrcamentoTecnicoPage.jsx e AprovarOrcamentoPage.jsx]

### Mock de SignatureCanvas (completo)

```jsx
vi.mock('react-signature-canvas', () => ({
  default: React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      toDataURL: () => 'data:image/png;base64,ASSINATURA',
      isEmpty: () => false,
      clear: vi.fn(),
    }))
    // Exposição do onEnd para testes que precisam simular assinatura
    return (
      <canvas
        data-testid="assinatura"
        onClick={() => props.onEnd?.()}
      />
    )
  })
}))
```

**Detalhe crítico:** O componente real `AprovarOrcamentoPage` aciona `setHasSig(true)` dentro de `onEnd` prop do `SignatureCanvas`. O mock precisa chamar `props.onEnd?.()` quando o usuário "interage" com o canvas (ex: click no teste). Sem isso, `hasSig` permanece `false` e a validação de `handleAprovar` bloqueia o submit.

[VERIFIED: lógica de onEnd lida diretamente em AprovarOrcamentoPage.jsx linha 425-426]

### Sequência de resolução de useEmpresa nos testes de ORC

O `useEmpresa` executa dois awaits sequenciais:
1. `getEmpresaBySlug(slug)` — deve retornar objeto empresa com `id`
2. `getConfigEmpresa(empresaId)` — deve retornar objeto config

Depois disso, `loading` passa para `false` e `empresaId` fica disponível. Somente então o segundo `useEffect` da página (que carrega o orçamento com `getDoc`) é disparado.

Ordem de resolução assíncrona:
```
mount → useEmpresa.useEffect disparado
  → await getEmpresaBySlug → empresaId disponível
  → loading: false
  → componente re-renderiza
  → useEffect de carregarOrc disparado (porque empresaId agora é truthy)
  → await getDoc → orc disponível
  → loadingOrc: false
  → componente renderiza o formulário
```

Nos testes, usar `waitFor` para aguardar o estado final:
```javascript
await waitFor(() => {
  expect(screen.getByText('Diagnóstico Técnico')).toBeInTheDocument()
})
```

[VERIFIED: fluxo lido diretamente em OrcamentoTecnicoPage.jsx linhas 75-108 e AprovarOrcamentoPage.jsx linhas 70-86]

### clearMocks: true — comportamento crítico

`clearMocks: true` no vitest.config.js limpa:
- Call counts: `mock.calls` resetado
- Return values de chamadas anteriores: `mock.results` resetado

`clearMocks: true` NÃO limpa:
- `mockImplementation()` — persiste entre testes dentro do mesmo arquivo
- `mockResolvedValue()` definido no `vi.mock()` inicial — persiste

Consequência: `mockImplementation()` definido por teste deve ser redefinido ou o mock do topo do arquivo é suficiente. Para `getDoc`, que precisa de retornos diferentes por teste, usar `getDoc.mockResolvedValue(...)` no próprio `it` ou no `beforeEach` do `describe`.

[VERIFIED: vitest.config.js lido diretamente + confirmado pelo padrão em authContext.test.jsx]

### userEvent — padrão RTL 16

```javascript
// CORRETO — RTL 16 recomenda setup()
const user = userEvent.setup()
await user.click(screen.getByRole('button', { name: /Criar OS/ }))
await user.type(screen.getByPlaceholderText('...'), 'texto')

// EVITAR — userEvent sem setup (funciona mas não é recomendado em RTL 16)
await userEvent.click(button)
```

[ASSUMED: baseado em conhecimento de @testing-library/user-event v14 docs. A versão 14.6.1 instalada mantém `userEvent.setup()` como API principal]

### waitFor vs act()

Usar `waitFor` quando:
- Aguardando estado que muda após uma Promise resolver (handleSubmit, getOSdaEmpresa)
- Aguardando que um `useEffect` dispare e termine após mount

Usar `act()` quando:
- Disparando interações síncronas que causam atualizações de estado React (raro em RTL 16 — userEvent já envolve em act)

```javascript
// Aguardar componente carregar (useEmpresa + getDoc resolvendo)
await waitFor(() => {
  expect(screen.queryByText('Carregando...')).not.toBeInTheDocument()
})

// Aguardar resultado de handleSubmit (updateDoc chamado)
await userEvent.click(screen.getByText('Enviar para Revisão'))
await waitFor(() => {
  expect(updateDoc).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ status: 'em_revisao' })
  )
})
```

[ASSUMED: padrão baseado nos testes existentes em authContext.test.jsx que usam waitFor com sucesso]

---

## Don't Hand-Roll

| Problema | Não construir | Usar em vez disso | Por quê |
|---------|--------------|-------------------|---------|
| Renderização com contexto de auth | Wrapper manual AuthContext.Provider em cada teste | `renderWithProviders()` do test-utils | Já existe, já testado, padronizado |
| Mock de Firebase | vi.fn() avulsos no beforeEach | Padrão C: vi.mock inline + imports depois | Garante que Vitest substitui o módulo antes de qualquer import |
| Simulação de assinatura | `sigRef.current = { toDataURL: () => '...' }` direto | `vi.mock('react-signature-canvas', ...)` com forwardRef | O mock precisa ser injetado antes do import do componente |
| Wrapper de rota com params | MemoryRouter avulso sem Routes | `MemoryRouter > Routes > Route path="/:slug/:orcamentoId"` | `useParams()` retorna objeto vazio sem a rota parametrizada |
| Limpar cache de useEmpresa | Object.keys(cache).forEach manualmente | `_clearCacheForTest()` já exportado de useEmpresa.js | Já testado e funcional na Phase 3 |

---

## Common Pitfalls

### Pitfall 1: getDoc retornando shape errado

**O que vai errado:** `getDoc.mockResolvedValue({})` — o componente chama `snap.exists()` e `snap.data()`. Um objeto vazio não tem esses métodos → TypeError.

**Como evitar:**
```javascript
getDoc.mockResolvedValue({
  exists: () => true,
  id: 'orc-123',
  data: () => ({
    status: 'aguardando_tecnico',
    nome_cliente: 'João',
    tel_cliente: '11999990000',
    endereco: 'Rua Teste',
    cidade: 'São Paulo',
    itens: [],
    // tipo precisa ser definido — validar() checa orc.tipo === 'linha_branca'
    tipo: 'eletrico',
  })
})
```

[VERIFIED: lógica de `snap.exists()` e `snap.data()` lida em OrcamentoTecnicoPage.jsx linha 85-90 e AprovarOrcamentoPage.jsx linha 77-78]

### Pitfall 2: loadingEmpresa nunca resolve — componente não renderiza

**O que vai errado:** `getEmpresaBySlug` retorna `null` por padrão no mock global. O `useEmpresa` navega para `/empresa-nao-encontrada` quando recebe `null` — o componente fica em tela de loading ou redireciona antes de renderizar o formulário.

**Como evitar:** Antes de qualquer teste ORC, configurar:
```javascript
getEmpresaBySlug.mockResolvedValue({
  id: 'emp-test-1', nome: 'Empresa Teste', slug: 'empresa-teste', ativo: true, plano: 'basico'
})
getConfigEmpresa.mockResolvedValue({ nome: 'Empresa Teste' })
```

[VERIFIED: lógica de retorno null lida em useEmpresa.js linhas 43-49]

### Pitfall 3: hasSig permanece false — handleAprovar bloqueado

**O que vai errado:** O mock de `SignatureCanvas` não chama `props.onEnd()`. O `hasSig` permanece `false`. Clicar em "Aprovar" mostra "Assine para confirmar" em vez de chamar `updateDoc`.

**Como evitar:** O mock do canvas deve chamar `props.onEnd?.()` em algum evento do elemento renderizado (ex: onClick do `<canvas>`), e o teste deve fazer `userEvent.click(screen.getByTestId('assinatura'))` antes de clicar em Aprovar.

[VERIFIED: fluxo lido em AprovarOrcamentoPage.jsx linhas 421-426 e handleAprovar linhas 89-93]

### Pitfall 4: criarOS não está no vi.mock — TypeError no stub

**O que vai errado:** O vi.mock do arquivo de teste não inclui `criarOS` (função helper, não operação Firestore básica). O stub chama `criarOS(empresaId, payload)` e recebe `undefined is not a function`.

**Como evitar:** O mock inline deve incluir explicitamente:
```javascript
criarOS: vi.fn().mockResolvedValue({ id: 'os-nova-123' }),
atualizarOS: vi.fn().mockResolvedValue(undefined),
getOSdaEmpresa: vi.fn().mockResolvedValue([]),
```

[VERIFIED: criarOS é uma função helper exportada de firebase.js linha 136 — não é uma função primitiva do Firestore SDK]

### Pitfall 5: doc() retornando undefined — deleteDoc falha silenciosamente

**O que vai errado:** `doc` mockado como `vi.fn()` sem retorno → retorna `undefined`. `deleteDoc(undefined)` pode não lançar erro mas também não verifica o caminho correto.

**Como evitar:**
```javascript
doc: vi.fn((db, ...path) => `mock-ref:${path.join('/')}`)
```
Assim `deleteDoc` recebe uma string descritiva e `toHaveBeenCalledWith` pode verificar o caminho correto.

[ASSUMED: baseado em padrão observado em rotasEmpresa.test.jsx onde `doc: vi.fn(() => 'mock-doc-ref')`]

### Pitfall 6: Teste ORC não usa _clearCacheForTest — cache vaza entre testes

**O que vai errado:** Segundo teste ORC usa empresa diferente mas o cache do useEmpresa ainda tem `empresa-teste` do primeiro teste. `getEmpresaBySlug` não é chamado para o segundo slug.

**Como evitar:** Importar e chamar `_clearCacheForTest()` no `beforeEach` de todo arquivo que renderiza componentes com `useEmpresa`:
```javascript
import { _clearCacheForTest } from '../hooks/useEmpresa'
beforeEach(() => { _clearCacheForTest() })
```

[VERIFIED: padrão estabelecido em Phase 3 — rotasEmpresa.test.jsx linha 139-141]

### Pitfall 7: window.confirm não restaurado — vaza para próximos testes

**O que vai errado:** `vi.spyOn(window, 'confirm').mockReturnValue(true)` aplicado no `beforeEach` sem `vi.restoreAllMocks()` no `afterEach`. Com `clearMocks: true`, os call counts são limpos mas o spy ainda substitui `window.confirm`. Testes seguintes que dependem de `window.confirm` real ficam com retorno `true`.

**Como evitar:**
```javascript
describe('OS-04: excluir OS', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })
  // testes...
})
```

[VERIFIED: comportamento do clearMocks confirmado no vitest.config.js + padrão D-04 do CONTEXT.md]

---

## Code Examples

### Verificar updateDoc chamado com campos corretos

```javascript
// Após userEvent.click no botão de submit
await waitFor(() => {
  expect(updateDoc).toHaveBeenCalledWith(
    expect.anything(),  // ref do documento
    expect.objectContaining({
      status: 'em_revisao',
      diagnostico: expect.any(String),
    })
  )
})
```

[VERIFIED: campos de updateDoc lidos em OrcamentoTecnicoPage.jsx linhas 232-246]

### Mock de criarOS retornando ID para verificar OS-01

```javascript
criarOS.mockResolvedValue({ id: 'os-nova-123' })

// Renderizar stub e clicar
render(<OSFormStub empresaId="emp-test-1" />)
const user = userEvent.setup()
await user.click(screen.getByText('Criar OS'))

await waitFor(() => {
  expect(criarOS).toHaveBeenCalledWith(
    'emp-test-1',
    expect.objectContaining({
      seguradora: 'Mapfre',
      status: 'aguardando_tecnico',
    })
  )
})
```

[VERIFIED: payload de criarOS lido em AdminPage.jsx linhas 401-413]

### Testar estado vazio da lista (OS-05)

```javascript
getOSdaEmpresa.mockResolvedValue([])

render(
  <MemoryRouter>
    <OSListaStub empresaId="emp-test-1" />
  </MemoryRouter>
)

await waitFor(() => {
  expect(screen.getByTestId('vazio')).toBeInTheDocument()
})
```

### Fluxo completo de aprovação ORC-05/06

```javascript
// Precondição: orçamento enviado_cliente
getDoc.mockResolvedValue({
  exists: () => true,
  id: 'orc-123',
  data: () => ({
    status: 'enviado_cliente',
    nome_cliente: 'Maria Santos',
    itens: [{ id: 'i1', descricao: 'Serviço', quantidade: 1, valor_unit: 100, valor_total: 100, paga_cliente: 100 }],
    total_geral: 100,
  })
})

renderOrcamento(AprovarOrcamentoPage, { getDocRetorno: /* acima */ })

// Aguardar carregamento completo
await waitFor(() => {
  expect(screen.getByText('Aprovação')).toBeInTheDocument()
})

const user = userEvent.setup()

// Preencher nome
await user.type(screen.getByPlaceholderText('Digite seu nome completo'), 'Maria Santos')

// Simular assinatura (dispara onEnd do mock)
await user.click(screen.getByTestId('assinatura'))

// Clicar em aprovar
await user.click(screen.getByText('Aprovar e Assinar'))

await waitFor(() => {
  expect(updateDoc).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      status: 'aprovado',
      aprovado_por: 'Maria Santos',
      assinatura_cliente: 'data:image/png;base64,ASSINATURA',
    })
  )
})
```

[VERIFIED: campos de updateDoc em handleAprovar lidos em AprovarOrcamentoPage.jsx linhas 99-104]

---

## Validation Architecture

### Test Framework

| Propriedade | Valor |
|------------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `mp-react/vitest.config.js` |
| Comando rápido | `npm test` (dentro de mp-react/) |
| Suite completa | `npm run test:coverage` |

### Phase Requirements — Test Map

| Req ID | Comportamento | Tipo | Comando automatizado | Arquivo existe? |
|--------|--------------|------|---------------------|----------------|
| OS-01 | Criar OS chama criarOS com payload correto | unit | `npm test -- osFluxo` | Não — Wave 0 |
| OS-02 | Editar OS chama atualizarOS com atendForm | unit | `npm test -- osFluxo` | Não — Wave 0 |
| OS-03 | Mudar status chama atualizarOS com { status } | unit | `npm test -- osFluxo` | Não — Wave 0 |
| OS-04 | Excluir OS chama deleteDoc e item some da lista | unit | `npm test -- osFluxo` | Não — Wave 0 |
| OS-05 | Lista vazia exibe mensagem de estado vazio | unit | `npm test -- osFluxo` | Não — Wave 0 |
| OS-06 | Lista com dados exibe itens da resposta do mock | unit | `npm test -- osFluxo` | Não — Wave 0 |
| ORC-01 | Técnico preenche campos e itens sem crash | unit | `npm test -- orcamentoFluxo` | Não — Wave 0 |
| ORC-02 | Canvas de assinatura recebe interação (onEnd) | unit | `npm test -- orcamentoFluxo` | Não — Wave 0 |
| ORC-03 | updateDoc chamado com status: 'em_revisao' | unit | `npm test -- orcamentoFluxo` | Não — Wave 0 |
| ORC-04 | Página de aprovação exibe dados do orçamento | unit | `npm test -- orcamentoFluxo` | Não — Wave 0 |
| ORC-05 | Cliente preenche nome, assina e clica aprovar | unit | `npm test -- orcamentoFluxo` | Não — Wave 0 |
| ORC-06 | updateDoc chamado com status: 'aprovado' + assinatura | unit | `npm test -- orcamentoFluxo` | Não — Wave 0 |

### Wave 0 Gaps

- `mp-react/src/__tests__/osFluxo.test.jsx` — cobre OS-01..06
- `mp-react/src/__tests__/orcamentoFluxo.test.jsx` — cobre ORC-01..06

Framework e infraestrutura já existem — nenhuma instalação adicional necessária.

---

## Environment Availability

Step 2.6: SKIPPED (nenhuma dependência externa nova — todas as bibliotecas já estão instaladas e verificadas no package.json)

[VERIFIED: package.json lido diretamente]

---

## Open Questions (RESOLVED)

1. **RESOLVED: Como testar ORC-01 sem renderizar formulário de linha_branca?**
   - Usar `tipo: 'eletrico'` no mock getDoc para evitar a seção de equipamento (marca/modelo) — facilita asserções sem campos extras.

2. **RESOLVED: handleFotoSelect chama URL.createObjectURL() — jsdom não suporta.**
   - Não disparar `handleFotoSelect` nos testes desta fase. ORC-03 usa `handleSubmit` com `fotos: []` (estado inicial). Os mocks de `comprimirImagem` e `uploadFoto` já cobrem o caminho de upload via `handleSubmit`.

3. **RESOLVED: navigator.onLine no jsdom.**
   - Não mockar. jsdom retorna `true` por padrão — sem impacto nos testes. A lógica de `!online` no `handleSubmit` não bloqueia a execução dos testes.

---

## Assumptions Log

| # | Claim | Section | Risk se errado |
|---|-------|---------|---------------|
| A1 | `userEvent.setup()` é a API recomendada para user-event v14 | Architecture Patterns | Baixo — `userEvent.click` direto também funciona em v14; ambos resolvem |
| A2 | O stub de `doc: vi.fn((db, ...path) => 'mock-ref:' + path.join('/'))` é suficiente para verificar o caminho correto no deleteDoc | Code Examples | Médio — se o planner quiser verificar o argumento exato de deleteDoc, o mock pode precisar retornar objeto com propriedades específicas |
| A3 | `URL.createObjectURL` não é necessário mockar para OS-01..06 (stubs não usam files) | Open Questions | Baixo — stubs não fazem upload de fotos |
| A4 | `orc.tipo: 'eletrico'` no getDoc mock é suficiente para ORC-01..03 sem mostrar seção de linha branca | Open Questions | Baixo — qualquer tipo diferente de 'linha_branca' evita os campos extras |

**Todos os outros claims neste documento foram verificados por leitura direta dos arquivos de código-fonte.**

---

## Sources

### Primary (HIGH confidence — leitura direta de código-fonte)

- `mp-react/src/pages/AdminPage.jsx` (linhas 357-488) — handlers excluirOS, saveOs, saveAtend
- `mp-react/src/pages/OrcamentoTecnicoPage.jsx` — handleSubmit, handleFotoSelect, useEmpresa integration
- `mp-react/src/pages/AprovarOrcamentoPage.jsx` — handleAprovar, handleReprovar, SignatureCanvas usage
- `mp-react/src/firebase.js` — criarOS, atualizarOS, getOSdaEmpresa, uploadFoto, deleteDoc
- `mp-react/src/hooks/useEmpresa.js` — fluxo de resolução, cache, _clearCacheForTest
- `mp-react/src/test-utils/renderWithProviders.jsx` — API atual de renderWithProviders
- `mp-react/src/test-utils/mockFirebase.js` — createFirebaseMocks() factory
- `mp-react/src/__tests__/authContext.test.jsx` — padrão auth mock
- `mp-react/src/__tests__/rotasEmpresa.test.jsx` — Padrão C + wrapper MemoryRouter+Routes
- `mp-react/vitest.config.js` — clearMocks: true, globals, jsdom
- `mp-react/package.json` — versões instaladas verificadas

### Secondary (MEDIUM confidence)

- `CLAUDE.md` — regras de teste, armadilhas críticas, proibição de renderizar AdminPage

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package.json lido diretamente
- Architecture: HIGH — handlers lidos linha a linha nos componentes reais
- Pitfalls: HIGH — derivados diretamente do código-fonte e dos padrões já testados nas Phases 1-3
- Padrões de mock: HIGH — baseados em testes existentes funcionando

**Research date:** 2026-05-19
**Valid until:** 2026-06-19 (dependências estáveis — risco de expiração é LOW neste horizonte)
