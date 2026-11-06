---
doc_type: layer-overview
schema_version: 1.1
produced_by: tl
layer: frontend
generated_at: 2026-11-06
---

# Frontend Overview

## Stack

React 19 + TypeScript 5.8 + Vite 6 SPA (DEC-002). Vitest + React Testing Library + MSW (DEC-007), Playwright e2e (DEC-014). Routing library is not yet chosen (none installed at scaffold); a client-side router is a build-time decision.

## Conventions

Per coding-standards: feature code in `src/features/<feature-slug>/` with an `api.ts` as the only backend caller; shared pieces in `src/components/`, `src/hooks/`; one fetch wrapper at `src/lib/apiClient.ts`. Relative `/api/...` URLs (DEC-010); the session cookie is sent same-origin (`credentials: 'same-origin'`). The shared optimistic-update + rollback mechanism (FEAT-PLAT-01) belongs in `src/hooks/` or `src/lib/`, not in a feature folder, because add/edit/complete/delete all use it.

## Entry Points

`src/main.tsx`, `src/App.tsx` (shell only today). Routes: /register, /signin, / (guarded).

## Notes

Layout, English-only copy, responsiveness, basic accessibility and keyboard use apply to every page (FEAT-PLAT-02) and are recorded on each page's Used by Features, not as units of their own.
