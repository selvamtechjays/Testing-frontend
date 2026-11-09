// tier: integration
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../test/mocks/server';
import { buildTask } from '../test/builders/task';
import { ApiError, setUnauthorizedHandler } from './client';
import { createTask, deleteTask, updateTask } from './tasks';

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
    await expect(createTask('Buy milk')).resolves.toEqual({ task: stored });
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
    const error = await createTask('x').catch((e: unknown) => e);
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
});
