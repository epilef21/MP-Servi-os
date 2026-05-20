# Phase 4: Fluxos Críticos - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Escrever testes que cobrem os fluxos de negócio de Ordens de Serviço (OS-01..06) e Orçamento (ORC-01..06). OS handlers de CRUD de OS vivem dentro do AdminPage.jsx (3264 linhas) — nunca será renderizado inteiro. Os fluxos de orçamento passam por componentes dedicados: OrcamentoTecnicoPage.jsx (técnico) e AprovarOrcamentoPage.jsx (cliente) — esses podem ser renderizados diretamente.

</domain>

<decisions>
## Implementation Decisions

### OS-01..06: Estratégia de Stub Component (AdminPage)

- **D-01:** Nunca renderizar `AdminPage.jsx` nos testes — proibido por CLAUDE.md ("testar comportamentos isolados, nunca renderizar o componente inteiro"). Os handlers `saveOs`, `saveAtend`, `excluirOS` são funções locais não exportadas.
- **D-02:** Estratégia: criar **stub components mínimos** diretamente no arquivo de teste (`osFluxo.test.jsx`). Cada stub component replica apenas a lógica mínima do handler e chama as funções Firebase mockadas. Exemplo:
  ```jsx
  function OSFormStub({ empresaId }) {
    const [form, setForm] = useState({ nome_segurado: 'João', seguradora: 'Mapfre', ... })
    async function saveOs() {
      const ref = await criarOS(empresaId, form)
      setRef(ref.id)
    }
    return <button onClick={saveOs}>Criar</button>
  }
  ```
- **D-03:** Para OS-05 e OS-06 (lista vazia / lista com dados), criar um stub component `OSListaStub` que chama `getOSdaEmpresa` no mount e renderiza os resultados — verificando texto de estado vazio ou itens da lista.
- **D-04:** Para OS-04 (excluir OS), o handler chama `window.confirm()`. Mockar com `vi.spyOn(window, 'confirm').mockReturnValue(true)` no `beforeEach` do bloco de excluir. Restaurar com `vi.restoreAllMocks()` no `afterEach`.
- **D-05:** `deleteDoc` não está exportado como helper em firebase.js — é importado diretamente do Firebase SDK. Para testar `excluirOS`, o stub usará `deleteDoc` diretamente, mockado via `vi.mock('../firebase')`.

### ORC-01..06: Renderizar Componentes Reais

- **D-06:** Para ORC-01..03 (técnico), renderizar `OrcamentoTecnicoPage.jsx` diretamente. O componente tem ~250 linhas — dentro do limite aceitável.
- **D-07:** Para ORC-04..06 (cliente), renderizar `AprovarOrcamentoPage.jsx` diretamente. Ambas as páginas usam `useEmpresa` — fornecer empresaId via `FakeAuthProvider` em `renderWithProviders`.
- **D-08:** As rotas das páginas de orçamento usam `useParams({ orcamentoId, slug })`. Usar `MemoryRouter` com `initialEntries={['/empresa-teste/orc-123']}` + `Route path="/:slug/:orcamentoId"` no wrapper.

### SignatureCanvas

- **D-09:** Mockar `react-signature-canvas` via `vi.mock`:
  ```jsx
  vi.mock('react-signature-canvas', () => ({
    default: React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({
        toDataURL: () => 'data:image/png;base64,ASSINATURA',
        isEmpty: () => false,
        clear: vi.fn(),
      }))
      return <canvas data-testid="assinatura" />
    })
  }))
  ```
- **D-10:** Para testar o estado "sem assinatura" (campo `hasSig` false), o mock deve expor um mecanismo para simular canvas vazio. Solução: usar `isEmpty: () => true` em um mock override por teste, ou verificar que o botão de submissão foi bloqueado.

### Mocks de módulos adicionais (OrcamentoTecnicoPage)

- **D-11:** `browser-image-compression` → `vi.mock('browser-image-compression', () => ({ default: vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/jpeg' })) }))`. Evita execução real de compressão no jsdom.
- **D-12:** `validarUpload` (de `../utils/validarUpload`) → `vi.mock('../utils/validarUpload', () => ({ validarUpload: vi.fn().mockResolvedValue(undefined) }))`. Sem validação real nos testes.
- **D-13:** `comprimirImagem` (de `../utils/comprimirImagem`) → `vi.mock('../utils/comprimirImagem', () => ({ comprimirImagem: vi.fn().mockImplementation(f => Promise.resolve(f)) }))`. Retorna o mesmo arquivo sem compressão.
- **D-14:** `uploadFoto` está exportado de `../firebase.js` — já coberto pelo `vi.mock('../firebase')`. Adicionar `uploadFoto: vi.fn().mockResolvedValue('https://storage.example.com/foto.jpg')` ao mock.

### Mock de Firebase (extensão do Padrão C)

- **D-15:** Padrão C continua — `vi.mock('../firebase', () => ({ ... }))` inline no topo do arquivo, imports DEPOIS do vi.mock. Adicionar ao mock para esta fase:
  - `deleteDoc: vi.fn().mockResolvedValue(undefined)`
  - `uploadFoto: vi.fn().mockResolvedValue('https://storage.example.com/foto.jpg')`
  - `serverTimestamp: vi.fn().mockReturnValue({ seconds: 1000000 })`
  - `updateDoc: vi.fn().mockResolvedValue(undefined)` (já existe no mockFirebase.js)
  - `getDoc: vi.fn()` (já existe — mockar retorno por teste)

