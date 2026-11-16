---
doc_type: page
schema_version: 1.1
produced_by: tl
page_id: PAGE-AUTH-02
status: Active
implementation_state: Implemented
origin: implemented
design_confidence: Confirmed
implemented_at: 2026-11-07T07:40:49Z
implemented_by_commit: 6a794ddcd30da6f44690b64d13bf856d686dab62
implemented_by_task: FEAT-AUTH-02-2
mapped_from: src/pages/SignInPage.tsx
mapped_from_line: 9
mapped_from_commit: 6a794ddcd30da6f44690b64d13bf856d686dab62
generated_at: 2026-11-06
---

# Page: Sign In

## Page ID

PAGE-AUTH-02

## Status

Active

## Route

/signin

## Surface

Web (responsive)

## Purpose

Let a registered tester sign in with username and password and land on their own task list; also the page shown after Log out or when a session is missing (AUTH-UC-03, AUTH-UC-06).

## User Personas

- Registered user — signs in

## Key Interactions / Workflows

- Enter username and password; submit.
- Wrong credentials: one generic error that never says which field was wrong; the user may retry with no lockout.
- On success route to PAGE-TASK-01.
- Link to Register. No "Forgot password" and no "Remember me" (DEC-045, DEC-048).
- Theme (Task-21): a sun/moon toggle in the header, on every screen, switches light and dark; the choice is kept on this device, and the default follows the device setting.

## Page States

- Idle form
- Submitting
- Generic credential error
- Redirected-here notice (optional): signed out / session ended (Assumed, minimal)

## Consumes Endpoints

- Sign in — ../../../../../../backend/context/code-context/backend/domains/auth/endpoints/login.md (EP-AUTH-02)

## Used by Features

- FEAT-AUTH-02 Sign In and Sign Out
- FEAT-PLAT-02 Platform Baseline (applies to every screen)

## Permissions

- Public (unauthenticated).

## Open Questions

- None.

## Source References

- Feature: FEAT-AUTH-02 (feature.md → Related Pages), FEAT-PLAT-02
- Workflow: WF-001
- Business rules: BR-004, BR-027
- [code › src/pages/SignInPage.tsx:9]
- [code › src/pages/useSignInForm.ts:9]
- [test › src/pages/SignInPage.test.tsx]
