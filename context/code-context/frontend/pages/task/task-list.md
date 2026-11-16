---
doc_type: page
schema_version: 1.1
produced_by: tl
page_id: PAGE-TASK-01
status: Active
implementation_state: Implemented
origin: implemented
design_confidence: Confirmed
implemented_at: 2026-11-16T05:40:00Z
implemented_by_commit: 4e69048419bc93775ee736d3dad01edc05d902b0
implemented_by_task: FEAT-TASK-01-2, FEAT-TASK-02-2, FEAT-TASK-03-2, FEAT-PLAT-01-2, Task-22
mapped_from: src/pages/TaskListPage.tsx
mapped_from_line: 49
mapped_from_commit: 4e69048419bc93775ee736d3dad01edc05d902b0
generated_at: 2026-11-06
---

# Page: Task List

## Page ID

PAGE-TASK-01

## Status

Active

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
- Search (Task-22): a labelled search box (type=search, 100 character limit) sits between the add form and the failure notice. 300 ms after the last keystroke the trimmed text is sent as GET /api/tasks?search=<text>; a request still in flight is aborted and a response for old text is dropped. Emptying the box (or Escape) brings back the full list. The current list stays on screen, marked busy, while a search runs (no skeleton). A task added or renamed while searching stays visible until the text changes: no client-side re-filtering (DEC-207). A response that lands after the user kept working is merged, not swapped in: tasks added since the request was sent stay on top, later edits win over the response's copy, and tasks deleted since stay gone. Add stays available on a no-match result. A polite status region reads the match count or the no-match text.
- Theme (Task-21): a sun/moon toggle in the header, on every screen, switches light and dark; the choice is kept on this device, and the default follows the device setting.

## Page States

- Loading (initial fetch)
- Empty list with a prompt to add a first task
- Populated list (Pending and Completed rows)
- Title validation message (empty / over 200)
- Undo message visible (5 seconds)
- Search box with a result list (matches only)
- No match: "No tasks match your search." in place of the list
- Search failed: "Could not search your tasks." with a Retry button that re-runs the same query (DEC-206); add is hidden until the search succeeds. A failed first load keeps its own message and offers no search
- Save-failed message after rollback
- Session expired / missing → redirect to /signin

## Consumes Endpoints

- Current user (route guard) — ../../../../../../backend/context/code-context/backend/domains/auth/endpoints/get-current-user.md (EP-AUTH-04)
- Sign out — ../../../../../../backend/context/code-context/backend/domains/auth/endpoints/logout.md (EP-AUTH-03)
- List tasks, optionally by title via the search query parameter — ../../../../../../backend/context/code-context/backend/domains/task/endpoints/list-tasks.md (EP-TASK-01)
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

- Task: Task-22 Search tasks by title (decisions DEC-206, DEC-207, DEC-208)
- Feature: FEAT-TASK-01, FEAT-TASK-02, FEAT-TASK-03, FEAT-AUTH-02, FEAT-PLAT-01, FEAT-PLAT-02
- Workflow: WF-002, WF-003
- Business rules: BR-008, BR-010, BR-016, BR-018, BR-023, BR-025, BR-026
- [code › src/auth/RequireAuth.tsx:6] (session guard, FEAT-AUTH-02)
- [code › src/components/LogOutButton.tsx:7] (Log out control, FEAT-AUTH-02)
- [test › src/auth/RequireAuth.test.tsx]
- [test › src/components/LogOutButton.test.tsx]
- [code › src/lib/useInstantUpdate.ts] (shared optimistic update and rollback, FEAT-PLAT-01)
- [code › src/components/FailureNotice.tsx] (single failure-message region, FEAT-PLAT-01)
- [code › src/tasks/taskState.ts] (pure list reducers, FEAT-PLAT-01)
- [test › src/lib/useInstantUpdate.test.ts]
- [code › src/pages/TaskListPage.tsx] (list, empty and load-failed states and the add form, FEAT-TASK-01)
- [code › src/tasks/TasksProvider.tsx] (in-memory list state and optimistic add, FEAT-TASK-01)
- [code › src/components/AddTaskForm.tsx] (add form, 200 limit, FEAT-TASK-01)
- [code › src/components/TaskRow.tsx] (row with Pending or Completed words, FEAT-TASK-01)
- [test › src/pages/TaskListPage.test.tsx]
- [test › e2e/task-list.spec.ts]
- [code › src/components/TaskRow.tsx] (tick control and title edit, FEAT-TASK-02)
- [code › src/tasks/TasksProvider.tsx] (toggleStatus, editTitle with stored-value rollback, FEAT-TASK-02)
- [test › src/components/TaskRow.edit.test.tsx]
- [test › src/pages/TaskListPage.update.test.tsx]
- [test › e2e/task-edit.spec.ts]
- [code › src/tasks/usePendingDelete.ts] (delete with a 5 second Undo window, FEAT-TASK-03)
- [code › src/components/UndoMessage.tsx] (Task deleted, then Undo, FEAT-TASK-03)
- [code › src/tasks/pendingFlush.ts] (Log out sends a held deletion and waits for it, FEAT-TASK-03)
- [test › src/pages/TaskListPage.logout.test.tsx]
- [test › src/tasks/usePendingDelete.test.tsx]
- [test › src/pages/TaskListPage.delete.test.tsx]
- [test › e2e/task-delete.spec.ts]
- [code › src/components/TaskSearch.tsx] (search box and live region, Task-22)
- [code › src/tasks/TasksProvider.tsx] (debounced query, abort and stale-response drop, search states, Task-22)
- [code › src/components/TaskListStates.tsx] (no-match and search-failed with Retry, Task-22)
- [code › src/api/tasks.ts] (listTasks search option, Task-22)
- [test › src/components/TaskSearch.test.tsx]
- [test › src/pages/TaskListPage.search.test.tsx]
- [test › e2e/task-search.spec.ts]
