---
phase: 03-auth-e-roteamento
plan: "03-02"
subsystem: testing
tags: [vitest, react-testing-library, firebase, guards, react-router, useEmpresa, cache]

requires:
  - phase: 03-01
    provides: padrão vi.mock('../firebase') inline estabelecido; AuthContext testável

provides:
  - Suite de 8 testes cobrindo guards RotaAdmin/RotaSuperAdmin e hook useEmpresa (AUTH-06..13)
  - Correção de RotaAdmin no App.jsx: verifica empresaId além de estaLogado (AUTH-07)
  - _clearCacheForTest() exportado do useEmpresa para isolamento de cache em testes
  - getEmpresaBySlug e getConfigEmpresa adicionados ao createFirebaseMocks()

affects:
  - Phase 4 (testes de fluxos críticos dependem das correções de RotaAdmin e mockFirebase)

tech-stack:
  added: []
  patterns: [renderHook com wrapper MemoryRouter+Routes para hooks que usam useParams e navigate, _clearCacheForTest no beforeEach global para cache de módulo]

key-files:
  created:
    - mp-react/src/__tests__/rotasEmpresa.test.jsx
  modified:
    - mp-react/src/hooks/useEmpresa.js
    - mp-react/src/App.jsx
    - mp-react/src/test-utils/mockFirebase.js

key-decisions:
  - "Guards definidos localmente no arquivo de teste (Opção B da pesquisa) — sem modificar exportações do App.jsx"
  - "AUTH-12 usa wrapper WrapperComRota com duas Routes para capturar navegação para /empresa-nao-encontrada no DOM"
  - "beforeEach global chama _clearCacheForTest() para isolamento correto do cache de módulo entre testes AUTH-11..13"

patterns-established:
  - "renderHook com wrapper que inclui MemoryRouter+Routes — obrigatório para hooks que usam useParams() e useNavigate()"
  - "criarWrapper(slug) factory para criar wrappers de renderHook dinamicamente com slugs diferentes"

requirements-completed:
  - AUTH-06
  - AUTH-07
  - AUTH-08
  - AUTH-09
  - AUTH-10
  - AUTH-11
  - AUTH-12
  - AUTH-13

duration: 8min
completed: 2026-05-19
---

# Plan 03-02: Testes de Guards e useEmpresa Summary

**8 testes de guards de rota (RotaAdmin/RotaSuperAdmin) e hook useEmpresa com cache, mais correção de RotaAdmin para verificar empresaId**

## Performance

- **Duration:** 8 min
- **Completed:** 2026-05-19
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Task 1: 3 modificações cirúrgicas de produção — _clearCacheForTest, RotaAdmin+empresaId, mockFirebase+getEmpresaBySlug/getConfigEmpresa
- Task 2: rotasEmpresa.test.jsx com 8 testes verdes cobrindo AUTH-06..13
- Suite completa Phase 3: 13/13 testes passando (5 authContext + 8 rotasEmpresa)
- AUTH-07 cobre correção de segurança real: usuário logado sem empresaId bloqueado no RotaAdmin

## Task Commits

1. **Task 1: Preparar código de produção** - `6abcad1` (feat)
2. **Task 2: Criar rotasEmpresa.test.jsx** - `fd25b22` (test)

## Files Created/Modified
- `mp-react/src/__tests__/rotasEmpresa.test.jsx` — 8 testes AUTH-06..13
- `mp-react/src/hooks/useEmpresa.js` — exporta _clearCacheForTest()
- `mp-react/src/App.jsx` — RotaAdmin verifica !empresaId além de !estaLogado
- `mp-react/src/test-utils/mockFirebase.js` — getEmpresaBySlug + getConfigEmpresa

## Decisions Made
Guards definidos localmente no arquivo de teste para evitar modificar exportações do App.jsx.

## Deviations from Plan
None - plano executado exatamente como escrito.

## Issues Encountered
None.

## Next Phase Readiness
- Phase 3 completa: 13 testes cobrindo AUTH-01..13
- mockFirebase.js atualizado com getEmpresaBySlug e getConfigEmpresa — Phase 4 pode usar diretamente
- RotaAdmin corrigido para verificar empresaId — proteção de rota mais robusta em produção

---
*Phase: 03-auth-e-roteamento*
*Completed: 2026-05-19*

## Self-Check: PASSED
- [x] rotasEmpresa.test.jsx existe com 8 testes verdes
- [x] _clearCacheForTest exportado do useEmpresa.js
- [x] App.jsx RotaAdmin verifica !empresaId
- [x] mockFirebase.js tem getEmpresaBySlug e getConfigEmpresa
- [x] Suite completa Phase 3: 13/13 testes passando