### Arquivos de teste

- **D-16:** Dois arquivos de teste:
  - `mp-react/src/__tests__/osFluxo.test.jsx` — OS-01..06 com stub components
  - `mp-react/src/__tests__/orcamentoFluxo.test.jsx` — ORC-01..06 com componentes reais

### Claude's Discretion

- Formato exato dos stub components (inline vs factory function).
- Conteúdo exato dos campos do `osForm` nos stubs (qualquer conjunto válido de campos).
- Ordem dos `describe` blocks dentro de cada arquivo de teste.
- Se usar `userEvent.setup()` ou `userEvent` diretamente — preferir `userEvent.setup()` para consistência com RTL docs.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos da fase
- `.planning/ROADMAP.md` §Phase 4 — goal, critérios de sucesso, requisitos OS-01..06 e ORC-01..06

### Código existente relevante (leitura obrigatória)
- `mp-react/src/pages/AdminPage.jsx` linhas 357-488 — `excluirOS`, `excluirOrcamento`, `saveOs`, `saveFin`, `saveAtend` handlers
- `mp-react/src/pages/OrcamentoTecnicoPage.jsx` — handler `handleSubmit` (linha ~188), `handleFotoSelect`, imports na linha 5-11
- `mp-react/src/pages/AprovarOrcamentoPage.jsx` — `handleAprovar` (linha ~89), `handleReprovar` (linha ~114), imports na linha 5-9
- `mp-react/src/firebase.js` — funções `criarOS`, `atualizarOS`, `getOSdaEmpresa` (linhas ~129-160), `deleteDoc` importado do SDK

### Padrões estabelecidos (das fases anteriores)
- `.planning/phases/03-auth-e-roteamento/03-01-SUMMARY.md` — Padrão C de vi.mock inline
- `.planning/phases/03-auth-e-roteamento/03-02-SUMMARY.md` — renderHook com wrapper MemoryRouter+Routes
- `mp-react/src/test-utils/renderWithProviders.jsx` — FakeAuthProvider + MemoryRouter
- `mp-react/src/test-utils/mockFirebase.js` — factory `createFirebaseMocks()` com mocks existentes

### Decisões de projeto
- `CLAUDE.md` §"Decisões de teste" e §"Armadilhas críticas"
- `CLAUDE.md`: "AdminPage.jsx tem 3264 linhas — testar comportamentos isolados, nunca renderizar o componente inteiro"

</canonical_refs>

<code_context>
## Existing Code Insights

### Handlers de OS (AdminPage.jsx)

`saveOs` (linha ~380):
- Chama `criarOS(empresaId, payload)` — payload contém seguradora, num_assist, nome_segurado, status: 'aguardando_tecnico', publicToken
- Retorna `ref.id` — stub deve capturar isso

`saveAtend` (linha ~474):
- Chama `atualizarOS(empresaId, selected.id, atendForm)` — atendForm tem os campos de atendimento

`excluirOS` (linha ~357):
- Chama `window.confirm(...)` — retorna se falso
- Chama `deleteDoc(doc(db, 'empresas/${empresaId}/checklist', os.id))`
- Atualiza estado local `setReports(p => p.filter(...))`

### OrcamentoTecnicoPage.jsx

`handleSubmit` (linha ~188):
- Chama `updateDoc(ref, { status: 'em_revisao', diagnostico, itens, ... })`
- Usa `uploadFoto` para fotos (se houver)
- Não usa helper `atualizarOS` — chama `updateDoc` diretamente

### AprovarOrcamentoPage.jsx

`handleAprovar` (linha ~89):
- Valida `nomeAssinar` e `hasSig`
- Chama `updateDoc(ref, { status: 'aprovado', aprovado_por, assinatura_cliente, aprovado_em })`
- `assinatura_cliente = sigRef.current?.toDataURL('image/png')`

`handleReprovar` (linha ~114):
- Chama `updateDoc(ref, { status: 'reprovado', motivo_reprovacao })`

### Integração com useEmpresa

- `AprovarOrcamentoPage` usa `useEmpresa()` → retorna `{ empresa, config, empresaId, loading }`
- `OrcamentoTecnicoPage` usa `useEmpresa()` → mesmo retorno
- Para testes: FakeAuthProvider com `empresaId: 'emp-test-1'` funciona quando `getEmpresaBySlug` está mockado para retornar dados válidos

</code_context>

<deferred>
## Deferred Ideas

- Testes de `excluirOrcamento` (AdminPage) — sem requisito explícito em ORC-01..06; pode ser adicionado futuramente
- Testes de `saveFin` (financeiro de OS) — sem requisito explícito em OS-01..06
- Testes de reprovação de orçamento (handleReprovar) — ORC-06 cobre apenas aprovação; reprovação pode ser adicionada futuramente
- Testes de geração de PDF de OS/orçamento — fora do escopo desta fase
- Testes de upload real de fotos — imageCompression e uploadFoto são mockados nesta fase

</deferred>
