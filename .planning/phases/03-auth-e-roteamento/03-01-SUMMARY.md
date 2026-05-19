---
phase: 03-auth-e-roteamento
plan: "03-01"
subsystem: testing
tags: [vitest, react-testing-library, firebase, auth, authcontext]

requires:
  - phase: 02-camada-base
    provides: mockFirebase.js factory e padrão vi.mock('../firebase') estabelecidos

provides:
  - Suite de 5 testes cobrindo ciclo de vida completo do AuthProvider (AUTH-01..05)
  - Padrão C de mock: vi.mock('../firebase') com objeto literal inline + .mockImplementation() por teste

affects:
  - 03-02 (rota e guards tests dependem do padrão de mock estabelecido aqui)

tech-stack:
  added: []
  patterns: [vi.mock inline com objeto literal, mockImplementation por describe para reconfigurar mocks]

key-files:
  created:
    - mp-react/src/__tests__/authContext.test.jsx
  modified: []

key-decisions:
  - "Padrão C escolhido: vi.mock('../firebase') com objeto literal inline — clearMocks: true limpa call counts mas não mockImplementation, então cada teste reconfigurar com .mockImplementation()"
  - "ExporContexto como componente auxiliar para expor o contexto na DOM via data-testid"
  - "AUTH-01 verifica container.textContent (não screen.queryByTestId) porque AuthProvider renderiza fallback, não os children"

patterns-established:
  - "Mock AUTH-01: onAuthStateChanged.mockImplementation(() => () => {}) para simular estado pendente sem chamar o callback"
  - "Mock AUTH-05: signOut.mockImplementation chama authCallback(null) internamente para simular o Firebase disparando onAuthStateChanged após logout"

requirements-completed:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - AUTH-04
  - AUTH-05

duration: 5min
completed: 2026-05-19
---

# Plan 03-01: Testes do AuthContext Summary

**5 testes de AuthProvider cobrindo loading, resolução de empresaId via Firestore (primário + fallback), superadmin por claims JWT e limpeza de estado no logout**

## Performance

- **Duration:** 5 min
- **Completed:** 2026-05-19
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- `authContext.test.jsx` criado com 5 testes verdes sem warnings de act()
- AUTH-01: loading renderiza "Carregando..." quando callback não é chamado
- AUTH-02/03: empresaId resolvido pelo caminho primário (empresas/{uid}) e fallback (usuarios/{uid})
- AUTH-04: superadmin detectado por claims role + superadmin_until não expirado
- AUTH-05: logout via act() + signOut.mockImplementation limpa usuario e empresaId

## Task Commits

1. **Task 1: Criar authContext.test.jsx** - `999be53` (test)

## Files Created/Modified
- `mp-react/src/__tests__/authContext.test.jsx` — 5 testes AUTH-01..05 com vi.mock('../firebase') inline

## Decisions Made
Nenhuma decisão além das definidas no plano — executado exatamente como especificado.

## Deviations from Plan
None - plano executado exatamente como escrito.

## Issues Encountered
None.

## Next Phase Readiness
- Padrão C de mock estabelecido — 03-02 pode reutilizar exatamente a mesma abordagem
- AuthProvider e useAuth testáveis; próximo: guards RotaAdmin/RotaSuperAdmin e useEmpresa

---
*Phase: 03-auth-e-roteamento*
*Completed: 2026-05-19*

## Self-Check: PASSED
- [x] authContext.test.jsx existe
- [x] 5 testes verdes (AUTH-01..05)
- [x] vi.mock('../firebase') com objeto literal inline
- [x] Nenhum resetMocks/restoreMocks/jest.fn()
