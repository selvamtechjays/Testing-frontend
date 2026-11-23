---
doc_type: page
schema_version: 1.1
produced_by: tl
page_id: PAGE-TASK-01
status: Active
implementation_state: Implemented
origin: implemented
design_confidence: Confirmed
implemented_at: 2026-11-20T12:40:00Z
implemented_by_commit: pending
implemented_by_task: FEAT-TASK-01-2, FEAT-TASK-02-2, FEAT-TASK-03-2, FEAT-PLAT-01-2, Task-22, Task-23, Task-24, FEAT-TAG-03-2, FEAT-TAG-04-2, FEAT-TAG-02-2
mapped_from: src/pages/TaskListPage.tsx
mapped_from_line: 143
mapped_from_commit: pending
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
- Due date and priority (Task-23): the add form gains a labelled native date input (picker capped at local today + 5 years, DEC-211; a typed date beyond the cap is refused with the alert "A due date can be at most five years ahead.", on the add form and on a row) and a labelled Priority select with Medium preselected; both reset after an add and a skipped pair still adds in one step. Each row shows its priority as a word ("High priority") and its due text: "Overdue" for a pending task before today, "Due today", or "Due <date>"; a completed row never reads Overdue. Each row has a "Due date for <title>" input, a "Clear date for <title>" button and a "Priority for <title>" select; every change shows at once and goes through the shared optimistic path (changeDueDate, changePriority), rolling back to the confirmed value with the usual failure message if the save is refused. "Today" is built from the local year, month and day, never from toISOString, and is sent as `today` on every list request (DEC-214, DEC-218).
- Filters and sort (Task-23): a labelled group of four native selects (Status, Priority, Due, Sort) sits under the search box. A change applies at once with no debounce, aborts the request in flight, and is remembered for this user on this device under `tasknest-filters:<userId>`; the search text is never stored (DEC-217). Clear filters shows only while a choice differs from its default (a sort counts), restores the defaults and keeps the search text. Only status, priority and due narrow the list: a sort alone on an empty list is the first-task prompt, never "No tasks match your filters." (DEC-236). "Today" is also re-read when the tab turns visible or the window regains focus, and sets the date boxes' cap and each row's due words. Results are never re-filtered on the client (extends DEC-207).
- Overdue summary (Task-23): a real button "N overdue", hidden at 0, counts every pending overdue task whatever the filters or search (DEC-212). Selecting it sets Due to Overdue and resets Status to All (overdue tasks are always pending), keeping Priority, Sort and the search text (DEC-234). The count comes from the last list response and moves by overdueDelta after each confirmed add, edit or delete (DEC-219); a response's number is taken only if no change started, settled or is still saving since its request, and a task whose delete is held or saving stays out of every reload (DEC-235).
- Task notes (Task-24): every row has a Notes button named "Notes for <title>" (`aria-expanded`, and `aria-controls` pointing at the panel while it is open; off while the row's add is unsaved or the row is leaving) and, when the task has notes, a "Has notes" chip beside its status, priority and due words. The button opens a panel inside the row, below its fields: a labelled textarea ("Notes for <title>", `maxLength` 1000, newlines allowed, focused on open), a "N characters left" line tied to it by `aria-describedby` (announced politely only at 0), and Save, Cancel and, when notes are saved, Clear notes. Save sends `{ notes }` through the shared optimistic path (`changeNotes`) only when the trimmed text differs from the saved notes (empty or spaces = null = no notes, DEC-240), closes the panel and returns focus to that row's Notes button (DEC-239); a refused save restores the confirmed notes with the usual failure message. Clear notes swaps the buttons for an in-panel "Clear these notes?" confirmation (Clear notes / Keep notes; Keep returns focus to Clear notes). Only one panel is open at a time, held by `TaskList` (`openId`). Escape, handled on the panel and never on the document, backs out of the confirmation or otherwise closes like Cancel. Any close that loses a typed change (Escape, Cancel, Notes pressed on the open row, opening another row's panel, the open row leaving the list) sets one polite line, "Your changes to the notes were not saved.", cleared when any panel opens (DEC-238, DEC-242, DEC-251). The draft follows a changed saved value only while the box holds no unsaved change. Search never looks at notes; adding a task stays one step (no notes on the add form).
- Theme (Task-21): a sun/moon toggle in the header, on every screen, switches light and dark; the choice is kept on this device, and the default follows the device setting.

## Task tags (FEAT-TAG-03, FEAT-TAG-04 and FEAT-TAG-02 built)

Built by FEAT-TAG-03, FEAT-TAG-04 and FEAT-TAG-02 (DEC-260 to DEC-265, DEC-280 onward). All of it lives on this page as sections and row parts, not as new routes; the bullets below are the design and the "As built" bullets say what the code does. Read `.jetrix/shared-context/ui-standards.md` before building: tokens only, 44px targets, light and dark through tokens, 360px, keyboard.

- Tag chips (FEAT-TAG-03, FEAT-TAG-04): each saved row shows its tags as chips sorted by name, name always visible, wrap at 360px, a long name shortened with an ellipsis and the full name as accessible name and tooltip. On a saved row a chip is a real button that applies that tag as the Tag filter (not a toggle); on an unsaved or leaving row it is plain text. Colour never stands alone.
- Tags control and picker (FEAT-TAG-03): a Tags button on each saved row (not on an unsaved or leaving row) opens a panel in the row with a checkbox per tag, ticked for the task's tags, and a "Create tag" field. Tick or untick shows at once and saves the task's full `tagIds` through the shared optimistic path (`useInstantUpdate`), rolling back with the one failure message. At 5 tags the unticked boxes are disabled with "A task can have up to 5 tags."; at 50 tags the Create tag field is disabled with "You can have up to 50 tags.". Enter on a name that matches an existing tag ignoring case ticks it; otherwise it creates a gray tag (EP-TAG-02) then adds it (one step for the user); if adding fails the tag stays, unticked. Escape closes the picker and returns focus to the row's Tags button; one row panel (notes or picker) is open at a time, held by `TaskList` `openId` as notes already is (ASM-052). The add form gains no tags field.
- Tag filter (FEAT-TAG-04): a fifth select in the filter bar (Any, No tags, each tag by name) that applies at once, aborts the request in flight, counts as narrowing for Clear filters and is remembered with the other filters under `tasknest-filters:<userId>`; a remembered tag that no longer exists, or a stored value from before tags, reads as Any with no message. `tag` is sent on list requests. "N overdue" ignores it and selecting "N overdue" keeps it.
- Manage tags panel (FEAT-TAG-02): opened from the filter bar; lists tags (colour, name, task count) read from EP-TAG-01 each time it opens; rename and recolour are server-first (the screen, the picker and every row's chips change together only after EP-TAG-03 accepts; a refusal shows the server's message beside the field); delete asks in the panel "Delete tag "X"? It will be removed from N tasks. The tasks are kept." with Delete and Keep (no browser dialogs; N from a fresh EP-TAG-01 read); the screen changes only after EP-TAG-04 confirms, and a Tag filter set to that tag returns to Any at once. Empty state: "No tags yet. Create one from a task's Tags picker." with no Create control.
- Shared tag state (DEC-265): one in-memory tag list owned by the tasks provider feeds the picker, the Tag filter, the panel and the chips; a 400 or 404 about a tag refreshes it quietly, and a list response that lands after a tick never undoes it (ASM-056, ASM-063).
- As built (FEAT-TAG-03, Subtask-30): the tag chips, the Tags picker, the shared tag state and the six colour pairs described above are in the code. `TasksProvider` loads `GET /api/tags` once on mount (`tags`, `tagsStatus` loading, ready or failed, `refreshTags`), and `useTagActions` holds `changeTags` (the shared optimistic path, sending `{ tagIds }` as the whole list) and `createTagAndTick` (match ignoring case and tick, else `POST /api/tags` with the name as typed, then tick; a duplicate refusal refreshes the tags and ticks the match; a task already at 5 tags keeps the new tag unticked with the failure notice). `TaskList` holds one open panel `{ id, kind: notes or tags }`; the tags picker is `TaskTagsPanel` (checkbox per tag, "A task can have up to 5 tags.", Create tag field, Escape handled on the panel, Tags button toggles it closed). `taskState.changedSince` and `mergeSearchResult` carry `tags`, so a late list response never undoes a tick. Chips are `TagChips` (spans in this task; buttons arrive with FEAT-TAG-04). Colour tokens `--tag-<colour>-bg` and `--tag-<colour>-fg` live in `src/index.css`, measured at 6.38:1 and above for the text and 6.29:1 and above for the boundary in both themes (`cssStandard.test.ts`).
- As built (FEAT-TAG-04, Subtask-32): `ListFilters` gains `tag` (`any`, `none` or a 24-hex tag id; default `any`), remembered under `tasknest-filters:<userId>` with the other choices; an object stored before tags, or a malformed `tag`, reads as `any` with the other choices kept. `listTasks` sends `tag` only when it is not `any`. The filter bar has a fifth labelled select "Tag" (`tagFilterOptions`: Any, No tags, each tag by name) that applies at once through the shared filter path, and `filtersNarrowing` counts the tag, so Clear filters shows with the tag alone. `useTagFilter` holds a remembered tag id back until the tag list answers and turns one the list does not hold into Any before any filtered request (no message); a list request refused with a 400 naming `tag` shows the failure notice, refreshes the tags and the filter returns to Any once the tag is gone from them. `TasksValue.selectTag(id)` (a chip was chosen; keeps search and the other filters; no request when it is already the filter) and `tagDeleted(id)` (for Manage tags) are exposed. `TagChips` renders real buttons (44px target) on a saved, non-leaving row and plain text otherwise; the "N overdue" button leaves the tag alone and the count ignores it.
- As built (FEAT-TAG-02, Subtask-34): a "Manage tags" button in the filter bar (`aria-expanded`, `aria-controls` pointing at `manage-tags-panel` while open) toggles `ManageTagsPanel`, mounted below the filter bar only while open so it reads `GET /api/tags` afresh each time (`onRefresh`) and moves focus to its heading. Each tag is a group with a colour swatch, a name box (30-character `maxLength`; Save or Enter sends the trimmed text, nothing when unchanged), the task count, a colour select (the six colours by name) and Delete; the name is always shown beside the swatch. `useTagManagement` holds `updateTag`, `deleteTag` and `freshTaskCount`, all server-first: nothing on screen changes until the server answers, then one update replaces the tag in the list and in every task's chips (and in the confirmed copies a rollback restores) re-sorted by name; a 400 returns the server's message to show beside the field with no notice; a 404 shows the shared failure notice and refreshes the tags quietly; any other failure changes nothing and shows the notice (a 401 is routed once by the client). Delete reads a fresh count, then shows "Delete tag "X"? It will be removed from N tasks. The tasks are kept." in place of the row controls with Delete and Keep (Keep sends nothing and returns focus to that Delete button); a delete that is accepted also calls `tagDeleted`, so a Tag filter on that tag returns to Any at once. Escape, handled on the panel, closes the question first, then the panel and returns focus to the Manage tags button; one panel is open at a time across the Manage panel and the row panels (`TaskList` `manageOpen` and `onRowPanelOpened`). With no tags it reads "No tags yet. Create one from a task's Tags picker." with no Create control.
- Colours (OQ-TAG-01, resolved at build by ASM-072): six chip colour token pairs per theme, each pair measured to the 4.5:1 text and 3:1 boundary floors in `ui-standards.md` §3 before it goes in. OQ-TAG-02 (panel and picker open together) and OQ-TAG-03 (unticking the active filter's tag on a row) are open BA questions that Stage 3 treats as plan blockers.

## Page States

- Loading (initial fetch)
- Empty list with a prompt to add a first task
- Populated list (Pending and Completed rows)
- Title validation message (empty / over 200)
- Undo message visible (5 seconds)
- Search box with a result list (matches only)
- No match: "No tasks match your search." in place of the list
- Search failed: "Could not search your tasks." with a Retry button that re-runs the same query (DEC-206); add is hidden until the search succeeds. A failed first load keeps its own message and offers no search
- Filters active with a list: the filter bar shows Clear filters; the polite status region reads "N tasks found."
- No filter match: "No tasks match your filters." with a Clear filters button (when filters are active; search-only no match keeps the search text)
- Overdue summary visible ("N overdue") above the list
- Row with the "Has notes" chip; row with its notes panel open (editing, or confirming "Clear these notes?"); the not-saved line after a panel closed with a typed change
- Save-failed message after rollback
- Session expired / missing → redirect to /signin

## Consumes Endpoints

- Current user (route guard) — ../../../../../../backend/context/code-context/backend/domains/auth/endpoints/get-current-user.md (EP-AUTH-04)
- Sign out — ../../../../../../backend/context/code-context/backend/domains/auth/endpoints/logout.md (EP-AUTH-03)
- List tasks, narrowed by title search, status, priority and due, ordered by sort, with `today` on every call and `overdueCount` in the answer — ../../../../../../backend/context/code-context/backend/domains/task/endpoints/list-tasks.md (EP-TASK-01)
- Create task — ../../../../../../backend/context/code-context/backend/domains/task/endpoints/create-task.md (EP-TASK-02)
- Update task (title, status, due date, priority and notes, `notes: null` clears) — ../../../../../../backend/context/code-context/backend/domains/task/endpoints/update-task.md (EP-TASK-03)
- Delete task — ../../../../../../backend/context/code-context/backend/domains/task/endpoints/delete-task.md (EP-TASK-04)
- List tags (tags and task counts for the picker, the Tag filter and Manage tags; planned) — ../../../../../../backend/context/code-context/backend/domains/tag/endpoints/list-tags.md (EP-TAG-01)
- Create tag (the picker's Create tag field only; planned) — ../../../../../../backend/context/code-context/backend/domains/tag/endpoints/create-tag.md (EP-TAG-02)
- Rename or recolour tag (Manage tags; planned) — ../../../../../../backend/context/code-context/backend/domains/tag/endpoints/update-tag.md (EP-TAG-03)
- Delete tag (Manage tags; planned) — ../../../../../../backend/context/code-context/backend/domains/tag/endpoints/delete-tag.md (EP-TAG-04)

## Used by Features

- FEAT-TASK-01 Task List and Add Task
- FEAT-TASK-02 Edit and Complete Task
- FEAT-TASK-03 Delete Task with Undo
- FEAT-AUTH-02 Sign In and Sign Out (Log out control, session guard)
- FEAT-PLAT-01 Instant Update with Rollback
- FEAT-PLAT-02 Platform Baseline (applies to every screen)
- FEAT-TAG-03 Tag tasks from the task list (built, Subtask-30)
- FEAT-TAG-04 Filter the task list by tag (built, Subtask-32)
- FEAT-TAG-02 Manage tags (built, Subtask-34)

## Permissions

- Signed-in user only; sees only their own tasks (BR-025). No admin view (DEC-031, DEC-042).

## Open Questions

- OQ-TASK-01 | Delete inside the Undo window then tab close: lost or flushed? | TL / Client | Deferred-delete design (see EP-TASK-04) | Open (non-blocking)

## Source References

- Task: Task-22 Search tasks by title (decisions DEC-206, DEC-207, DEC-208)
- Task: Task-24 Task notes (decisions DEC-237 to DEC-242, DEC-250, DEC-251)
- Task: Task-23 Due dates, priority, and list filters (decisions DEC-210 to DEC-219, DEC-230 to DEC-232)
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
- [code › src/lib/localDate.ts] (local today, dueState, formatDueDate, five-year picker cap, Task-23)
- [code › src/tasks/listFilters.ts] (filter defaults and per-user memory, Task-23)
- [code › src/tasks/taskState.ts] (overdueDelta, Task-23)
- [code › src/tasks/TasksProvider.tsx] (filters applied at once, today on every request, changeDueDate and changePriority, overdue count, Task-23)
- [code › src/components/TaskFilterBar.tsx] (four selects and Clear filters, Task-23)
- [code › src/components/OverdueSummary.tsx] (N overdue button, Task-23)
- [code › src/components/SelectField.tsx] (shared labelled select, Task-23)
- [code › src/components/AddTaskForm.tsx] (date and priority fields, Task-23)
- [code › src/components/TaskRow.tsx] (priority and due words, date and priority controls, Task-23)
- [code › src/components/TaskListStates.tsx] (filter no-match with Clear filters, Task-23)
- [code › src/api/tasks.ts] (filters, today and overdueCount on listTasks; dueDate and priority on create and update, Task-23)
- [code › src/tasks/filterOptions.ts] (the filter option lists shared by the bar and the stored-filter check, Task-23)
- [code › src/components/TextField.tsx] (date mode with cap, inline error and hidden label, used by both date fields, Task-23)
- [test › src/lib/localDate.test.ts]
- [test › src/tasks/listFilters.test.ts]
- [test › src/components/TaskFilterBar.test.tsx]
- [test › src/components/OverdueSummary.test.tsx]
- [test › src/pages/TaskListPage.filters.test.tsx]
- [test › e2e/task-due-priority.spec.ts]
- [code › src/components/TaskNotesPanel.tsx] (notes panel: textarea, character count, Save, Cancel, Clear notes confirmation, Escape, Task-24)
- [code › src/validation/notes.ts] (NOTES_MAX, normaliseNotes, notesLeft, Task-24)
- [code › src/components/TaskList.tsx] (open panel id and the not-saved line, Task-24)
- [code › src/components/TaskRow.tsx] (Has notes chip, Notes button, panel mount and focus return, Task-24)
- [code › src/tasks/TasksProvider.tsx] (changeNotes through the shared optimistic path, Task-24)
- [code › src/api/tasks.ts] (notes on Task, TaskPatch and toTask, Task-24)
- [test › src/components/TaskNotesPanel.test.tsx]
- [test › src/components/TaskRow.notes.test.tsx]
- [test › src/pages/TaskListPage.notes.test.tsx]
- [test › src/validation/notes.test.ts]
- [test › e2e/task-notes.spec.ts]
- [code › src/components/TagChips.tsx] (named colour chips, FEAT-TAG-03)
- [code › src/components/TaskTagsPanel.tsx] (tags picker and Create tag, FEAT-TAG-03)
- [code › src/components/useTagsRow.tsx] (Tags button, picker mount and focus return, FEAT-TAG-03)
- [code › src/tasks/useTagList.ts] (the one tag list, FEAT-TAG-03)
- [code › src/tasks/useTagActions.ts] (changeTags and createTagAndTick, FEAT-TAG-03)
- [code › src/api/tags.ts] (listTags and createTag, FEAT-TAG-03)
- [test › src/tasks/useTasks.tags.test.tsx]
- [test › src/pages/TaskListPage.tags.test.tsx]
- [test › src/components/TaskTagsPanel.test.tsx]
- [test › e2e/task-tags.spec.ts]
- [code › src/tasks/useTagFilter.ts] (remembered-tag gate, refused-tag recovery, selectTag, tagDeleted, FEAT-TAG-04)
- [code › src/tasks/listFilters.ts] (tag in the stored filters, isTagId, FEAT-TAG-04)
- [code › src/tasks/filterOptions.ts] (tagFilterOptions, FEAT-TAG-04)
- [code › src/components/TaskFilterBar.tsx] (the Tag select, FEAT-TAG-04)
- [code › src/components/TagChips.tsx] (selectable chips as buttons, FEAT-TAG-04)
- [test › src/tasks/useTasks.tagfilter.test.tsx]
- [test › src/pages/TaskListPage.tag-filter.test.tsx]
- [test › e2e/task-tag-filter.spec.ts]
- [code › src/components/ManageTagsPanel.tsx] (Manage tags panel, FEAT-TAG-02)
- [code › src/components/useManageTags.ts] (drafts, errors, busy, the delete question, FEAT-TAG-02)
- [code › src/tasks/useTagManagement.ts] (updateTag, deleteTag, freshTaskCount, FEAT-TAG-02)
- [code › src/api/tags.ts] (updateTag and deleteTag, FEAT-TAG-02)
- [code › src/pages/TaskListPage.tsx] (Manage tags button wiring and the one-panel rule, FEAT-TAG-02)
- [test › src/components/ManageTagsPanel.test.tsx]
- [test › src/tasks/useTasks.tagmanage.test.tsx]
- [test › src/pages/TaskListPage.manage-tags.test.tsx]
- [test › e2e/task-manage-tags.spec.ts]
- Requirement: task-tags — FEAT-TAG-02, FEAT-TAG-03, FEAT-TAG-04 (DEC-260 to DEC-265, DEC-280 onward; all three built)
