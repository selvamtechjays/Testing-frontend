---
doc_type: test-map
feature_id: TASK-UI-PREMIUM-REDESIGN
produced_by: dev
generated_at: 2026-11-11
---

# Test map — Premium, animated redesign (Task-21)

Every row is runnable on its own. Copy the command.

| Kind | ID   | Scenario                                                                            | Tier      | Test                                                                                                                                | Run it                                                                           | Needs              | Fixtures   |
| ---- | ---- | ----------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------ | ---------- |
| AC   | AC-1 | Design tokens (palette, accent states, gradients, type, hover shadow) are declared  | unit      | `src/cssStandard.test.ts::declares the design tokens on :root in index.css (CSS-FE-001)`                                            | `npx vitest run src/cssStandard.test.ts -t "declares the design tokens"`         | —                  | —          |
| AC   | AC-1 | Brand mark sits beside the app name in the header                                   | component | `src/components/AppShell.test.tsx::shows the brand mark as decoration beside the app name (Task-21 AC-1)`                           | `npx vitest run src/components/AppShell.test.tsx -t "brand mark"`                | —                  | —          |
| AC   | AC-2 | Preference read, saved, cleared; storage failure never throws                       | unit      | `src/lib/theme.test.ts::theme preference (Task-21 AC-2)` (8 tests)                                                                  | `npx vitest run src/lib/theme.test.ts -t "theme preference"`                     | —                  | —          |
| AC   | AC-2 | Anti-flash script uses the app's storage key, accepts only light/dark, applies them | unit      | `src/lib/theme.test.ts::anti-flash script public/theme-init.js (Task-21 AC-2, CR-4)` (reads key, accepts only, applies x3)          | `npx vitest run src/lib/theme.test.ts -t "anti-flash script"`                    | —                  | —          |
| AC   | AC-2 | Toggle flips theme, exposes aria-pressed, keyboard operable, follows device change  | component | `src/components/ThemeToggle.test.tsx::ThemeToggle (Task-21 AC-2)` (5 tests)                                                         | `npx vitest run src/components/ThemeToggle.test.tsx`                             | —                  | —          |
| AC   | AC-2 | Toggle present on home, register and sign-in; header buttons by accessible name     | component | `src/App.test.tsx::App theme toggle (Task-21 AC-2)`, `src/App.test.tsx::App offers no language control, logo or cookie prompt…`     | `npx vitest run src/App.test.tsx -t "App theme toggle"`                          | —                  | —          |
| AC   | AC-2 | Device default (dark and light)                                                     | e2e       | `e2e/theme.spec.ts::follows a dark device by default (Task-21 AC-2)`, `…::follows a light device by default (Task-21 AC-2)`         | `npx playwright test e2e/theme.spec.ts -g "follows a"`                           | `frontend-running` | —          |
| AC   | AC-2 | Toggle overrides the device; choice survives reload                                 | e2e       | `e2e/theme.spec.ts::toggle overrides the device and the choice survives a reload (Task-21 AC-2)`                                    | `npx playwright test e2e/theme.spec.ts -g "toggle overrides"`                    | `frontend-running` | —          |
| AC   | AC-2 | No wrong-theme flash: saved theme set by theme-init.js with the app bundle blocked  | e2e       | `e2e/theme.spec.ts::the saved theme is applied by the anti-flash script alone, with the app bundle blocked (Task-21 AC-2 no flash)` | `npx playwright test e2e/theme.spec.ts -g "anti-flash script alone"`             | `frontend-running` | —          |
| AC   | AC-3 | Every text, header and boundary pair meets AA in light and both dark blocks         | unit      | `src/cssStandard.test.ts::palette meets WCAG AA (CSS-FE-009, AC-3)`                                                                 | `npx vitest run src/cssStandard.test.ts -t "palette meets WCAG AA"`              | —                  | —          |
| AC   | AC-4 | Motion rules use tokens only; stagger and durations tokenised                       | unit      | `src/cssStandard.test.ts::has no inline timings: transitions and animations use the motion tokens (ui-standards §2)`                | `npx vitest run src/cssStandard.test.ts -t "no inline timings"`                  | —                  | —          |
| AC   | AC-4 | Dark blocks and reduced-motion block allowed only in index.css                      | unit      | `src/cssStandard.test.ts::has no raw colour literals outside token blocks (CSS-FE-001)`                                             | `npx vitest run src/cssStandard.test.ts -t "no raw colour literals"`             | —                  | —          |
| AC   | AC-5 | Reduced motion zeroes every duration and stagger token                              | unit      | `src/cssStandard.test.ts::lets reduced motion zero every duration and the stagger (AC-5)`                                           | `npx vitest run src/cssStandard.test.ts -t "reduced motion zero every duration"` | —                  | —          |
| AC   | AC-5 | Preference re-applied live when the OS setting changes                              | unit      | `src/lib/motion.test.ts::watchMotionPreference (Task-21 AC-5)`                                                                      | `npx vitest run src/lib/motion.test.ts -t "watchMotionPreference"`               | —                  | —          |
| AC   | AC-5 | Orb animation is off under reduced motion                                           | e2e       | `e2e/theme.spec.ts::reduced motion stops the ambient animation (Task-21 AC-5)`                                                      | `npx playwright test e2e/theme.spec.ts -g "reduced motion stops"`                | `frontend-running` | —          |
| AC   | AC-5 | Reduced motion applied live when the device setting flips while the page is open    | e2e       | `e2e/theme.spec.ts::reduced motion applies live when the device setting changes (Task-21 AC-5)`                                     | `npx playwright test e2e/theme.spec.ts -g "applies live"`                        | `frontend-running` | —          |
| AC   | AC-6 | Delete exit still waits the `--duration-base` exit time; undo still works           | component | `src/components/TaskRow.delete.test.tsx::asks to delete that task on one click, with no confirmation dialog (AC-1 BR-1 TS-1)`       | `npx vitest run src/components/TaskRow.delete.test.tsx`                          | —                  | buildTask  |
| AC   | AC-6 | Exit duration read from the token                                                   | unit      | `src/lib/motion.test.ts::motion reads the exit duration from the --duration-base token, in ms or s`                                 | `npx vitest run src/lib/motion.test.ts -t "exit duration"`                       | —                  | —          |
| AC   | AC-6 | Routes still render after code-splitting (register, sign-in, redirect, task list)   | component | `src/App.test.tsx::App routes`                                                                                                      | `npx vitest run src/App.test.tsx -t "App routes"`                                | —                  | meSignedIn |
| AC   | AC-6 | 44px toggle target and no horizontal scroll at 360px                                | e2e       | `e2e/theme.spec.ts::keeps a 44px toggle and no sideways scroll at 360px wide (Task-21 AC-6)`                                        | `npx playwright test e2e/theme.spec.ts -g "44px toggle"`                         | `frontend-running` | —          |
| AC   | AC-7 | Only dependency added is the Inter font; no CSS-in-JS or animation library          | review    | `package.json` diff (reviewed)                                                                                                      | `git diff 9759e0d -- package.json`                                               | —                  | —          |

## Run everything for this feature

```bash
npm test                      # unit + component
npx playwright test           # browser journeys
npm run test:coverage         # coverage thresholds
```

## Not automated

| ID   | Scenario                                                                  | Why                                   | How to check by hand                                           |
| ---- | ------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------- |
| AC-1 | Inter, indigo/violet palette, layered cards and frosted header look right | visual judgement                      | `npm run dev`, open /signin, /register and / in light and dark |
| AC-4 | Row cascade, tick pop, strike draw, delete slide, Undo spring             | animation feel is not unit-assertable | `npm run dev`, add, complete, delete and undo a few tasks      |
