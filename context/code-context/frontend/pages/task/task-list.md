---
doc_type: page
schema_version: 1.1
produced_by: tl
page_id: PAGE-TASK-01
status: Proposed
implementation_state: Planned
origin: designed
generated_at: 2026-11-06
---

# Page: Task List

## Page ID

PAGE-TASK-01

## Status

Proposed

## Route

/ (the signed-in home). Guarded: without a valid session the app routes to /signin.

## Surface

Web (responsive)

## Purpose

The one working screen of TaskNest: shows the signed-in user's tasks newest first and hosts adding, editing, completing and deleting a task, plus Log out. Add form, inline title edit, completion tick, delete with Undo message and the failure message are parts of this page (states/sections), not separate pages.

## User Personas

- Signed-in user — manages their private tasks

## Key Interactions / Workflows

- View: own tasks only, newest first, each clearly Pending or Completed; completed tasks stay visible (TASK-UC-08).
- Add: type a title, Enter or Add; the task appears at the top as Pending at once; input is blocked at 200 characters with a validation message; empty submit adds nothing (TASK-UC-02).
- Edit title: same rules (mandatory, 200 max, blocked with message); an empty confirm is refused and the old title kept (TASK-UC-03).
- Complete / reopen: tick and untick, shown at once, stays in place (TASK-UC-04).
- Delete: row disappears at once and a "Task deleted - Undo" message shows for 5 seconds; Undo restores the row in its place; otherwise the delete is final (TASK-UC-05). No confirmation dialog.
- Log out: control in the page header ends the session and returns to /signin (AUTH-UC-06).
- Instant update with rollback (FEAT-PLAT-01): this page owns a single shared optimistic-update mechanism used by add, edit, tick/untick and delete — apply the change to local state immediately (no spinner), send the request in the background, and on failure restore the prior state and show a message that the change could not be saved. Built and tested once. No retry, no offline queue, no cross-tab sync.

## Page States

- Loading (initial fetch)
- Empty list with a prompt to add a first task
- Populated list (Pending and Completed rows)
- Title validation message (empty / over 200)
- Undo message visible (5 seconds)
- Save-failed message after rollback
- Session expired / missing → redirect to /signin

## Consumes Endpoints

- Current user (route guard) — ../../../../../../backend/context/code-context/backend/domains/auth/endpoints/get-current-user.md (EP-AUTH-04)
- Sign out — ../../../../../../backend/context/code-context/backend/domains/auth/endpoints/logout.md (EP-AUTH-03)
- List tasks — ../../../../../../backend/context/code-context/backend/domains/task/endpoints/list-tasks.md (EP-TASK-01)
- Create task — ../../../../../../backend/context/code-context/backend/domains/task/endpoints/create-task.md (EP-TASK-02)
- Update task — ../../../../../../backend/context/code-context/backend/domains/task/endpoints/update-task.md (EP-TASK-03)
- Delete task — ../../../../../../backend/context/code-context/backend/domains/task/endpoints/delete-task.md (EP-TASK-04)

## Used by Features

- FEAT-TASK-01 Task List and Add Task
- FEAT-TASK-02 Edit and Complete Task
- FEAT-TASK-03 Delete Task with Undo
- FEAT-AUTH-02 Sign In and Sign Out (Log out control, session guard)
- FEAT-PLAT-01 Instant Update with Rollback
- FEAT-PLAT-02 Platform Baseline (applies to every screen)

## Permissions

- Signed-in user only; sees only their own tasks (BR-025). No admin view (DEC-031, DEC-042).

## Open Questions

- OQ-TASK-01 | Delete inside the Undo window then tab close: lost or flushed? | TL / Client | Deferred-delete design (see EP-TASK-04) | Open (non-blocking)

## Source References

- Feature: FEAT-TASK-01, FEAT-TASK-02, FEAT-TASK-03, FEAT-AUTH-02, FEAT-PLAT-01, FEAT-PLAT-02
- Workflow: WF-002, WF-003
- Business rules: BR-008, BR-010, BR-016, BR-018, BR-023, BR-025, BR-026
