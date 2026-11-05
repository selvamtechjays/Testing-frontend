# Testing-frontend — Testing-Delivery-os Web

React 19 + Vite 6 + TypeScript single-page app. Calls the Testing-Delivery-os API over REST.

## Requirements

- Node.js >= 22, npm >= 10

## Setup

```bash
npm install
cp .env.example .env   # optional — defaults work for local dev
```

## Scripts

| Command                           | What it does                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `npm run dev`                     | Vite dev server on http://localhost:5173 — proxies `/api` to http://localhost:4000 |
| `npm run lint`                    | ESLint (zero warnings allowed)                                                     |
| `npm run format` / `format:check` | Prettier write / check                                                             |
| `npm run typecheck`               | TypeScript, no emit                                                                |
| `npm test`                        | Vitest (jsdom + React Testing Library)                                             |
| `npm run test:coverage`           | Vitest with v8 coverage                                                            |
| `npm run build`                   | Type-check and build to `dist/`                                                    |

## Layout

```
src/
  main.tsx        entry
  App.tsx         root shell
  App.test.tsx    smoke test
  test/setup.ts   jest-dom matchers
```

Feature code goes in `src/features/<feature>/`. Conventions are in the workspace's
`.jetrix/shared-context/coding-standards.md` § frontend.

## Testing

- `npm test` unit + component + integration (Vitest, RTL, MSW); `npm run test:coverage` enforces 80% lines/statements/functions, 70% branches.
- `npm run test:e2e:smoke` Playwright (Chromium). `npm run test:e2e` runs all e2e specs.
- `npm run verify` is what CI runs: format:check, lint, typecheck, test:coverage, build. `npm run audit:gate` fails only on new high/critical advisories (baseline: `qa/audit-baseline.json`).
- Pre-commit (husky + lint-staged) lints and format-checks staged files.
- Conventions: co-located `*.test.ts(x)`; shared helpers in `src/test/` (`utils.tsx`, `builders/`, `mocks/`); e2e specs in `e2e/` with page objects in `e2e/pages/`. Never hit a live backend in unit/integration tests; MSW fails unhandled requests. Never skip a test or lower a threshold to go green.
