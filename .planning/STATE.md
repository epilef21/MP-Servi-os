# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-05)

**Core value:** Produto confiável e completo — fluxos críticos cobertos por testes e features core entregues.
**Current focus:** v1.0 Test Coverage — Phase 4 pendente (Fluxos Críticos — discuss completo, pronto para planejar)

## Current Position

Milestone: v1.0 Test Coverage — em progresso
Phase: 4 of 4 (v1.0 scope) — Ready to execute
Plan: 2 of 2 (Phase 4 plans) — Complete
Status: Phase 4 planejamento completo (2026-05-19) — 04-01-PLAN.md (OS-01..06) e 04-02-PLAN.md (ORC-01..06) verificados e aprovados.
Last activity: 2026-05-19 — Phase 4 planned — 2 planos Wave 1 independentes: osFluxo.test.jsx (stub components) + orcamentoFluxo.test.jsx (componentes reais + SignatureCanvas mock async)

Progress (v1.0): [██████░░░░] 75% (Phases 1-3 complete, Phase 4 ready to execute)
Progress (v1.1): [██████████] 100% (Phases 5+6 complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 5 (2 v1.0 + 3 v1.1)
- Average duration: ~6 min
- Total execution time: ~0.5 hours

**By Phase:**

| Phase | Plans | Completed | Avg/Plan |
|-------|-------|-----------|----------|
| 1. Infraestrutura | 2 | 2 | 8 min |
| 2. Camada Base | 2 | 2 | ~12 min |
| 3. Auth e Roteamento | 2 | 2 | ~6 min |
| 4. Fluxos Críticos | 2 | 0 | — |
| 5. Compressão de Imagens | 1 | 1 | ~4 min |
| 6. Relatório Mensal em PDF | 2 | 2 | ~8 min |

**Recent Trend:** Phase 6 complete (2026-05-05) — 2 planos executados, aprovados e verificados

## Accumulated Context

### Decisions

- Pre-start: Vitest 4.1.5 + RTL 16 + vi.mock() para Firebase (sem Emulator Suite, sem MSW)
- Pre-start: JavaScript puro — sem TypeScript nos testes
- Pre-start: clearMocks: true globalmente (nunca resetMocks: true)
- 01-01: vitest.config.js standalone (vitest/config, não extendendo vite_config.js)
- 01-01: .env.test commitado (não no .gitignore) — stubs seguros para todos os testes
- 01-02: AuthContext exportado (export const) para permitir FakeAuthProvider sem trigger do Firebase
- 01-02: Arquivos de teste com JSX devem usar extensão .jsx — OXC/Vite 8 não processa JSX em .js
- v1.1: browser-image-compression já instalado — integrar diretamente em OrcamentoTecnicoPage.jsx
- v1.1: jsPDF já instalado (usado em pdfGenerator.js e orcamentoPdfGenerator.js) — reaproveitar padrão existente em utils/relatorioMensalPdf.js
- 06-01: getLucroLocal copiado internamente para evitar dependência circular utils->pages
- 06-01: agregarRelatorio filtra client-side (in-memory) sem nova query Firestore
- 06-01: tableRow helper para tabelas de breakdown (3 colunas) em vez de textBlock
- 06-02: seletor de período com 12 opções geradas por loop — sem input livre para evitar valores inválidos
- 06-02: tabelas inline com style props — sem adicionar novas classes CSS conforme CLAUDE.md
- 06-02: mudar o select limpa relDados para forçar nova geração (evita dados desatualizados)
- v1.1: campo lucroReal já salvo em cada documento de OS em empresas/{empresaId}/checklist/{osId} — sem migration necessária
- 05-01: compressão ocorre no handleSubmit (não no handleFotoSelect) — evita bloqueio async na seleção
- 05-01: estado `comprimindo` (não uploadingFoto) — reflete que o feedback corresponde à fase de compressão
- 03-01: Padrão C de mock: vi.mock('../firebase') inline + .mockImplementation() por describe (clearMocks:true não limpa implementations)
- 03-02: Guards locais no arquivo de teste (Opção B) — sem modificar exportações do App.jsx
- 03-02: renderHook com wrapper MemoryRouter+Routes — obrigatório para hooks que usam useParams() e useNavigate()
- 03-02: _clearCacheForTest exportado de useEmpresa.js (prefixo _ = uso só em testes)
- 03-02: RotaAdmin agora verifica !empresaId além de !estaLogado (correção de segurança AUTH-07)
- 04-discuss: OS-01..06 usa stub components mínimos no arquivo de teste (AdminPage não renderizado)
- 04-discuss: ORC-01..06 renderiza OrcamentoTecnicoPage e AprovarOrcamentoPage diretamente
- 04-discuss: vi.mock('react-signature-canvas') com toDataURL fake para ORC-02/ORC-05
- 04-discuss: mocks adicionais — browser-image-compression, validarUpload, comprimirImagem, uploadFoto/serverTimestamp/deleteDoc em firebase

### Pending Todos

- Planejar Phase 4 via /gsd-plan-phase 4 (discuss completo — 04-CONTEXT.md disponível)
- Executar Phase 4 do milestone v1.0 (Fluxos Críticos — OS e Orçamento)

### Blockers/Concerns

- Phase 1 risk: env-guard bomb em firebase.js — resolvido por .env.test com stubs VITE_FIREBASE_*
- Phase 3 risk: onAuthStateChanged fora de act() — resolvido por mock síncrono com cb(null)
- Phase 4 risk: AdminPage 3264 linhas — testar handlers/hooks isolados, não renderizar o componente inteiro
- Phase 6 review: CR-01 (checkPage não reserva rodapé), CR-02 (MESES[mes-1] sem validação), WR-01 (getLucroLocal duplicado) — registrados em 06-REVIEW.md para tratamento futuro

## Session Continuity

Last session: 2026-05-19
Stopped at: Phase 4 discuss completo — 04-CONTEXT.md criado. Próximo: /gsd-plan-phase 4
Resume file: None
