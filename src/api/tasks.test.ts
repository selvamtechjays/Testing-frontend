// tier: integration
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../test/mocks/server';
import { buildTask } from '../test/builders/task';
import { ApiError, setUnauthorizedHandler } from './client';
import { createTask, deleteTask, listTasks, updateTask } from './tasks';

describe('tasks from a server that leaves out the due date and priority', () => {
  // An API older than Task-23 (or a row written before it) sends neither field. Unnormalised,
  // `dueDate` arrives as undefined and the row crashed formatting it (fix-review round 1).
  const bare = {
    id: 'old-1',
    title: 'Pay rent',
    status: 'pending',
    createdAt: '2026-11-07T12:00:00.000Z',
  };
  const normalised = { ...bare, dueDate: null, priority: 'medium' };

  it('reads them as no due date and Medium from the list (DEC-210)', async () => {
    server.use(http.get('/api/tasks', () => HttpResponse.json({ tasks: [bare] })));
    await expect(listTasks()).resolves.toEqual({ tasks: [normalised] });
  });

  it('reads them as no due date and Medium from create and update (DEC-210)', async () => {
    server.use(
      http.post('/api/tasks', () => HttpResponse.json({ task: bare }, { status: 201 })),
      http.patch('/api/tasks/:id', () => HttpResponse.json({ task: bare })),
    );
    await expect(createTask({ title: 'Pay rent' })).resolves.toEqual({ task: normalised });
    await expect(updateTask('old-1', { status: 'pending' })).resolves.toEqual({ task: normalised });
  });
});

