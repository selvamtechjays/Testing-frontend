// tier: integration
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../test/mocks/server';
import { buildTag, TAG_MESSAGES } from '../test/mocks/tags';
import { ApiError } from './client';
import { createTag, deleteTag, listTags, updateTag } from './tags';

describe('tag API calls (FEAT-TAG-03 EP-TAG-01 EP-TAG-02)', () => {
  it('listTags returns the tags the server sent (TAG03 AC-6)', async () => {
    const tags = [buildTag({ name: 'Home', taskCount: 2 })];
    server.use(http.get('/api/tags', () => HttpResponse.json({ tags })));
    await expect(listTags()).resolves.toEqual(tags);
  });

  it('createTag posts the name as typed, with no colour, and returns the stored tag (TAG03 AC-7)', async () => {
    const stored = buildTag({ name: 'Groceries' });
    let body: unknown;
    server.use(
      http.post('/api/tags', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ tag: stored }, { status: 201 });
      }),
    );
    await expect(createTag({ name: '  Groceries ' })).resolves.toEqual(stored);
    expect(body).toEqual({ name: '  Groceries ' });
  });

  it('createTag rejects with the status and the name message of a refusal (TAG03 AC-17)', async () => {
    server.use(
      http.post('/api/tags', () =>
        HttpResponse.json(
          { error: { code: 'VALIDATION', message: 'x', fields: { name: TAG_MESSAGES.empty } } },
          { status: 400 },
        ),
      ),
    );
    const error = await createTag({ name: '' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, fields: { name: 'Enter a tag name.' } });
  });
});

describe('tag management API calls (FEAT-TAG-02 EP-TAG-03 EP-TAG-04)', () => {
  it('updateTag patches only what it is given at the encoded id and returns the answered tag (TAG02 AC-2 AC-3)', async () => {
    let body: unknown;
    let path = '';
    server.use(
      http.patch('/api/tags/:id', async ({ request }) => {
        body = await request.json();
        path = new URL(request.url).pathname;
        return HttpResponse.json({ tag: buildTag({ id: 'a/b', name: 'Office', colour: 'red' }) });
      }),
    );
    const tag = await updateTag('a/b', { name: 'Office' });
    expect(body).toEqual({ name: 'Office' });
    expect(path).toBe('/api/tags/a%2Fb');
    expect(tag.name).toBe('Office');
    await updateTag('a/b', { colour: 'red' });
    expect(body).toEqual({ colour: 'red' });
  });

  it('updateTag rejects with the field the server named (TAG02 AC-9 AC-11 AC-12)', async () => {
    server.use(
      http.patch('/api/tags/:id', () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION',
              message: 'x',
              fields: { colour: 'Colour must be gray, red, orange, green, blue or purple.' },
            },
          },
          { status: 400 },
        ),
      ),
    );
    const error = await updateTag('t1', { colour: 'red' }).catch((e: unknown) => e);
    expect(error).toMatchObject({
      status: 400,
      fields: { colour: expect.stringContaining('Colour must be') },
    });
  });

  it('deleteTag resolves on 204 and rejects with the status on a 404 (TAG02 AC-4 AC-18)', async () => {
    server.use(http.delete('/api/tags/:id', () => new HttpResponse(null, { status: 204 })));
    await expect(deleteTag('t1')).resolves.toBeUndefined();
    server.use(
      http.delete('/api/tags/:id', () =>
        HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Tag not found.' } },
          { status: 404 },
        ),
      ),
    );
    await expect(deleteTag('t1')).rejects.toMatchObject({ status: 404 });
  });
});
