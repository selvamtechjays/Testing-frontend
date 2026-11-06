---
doc_type: page
schema_version: 1.1
produced_by: tl
page_id: PAGE-AUTH-02
status: Proposed
implementation_state: Planned
origin: designed
generated_at: 2026-11-06
---

# Page: Sign In

## Page ID

PAGE-AUTH-02

## Status

Proposed

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
