import { http, HttpResponse } from 'msw';
import type { Task } from '../../api/types';

/** Backend refusal bodies exactly as the API sends them (plan section 3). */
export const serverErrorBody = { error: { code: 'INTERNAL', message: 'Something went wrong.' } };

export const listTasksEmpty = http.get('/api/tasks', () => HttpResponse.json({ tasks: [] }));

/** The list as the API sends it: newest first, wrapped. */
export const listTasksWith = (tasks: Task[]) =>
  http.get('/api/tasks', () => HttpResponse.json({ tasks }));

export const listTasksFails = (status = 500) =>
  http.get('/api/tasks', () => HttpResponse.json(serverErrorBody, { status }));

export const createTaskReturning = (task: Task) =>
  http.post('/api/tasks', () => HttpResponse.json({ task }, { status: 201 }));

export const createTaskFails = (status = 500) =>
  http.post('/api/tasks', () => HttpResponse.json(serverErrorBody, { status }));

export const deleteTaskNoContent = http.delete(
  '/api/tasks/:id',
  () => new HttpResponse(null, { status: 204 }),
);

export const deleteTaskFails = (status = 500) =>
  http.delete('/api/tasks/:id', () => HttpResponse.json(serverErrorBody, { status }));

const addDays = (date: string, days: number): string => {
  const [year, month, day] = date.split('-').map(Number);
  const moved = new Date(Date.UTC(year, month - 1, day + days));
  return moved.toISOString().slice(0, 10);
};

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

/** The due filter as the server defines it: overdue is pending and before today; week is today to today+6. */
function matchesDue(task: Task, due: string | null, today: string): boolean {
  if (due === 'overdue')
    return task.status === 'pending' && task.dueDate !== null && task.dueDate < today;
  if (due === 'today') return task.dueDate === today;
  if (due === 'week')
    return task.dueDate !== null && task.dueDate >= today && task.dueDate <= addDays(today, 6);
  if (due === 'none') return task.dueDate === null;
  return true;
}

/** The given (newest-first) order for newest; due and priority reorder it, ties falling back to newest first. */
function ordered(tasks: Task[], sort: string | null): Task[] {
  if (sort !== 'due' && sort !== 'priority') return tasks;
  const newest = (a: Task, b: Task) => b.createdAt.localeCompare(a.createdAt);
  const byDue = (a: Task, b: Task) => {
    if (a.dueDate === b.dueDate) return 0;
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  };
  const byPriority = (a: Task, b: Task) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  const primary = sort === 'due' ? byDue : byPriority;
  return [...tasks].sort((a, b) => primary(a, b) || newest(a, b));
}

/**
 * The list body the way the server answers it: owner's tasks narrowed by search (trimmed, case-insensitive
 * literal title substring), status, priority and due, ordered by sort, with `overdueCount` (pending
 * tasks before today, ignoring every filter) whenever `today` is sent. The tasks are given newest
 * first; a stored row with no priority is already Medium by the builder, as the DTO reads it.
 */
export function listBodyFor(
  tasks: Task[],
  query: URLSearchParams,
): { tasks: Task[]; overdueCount?: number } {
  const text = (query.get('search') ?? '').trim().toLowerCase();
  const today = query.get('today');
  const status = query.get('status');
  const priority = query.get('priority');
  const matches = tasks.filter(
    (t) =>
      (text === '' || t.title.toLowerCase().includes(text)) &&
      (status === null || t.status === status) &&
      (priority === null || t.priority === priority) &&
      (today === null || matchesDue(t, query.get('due'), today)),
  );
  const body: { tasks: Task[]; overdueCount?: number } = {
    tasks: ordered(matches, query.get('sort')),
  };
  if (today !== null) {
    body.overdueCount = tasks.filter((t) => matchesDue(t, 'overdue', today)).length;
  }
  return body;
}

export const listTasksMatching = (tasks: Task[]) =>
  http.get('/api/tasks', ({ request }) =>
    HttpResponse.json(listBodyFor(tasks, new URL(request.url).searchParams)),
  );

/** The server's cap, in UTF-16 units: `.length`, never code points (DEC-240). */
const SERVER_NOTES_MAX = 1000;

/** The notes rule and refusal messages exactly as the server applies them (plan section 3, DEC-240). */
export const NOTES_MESSAGES = {
  type: 'Notes must be text.',
  tooLong: 'Notes can be at most 1000 characters.',
} as const;

/** What the server stores for a sent value: trimmed text, `''` and whitespace as null, or a refusal. */
export function applyNotesRule(
  sent: unknown,
): { ok: true; notes: string | null } | { ok: false; message: string } {
  if (sent === null || sent === undefined) return { ok: true, notes: null };
  if (typeof sent !== 'string') return { ok: false, message: NOTES_MESSAGES.type };
  const trimmed = sent.trim();
  if (trimmed.length > SERVER_NOTES_MAX) return { ok: false, message: NOTES_MESSAGES.tooLong };
  return { ok: true, notes: trimmed === '' ? null : trimmed };
}

const notesRefusal = (message: string) =>
  HttpResponse.json(
    {
      error: {
        code: 'VALIDATION',
        message: 'Check the highlighted field.',
        fields: { notes: message },
      },
    },
    { status: 400 },
  );

/**
 * PATCH /api/tasks/:id over a stored list: applies the notes rule, keeps what was stored (so a
 * reload shows stored truth) and answers with the whole task. Search stays on titles (AC-4).
 */
export const updateTaskStoring = (stored: Task[]) =>
  http.patch('/api/tasks/:id', async ({ request, params }) => {
    const patch = (await request.json()) as Record<string, unknown>;
    const task = stored.find((t) => t.id === params.id);
    if (!task)
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Not found.' } },
        { status: 404 },
      );
    if ('notes' in patch) {
      const checked = applyNotesRule(patch.notes);
      if (!checked.ok) return notesRefusal(checked.message);
      patch.notes = checked.notes;
    }
    Object.assign(task, patch);
    return HttpResponse.json({ task });
  });
