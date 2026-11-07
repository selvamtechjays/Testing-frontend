// tier: integration
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../test/mocks/server';
import { USER, invalidCredentialsBody, unauthenticatedBody } from '../test/mocks/auth';
import { getCurrentUser, signIn, signOut } from './auth';
import { ApiError, setUnauthorizedHandler } from './client';

describe('auth API calls', () => {
  it('signIn posts the credentials untouched and unwraps the user (AC-1 AC-2 BR-1)', async () => {
    let body: unknown;
    let credentials: RequestCredentials | undefined;
    server.use(
      http.post('/api/auth/login', async ({ request }) => {
        body = await request.json();
        credentials = request.credentials;
        return HttpResponse.json({ user: USER });
      }),
    );
    await expect(signIn('Selvam', ' hunter2hunter2 ')).resolves.toEqual({ user: USER });
    expect(body).toEqual({ username: 'Selvam', password: ' hunter2hunter2 ' });
    expect(credentials).toBe('same-origin');
  });

  it('signIn rejects with code and status of INVALID_CREDENTIALS and does not run the 401 handler (AC-6 DEC-083)', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json(invalidCredentialsBody, { status: 401 }),
      ),
    );
    const error = await signIn('a', 'b').catch((caught: unknown) => caught);
    setUnauthorizedHandler(null);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('signOut resolves on an empty 204 (AC-5 AC-10)', async () => {
    let called = false;
    server.use(
      http.post('/api/auth/logout', () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await expect(signOut()).resolves.toBeUndefined();
    expect(called).toBe(true);
  });

  it('getCurrentUser returns the user on 200 (AC-3)', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.json({ user: USER })));
    await expect(getCurrentUser()).resolves.toEqual({ user: USER });
  });

  it('getCurrentUser rejects on 401 UNAUTHENTICATED without running the sign-out handler', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(unauthenticatedBody, { status: 401 })),
    );
    await expect(getCurrentUser()).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
    setUnauthorizedHandler(null);
    expect(handler).not.toHaveBeenCalled();
  });

  it('any other call answering 401 UNAUTHENTICATED runs the sign-out handler once (AC-4 DEC-074)', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    server.use(
      http.post('/api/auth/logout', () => HttpResponse.json(unauthenticatedBody, { status: 401 })),
    );
    await expect(signOut()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    setUnauthorizedHandler(null);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('a network failure surfaces as ApiError status 0 with no message text', async () => {
    server.use(http.post('/api/auth/login', () => HttpResponse.error()));
    await expect(signIn('a', 'b')).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK',
      message: '',
    });
  });
});