describe('task API calls', () => {
  it('createTask posts the title and returns the stored task (AC-2)', async () => {
    const stored = buildTask({ id: 'real-1', title: 'Buy milk' });
    let body: unknown;
    let credentials: RequestCredentials | undefined;
    server.use(
      http.post('/api/tasks', async ({ request }) => {
        body = await request.json();
        credentials = request.credentials;
        return HttpResponse.json({ task: stored }, { status: 201 });
      }),
    );
    await expect(createTask({ title: 'Buy milk' })).resolves.toEqual({ task: stored });
    expect(body).toEqual({ title: 'Buy milk' });
    expect(credentials).toBe('same-origin');
  });

  it('updateTask patches only the fields given, at the encoded id (AC-4 AC-5)', async () => {
    const stored = buildTask({ id: 'a/b', status: 'completed' });
    let body: unknown;
    let url = '';
    server.use(
      http.patch('/api/tasks/:id', async ({ request }) => {
        body = await request.json();
        url = new URL(request.url).pathname;
        return HttpResponse.json({ task: stored });
      }),
    );
    await expect(updateTask('a/b', { status: 'completed' })).resolves.toEqual({ task: stored });
    expect(body).toEqual({ status: 'completed' });
    expect(url).toBe('/api/tasks/a%2Fb');
  });

  it('deleteTask resolves with nothing on 204 (AC-6)', async () => {
    server.use(http.delete('/api/tasks/:id', () => new HttpResponse(null, { status: 204 })));
    await expect(deleteTask('task-1')).resolves.toBeUndefined();
  });

  it.each([
    [400, 'VALIDATION'],
    [404, 'NOT_FOUND'],
    [500, 'INTERNAL'],
    [503, 'SERVICE_UNAVAILABLE'],
  ])('rejects with a normalised ApiError on %i (AC-3 AC-8)', async (status, code) => {
    server.use(
      http.post('/api/tasks', () =>
        HttpResponse.json(
          { error: { code, message: 'nope', fields: { title: 'bad' } } },
          { status },
        ),
      ),
    );
    const error = await createTask({ title: 'x' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status, code, message: 'nope', fields: { title: 'bad' } });
  });

  it('reports a network failure as status 0 (AC-8)', async () => {
    server.use(http.patch('/api/tasks/:id', () => HttpResponse.error()));
    await expect(updateTask('t', { title: 'x' })).rejects.toMatchObject({ status: 0 });
  });

  it('reports an aborted request as status 0 (AC-8)', async () => {
    server.use(http.delete('/api/tasks/:id', () => new Promise(() => {})));
    const controller = new AbortController();
    const pending = deleteTask('t', { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ status: 0 });
  });

  it('sends a keepalive delete and never fires the 401 handler, since nobody is left to route (AC-7)', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    let keepalive: boolean | undefined;
    server.use(
      http.delete('/api/tasks/:id', ({ request }) => {
        keepalive = request.keepalive;
        return HttpResponse.json(
          { error: { code: 'UNAUTHENTICATED', message: 'x' } },
          { status: 401 },
        );
      }),
    );
    await expect(deleteTask('t', { keepalive: true })).rejects.toMatchObject({ status: 401 });
    setUnauthorizedHandler(null);
    expect(handler).not.toHaveBeenCalled();
    expect(keepalive).toBe(true);
  });

  it('fires the 401 handler for an ordinary delete (AC-8)', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    server.use(
      http.delete('/api/tasks/:id', () =>
        HttpResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, { status: 401 }),
      ),
    );
    await expect(deleteTask('t')).rejects.toMatchObject({ status: 401 });
    setUnauthorizedHandler(null);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  describe('listTasks search (Task-22 AC-1 AC-3)', () => {
    const seen = (): { urls: string[] } => {
      const record = { urls: [] as string[] };
      server.use(
        http.get('/api/tasks', ({ request }) => {
          record.urls.push(request.url);
          return HttpResponse.json({ tasks: [] });
        }),
      );
      return record;
    };

    it('sends only today, and no search, without search text (AC-3 DEC-218)', async () => {
      const record = seen();
      await listTasks();
      await listTasks({ search: '' });
      await listTasks({ search: '   ' });
      for (const url of record.urls) {
        const params = new URL(url).searchParams;
        expect([...params.keys()]).toEqual(['today']);
      }
      expect(record.urls).toHaveLength(3);
    });

    it('sends the trimmed text, encoded, as search (AC-1)', async () => {
      const record = seen();
      await listTasks({ search: '  milk & eggs?  ' });
      const url = new URL(record.urls[0]);
      expect(url.searchParams.get('search')).toBe('milk & eggs?');
    });

    it('returns the filtered list the server sends (AC-1)', async () => {
      const milk = buildTask({ title: 'Buy milk' });
      server.use(http.get('/api/tasks', () => HttpResponse.json({ tasks: [milk] })));
      await expect(listTasks({ search: 'milk' })).resolves.toEqual({ tasks: [milk] });
    });

    it('rejects when the signal is aborted, so the caller can drop it (AC-6)', async () => {
      server.use(http.get('/api/tasks', () => new Promise(() => {})));
      const controller = new AbortController();
      const pending = listTasks({ search: 'milk', signal: controller.signal });
      controller.abort();
      await expect(pending).rejects.toMatchObject({ status: 0 });
    });
  });

  describe('Task-23 due date, priority and filters', () => {
    const paramsOf = async (options: Parameters<typeof listTasks>[0]) => {
      let seenUrl = '';
      server.use(
        http.get('/api/tasks', ({ request }) => {
          seenUrl = request.url;
          return HttpResponse.json({ tasks: [] });
        }),
      );
      await listTasks(options);
      return { params: new URL(seenUrl).searchParams };
    };

    it('sends the caller-supplied today on every call (AC-5 DEC-218)', async () => {
      const { params } = await paramsOf({ today: '2026-11-16' });
      expect(params.get('today')).toBe('2026-11-16');
    });

    it('sends today from the local calendar, not the UTC date, when none is given (AC-9)', async () => {
      // 23:30 on 16 Nov in the pinned zone (west of UTC) is already 17 Nov in UTC.
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 10, 16, 23, 30));
      try {
        expect(new Date().toISOString().slice(0, 10)).toBe('2026-11-17');
        const { params } = await paramsOf({});
        expect(params.get('today')).toBe('2026-11-16');
      } finally {
        vi.useRealTimers();
      }
    });

    it('sends only the filters that are not the default (AC-11)', async () => {
      const { params } = await paramsOf({
        today: '2026-11-16',
        filters: { status: 'pending', priority: 'all', due: 'week', sort: 'newest' },
      });
      expect(Object.fromEntries(params)).toEqual({
        status: 'pending',
        due: 'week',
        today: '2026-11-16',
      });
    });

    it('sends every non-default choice together with search (AC-5 AC-6 AC-7)', async () => {
      const { params } = await paramsOf({
        search: ' milk ',
        today: '2026-11-16',
        filters: { status: 'completed', priority: 'high', due: 'overdue', sort: 'priority' },
      });
      expect(Object.fromEntries(params)).toEqual({
        search: 'milk',
        status: 'completed',
        priority: 'high',
        due: 'overdue',
        sort: 'priority',
        today: '2026-11-16',
      });
    });

    it('createTask sends the date and priority it is given (AC-2)', async () => {
      let body: unknown;
      server.use(
        http.post('/api/tasks', async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({ task: buildTask() }, { status: 201 });
        }),
      );
      await createTask({ title: 'Pay rent', dueDate: '2026-11-20', priority: 'high' });
      expect(body).toEqual({ title: 'Pay rent', dueDate: '2026-11-20', priority: 'high' });
    });

    it('updateTask sends a null date to clear it (AC-3)', async () => {
      let body: unknown;
      server.use(
        http.patch('/api/tasks/:id', async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({ task: buildTask() });
        }),
      );
      await updateTask('t1', { dueDate: null });
      expect(body).toEqual({ dueDate: null });
    });
  });
});
