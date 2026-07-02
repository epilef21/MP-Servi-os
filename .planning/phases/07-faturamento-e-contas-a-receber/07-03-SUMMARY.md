---
phase: 07-faturamento-e-contas-a-receber
plan: 03
subsystem: financeiro
tags: [react, firestore, config, faturamento]

# Dependency graph
requires:
  - phase: 07-01
    provides: "utils/faturamento.js com REGRAS_FATURAMENTO_PADRAO (Mapfre/Allianz/Mondial)"
provides:
  - "Seção 'Calendário de pagamento por seguradora' na aba Config > Tarifas do ConfigTab.jsx"
  - "calForm inicializado de config.calendarioFaturamento com fallback para REGRAS_FATURAMENTO_PADRAO"
  - "saveCalendario: merge em config.calendarioFaturamento sem apagar outras chaves, espelhando Mondial=Allianz"
affects: [07-04, 07-05, AbaFaturamento]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Init de form por useEffect(config) com fallback para constante padrão — mesmo padrão de tarifaForm/DESL_FAIXAS_PADRAO"
    - "Save por merge explícito (spread do doc atual + chave nova) — nunca overwrite do config inteiro"

key-files:
  created: []
  modified:
    - mp-react/src/components/admin/ConfigTab.jsx

key-decisions:
  - "Seção de calendário adicionada dentro da sub-aba 'Tarifas' existente, não criou sub-aba nova — evita colidir com a sub-aba 'calendario' que já é usada para Google Calendar"
  - "Mondial não é editável separadamente na UI; saveCalendario sempre espelha Mondial = Allianz ao gravar, mantendo o alias estabelecido em 07-01"

patterns-established:
  - "normalizarFaixa como função de módulo (fora do componente) para conversão segura de string→número antes de gravar no Firestore"

requirements-completed: [FAT-07]

# Metrics
duration: 9min
completed: 2026-07-02
---

# Phase 7 Plan 3: ConfigTab — Calendário de Pagamento Editável Summary

**Seção editável de calendário de pagamento por seguradora (Mapfre e Allianz/Mondial) na aba Config > Tarifas, pré-preenchida com REGRAS_FATURAMENTO_PADRAO e persistida via merge em config.calendarioFaturamento.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-07-02T23:25:00Z (aprox.)
- **Completed:** 2026-07-02T23:34:13Z
- **Tasks:** 2/2
- **Files modified:** 1

## Accomplishments
- Admin agora vê e edita, na aba Config > Tarifas, as faixas de calendário de pagamento da Mapfre (3 faixas) e Allianz/Mondial (5 faixas, incluindo a faixa 26–31 marcada como não faturável)
- Formulário inicia pré-preenchido com o calendário oficial (`REGRAS_FATURAMENTO_PADRAO` do Plano 01) quando o admin ainda não customizou nada em `config.calendarioFaturamento`
- Salvar mescla apenas a chave `calendarioFaturamento` no doc de config — não apaga `tarifas`, `seguradoras` nem nenhuma outra chave existente
- Mondial sempre recebe o mesmo objeto salvo para Allianz (espelho automático), coerente com a decisão de 07-01 de tratá-los como o mesmo calendário

## Task Commits

Each task was committed atomically:

1. **Task 1: Estado + inicialização do form de calendário a partir do config com fallback padrão** - `67af57a` (feat)
2. **Task 2: UI de edição das faixas de calendário na aba Config** - `a0b0408` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `mp-react/src/components/admin/ConfigTab.jsx` - Import de `REGRAS_FATURAMENTO_PADRAO`, helper de módulo `normalizarFaixa`, estado `calForm`/`savingCal`, `useEffect` de inicialização a partir de `config.calendarioFaturamento`, handlers `setFaixa`/`saveCalendario`, e nova seção "📅 Calendário de pagamento por seguradora" renderizada dentro da sub-aba Tarifas

## Decisions Made
- Reaproveitar a sub-aba "Tarifas" já existente em vez de criar uma nova, evitando qualquer risco de confusão com a sub-aba "Calendário" (que é o Google Calendar, funcionalidade completamente diferente)
- `normalizarFaixa` extraída como função de módulo (fora do componente) para deixar clara a responsabilidade única de conversão/validação de uma faixa antes de gravar

## Deviations from Plan

None - plan executado exatamente como escrito.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `config.calendarioFaturamento` agora é a fonte de verdade editável pelo admin, e `getRegrasFaturamento` (Plano 01) já lê exatamente dessa estrutura — nenhuma mudança adicional necessária para o Plano 04 (fila de faturamento) ou Plano 05 (Fechar Nota) consumirem o calendário customizado
- Nenhum bloqueio identificado para os próximos planos da Phase 7

## Self-Check: PASSED

- FOUND: mp-react/src/components/admin/ConfigTab.jsx
- FOUND commit: 67af57a
- FOUND commit: a0b0408

---
*Phase: 07-faturamento-e-contas-a-receber*
*Completed: 2026-07-02*
