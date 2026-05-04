# Discussion Log — Phase 1: Infraestrutura de Testes

**Date:** 2026-05-03
**Duration:** ~5 min
**Areas selected:** Vitest config strategy

---

## Area: Vitest config strategy

**Q1:** Como o vitest.config.js deve se relacionar com o vite_config.js existente?

Options presented:
1. Standalone (Recommended) — vitest.config.js standalone com plugin React declarado diretamente
2. Extend com mergeConfig — import + mergeConfig(), DRY mas cria acoplamento
3. Renomear vite_config.js — renomear para nome padrão e vitest auto-detecta

**User selected:** Standalone (Recommended)

---

## Areas not selected (user discretion)

- **npm test behavior** — não discutido; padrão single-run (`vitest run`) escolhido por Claude por ser CI-compatible
- **mockFirebase design** — não discutido; factory function escolhida por Claude por garantir isolamento entre testes

---

## Deferred Ideas

- `@vitest/ui` — interface visual, conveniência futura
- Coverage provider (v8 vs istanbul) — fase futura
- CI/CD com GitHub Actions — fora de escopo v1
