import { http, HttpResponse } from 'msw';
import type { Tag, TagColour, Task } from '../../api/types';
import { listBodyFor } from './tasks';

/** The tag rules and refusal messages exactly as the server applies them (plan section 3). */
export const TAG_MESSAGES = {
  empty: 'Enter a tag name.',
  tooLong: 'Tag names can be at most 30 characters.',
  duplicate: 'You already have a tag with that name.',
  tooMany: 'You can have up to 50 tags.',
  ownTags: 'Tags must be your own tags.',
  taskLimit: 'A task can have up to 5 tags.',
} as const;

const TAG_NAME_MAX = 30;
const TAG_LIMIT = 50;
let tagSequence = 0;

/** A tag as the tag operations return it; override only what the test cares about. */
export function buildTag(overrides: Partial<Tag> = {}): Tag {
  tagSequence += 1;
  return {
    id: `tag-${tagSequence}`,
    name: `Tag ${tagSequence}`,
    colour: 'gray' as TagColour,
    taskCount: 0,
    ...overrides,
  };
}

export const listTagsEmpty = http.get('/api/tags', () => HttpResponse.json({ tags: [] }));

export const listTagsWith = (tags: Tag[]) =>
  http.get('/api/tags', () => HttpResponse.json({ tags }));

export const listTagsFails = (status = 500) =>
  http.get('/api/tags', () =>
    HttpResponse.json(
      { error: { code: 'INTERNAL', message: 'Something went wrong.' } },
      { status },
    ),
  );

const nameRefusal = (message: string) =>
  HttpResponse.json(
    {
      error: {
        code: 'VALIDATION',
        message: 'Check the highlighted field.',
        fields: { name: message },
      },
    },
    { status: 400 },
  );

/** What the server answers for a new tag name over the stored tags: a refusal body or null when fine. */
export function checkNewName(stored: Tag[], sent: unknown): string | null {
  const name = typeof sent === 'string' ? sent.trim() : '';
  if (name === '') return TAG_MESSAGES.empty;
  if (name.length > TAG_NAME_MAX) return TAG_MESSAGES.tooLong;
  if (stored.some((tag) => tag.name.toLowerCase() === name.toLowerCase()))
    return TAG_MESSAGES.duplicate;
  if (stored.length >= TAG_LIMIT) return TAG_MESSAGES.tooMany;
  return null;
}

/** GET and POST /api/tags over a stored list: POST applies the §3 name rules and stores a gray tag. */
export const tagsStoring = (stored: Tag[]) => [
  http.get('/api/tags', () =>
    HttpResponse.json({
      tags: [...stored].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())),
    }),
  ),
  http.post('/api/tags', async ({ request }) => {
    const body = (await request.json()) as { name?: unknown; colour?: TagColour };
    const refusal = checkNewName(stored, body.name);
    if (refusal) return nameRefusal(refusal);
    const tag = buildTag({ name: String(body.name).trim(), colour: body.colour ?? 'gray' });
    stored.push(tag);
    return HttpResponse.json({ tag }, { status: 201 });
  }),
];

const TASK_TAG_LIMIT = 5;

const tagIdsRefusal = (message: string) =>
  HttpResponse.json(
    {
      error: {
        code: 'VALIDATION',
        message: 'Check the highlighted field.',
        fields: { tagIds: message },
      },
    },
    { status: 400 },
  );

/**
 * PATCH /api/tasks/:id over stored tasks and tags: applies the section 3 tagIds rules (own tags
 * only, at most 5 distinct, whole-list replace), keeps what it was told and answers the whole task.
 */
export const taskTagsStoring = (tasks: Task[], tags: Tag[]) =>
  http.patch('/api/tasks/:id', async ({ request, params }) => {
    const patch = (await request.json()) as { tagIds?: string[] } & Record<string, unknown>;
    const task = tasks.find((t) => t.id === params.id);
    if (!task) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Task not found.' } },
        { status: 404 },
      );
    }
    const { tagIds, ...rest } = patch;
    if (tagIds !== undefined) {
      const distinct = [...new Set(tagIds)];
      const chosen = distinct.map((id) => tags.find((tag) => tag.id === id));
      if (chosen.some((tag) => tag === undefined)) return tagIdsRefusal(TAG_MESSAGES.ownTags);
      if (distinct.length > TASK_TAG_LIMIT) return tagIdsRefusal(TAG_MESSAGES.taskLimit);
      task.tags = (chosen as Tag[])
        .map(({ id, name, colour }) => ({ id, name, colour }))
        .sort((x, y) => x.name.toLowerCase().localeCompare(y.name.toLowerCase()));
    }
    Object.assign(task, rest);
    return HttpResponse.json({ task });
  });

