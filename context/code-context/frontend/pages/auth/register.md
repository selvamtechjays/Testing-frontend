---
doc_type: page
schema_version: 1.1
produced_by: tl
page_id: PAGE-AUTH-01
status: Active
implementation_state: Implemented
origin: implemented
design_confidence: Confirmed
implemented_at: 2026-11-06T13:50:00Z
implemented_by_commit: 366b2aec436beb8d9a96a1e6093f10e67b641667
implemented_by_task: FEAT-AUTH-01-2
mapped_from: src/pages/RegisterPage.tsx
mapped_from_line: 8
mapped_from_commit: 366b2aec436beb8d9a96a1e6093f10e67b641667
generated_at: 2026-11-06
---

# Page: Register

## Page ID

PAGE-AUTH-01

## Status

Active

## Route

/register

## Surface

Web (responsive desktop and mobile, FEAT-PLAT-02)

## Purpose

Let a visitor create an account with only a username and a password and go straight to their task list (AUTH-UC-01).

## User Personas

- Visitor (invited tester) — creates an account

## Key Interactions / Workflows

- Enter username and password; submit.
- Show clear per-field messages for a taken or invalid username and a too-short or too-common password; nothing is created; user corrects and resubmits.
- On success the user is already signed in and is routed to PAGE-TASK-01.
- Link to Sign In for existing users.
- Client-side hints mirror the server rules (3 to 30 letters/numbers/underscores; 8+ chars). The server is authoritative. A strength indicator is not in v1 scope (DEC-027 predates DEC-040/046; not carried into the feature) — not designed.

## Page States

- Idle form
- Submitting
- Field errors (username taken / format / password weak)
- Generic failure (network/server) with message

## Consumes Endpoints

- Register account — ../../../../../../backend/context/code-context/backend/domains/auth/endpoints/register.md (EP-AUTH-01)

## Used by Features

- FEAT-AUTH-01 Account Registration
- FEAT-PLAT-02 Platform Baseline (applies to every screen)

## Permissions

- Public (unauthenticated). No invite code or access check (CLR-035 open, ASM-027).

## Open Questions

- CLR-035 | How is registration limited to invited testers? | Client | May add an invite code or username list page element | Open

## Source References

- Feature: FEAT-AUTH-01 (feature.md → Related Pages), FEAT-PLAT-02
- Workflow: WF-001
- Business rules: BR-003, BR-027
- [code › src/pages/RegisterPage.tsx:8]
- [code › src/pages/useRegisterForm.ts:16]
- [test › src/pages/RegisterPage.integration.test.tsx]
