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