/**
 * GET /api/tasks over stored tasks and tags, as the server answers the tag filter: a tag id the
 * caller does not own (or no such id) is a 400 naming `tag`, `none` and an own id narrow the list.
 */
export const listTasksWithTags = (tasks: Task[], tags: Tag[]) =>
  http.get('/api/tasks', ({ request }) => {
    const query = new URL(request.url).searchParams;
    const tag = query.get('tag');
    if (tag !== null && tag !== 'none' && !tags.some((own) => own.id === tag)) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION',
            message: 'Check the highlighted field.',
            fields: { tag: 'Tag must be none or one of your own tags.' },
          },
        },
        { status: 400 },
      );
    }
    return HttpResponse.json(listBodyFor(tasks, query));
  });

const MANAGE_MESSAGES = {
  colour: 'Colour must be gray, red, orange, green, blue or purple.',
  body: 'Provide a name or a colour.',
  notFound: 'Tag not found.',
} as const;
const COLOURS = ['gray', 'red', 'orange', 'green', 'blue', 'purple'];

const notFoundTag = () =>
  HttpResponse.json(
    { error: { code: 'NOT_FOUND', message: MANAGE_MESSAGES.notFound } },
    { status: 404 },
  );

const fieldRefusal = (field: 'name' | 'colour' | 'body', message: string) =>
  HttpResponse.json(
    {
      error: {
        code: 'VALIDATION',
        message: 'Check the highlighted field.',
        fields: { [field]: message },
      },
    },
    { status: 400 },
  );

/** The tags as GET answers them: sorted by name, each with how many of the stored tasks carry it. */
const withCounts = (tags: Tag[], tasks: Task[]): Tag[] =>
  [...tags]
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
    .map((tag) => ({
      ...tag,
      taskCount: tasks.filter((t) => t.tags.some((x) => x.id === tag.id)).length,
    }));

/** The rename and recolour rules of section 3, over the stored tags: a refusal body, or null when fine. */
function refuseChange(tags: Tag[], self: Tag, body: { name?: unknown; colour?: unknown }) {
  if (body.name === undefined && body.colour === undefined)
    return fieldRefusal('body', MANAGE_MESSAGES.body);
  if (body.colour !== undefined && !COLOURS.includes(String(body.colour))) {
    return fieldRefusal('colour', MANAGE_MESSAGES.colour);
  }
  if (body.name === undefined) return null;
  const others = tags.filter((tag) => tag.id !== self.id);
  const refusal = checkNewName(others, body.name);
  return refusal && refusal !== TAG_MESSAGES.tooMany ? fieldRefusal('name', refusal) : null;
}

/**
 * The whole tag API over stored tags and tasks: GET with live counts, POST, PATCH (rename and
 * recolour, the case-only rename of a tag to itself allowed) and DELETE (the tag leaves every task).
 */
export const tagsManaging = (tags: Tag[], tasks: Task[]) => [
  http.get('/api/tags', () => HttpResponse.json({ tags: withCounts(tags, tasks) })),
  http.post('/api/tags', async ({ request }) => {
    const body = (await request.json()) as { name?: unknown };
    const refusal = checkNewName(tags, body.name);
    if (refusal) return nameRefusal(refusal);
    const tag = buildTag({ name: String(body.name).trim() });
    tags.push(tag);
    return HttpResponse.json({ tag }, { status: 201 });
  }),
  http.patch('/api/tags/:id', async ({ request, params }) => {
    const tag = tags.find((t) => t.id === params.id);
    if (!tag) return notFoundTag();
    const body = (await request.json()) as { name?: unknown; colour?: unknown };
    const refusal = refuseChange(tags, tag, body);
    if (refusal) return refusal;
    if (body.name !== undefined) tag.name = String(body.name).trim();
    if (body.colour !== undefined) tag.colour = body.colour as TagColour;
    tasks.forEach((task) => {
      task.tags = task.tags.map((own) =>
        own.id === tag.id ? { id: tag.id, name: tag.name, colour: tag.colour } : own,
      );
    });
    return HttpResponse.json({ tag: withCounts(tags, tasks).find((t) => t.id === tag.id) });
  }),
  http.delete('/api/tags/:id', ({ params }) => {
    const at = tags.findIndex((t) => t.id === params.id);
    if (at === -1) return notFoundTag();
    tags.splice(at, 1);
    tasks.forEach((task) => {
      task.tags = task.tags.filter((own) => own.id !== params.id);
    });
    return new HttpResponse(null, { status: 204 });
  }),
];
