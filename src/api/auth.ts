import { apiFetch } from './client';

export interface User {
  id: string;
  username: string;
}

/** POST /api/auth/register (EP-AUTH-01). The session cookie is set by the server. */
export function registerUser(username: string, password: string): Promise<{ user: User }> {
  return apiFetch<{ user: User }>('/auth/register', {
    method: 'POST',
    body: { username, password },
  });
}

/** POST /api/auth/login (EP-AUTH-02). Refuses with 401 INVALID_CREDENTIALS, handled by the sign-in page. */
export function signIn(username: string, password: string): Promise<{ user: User }> {
  return apiFetch<{ user: User }>('/auth/login', {
    method: 'POST',
    body: { username, password },
  });
}

/** POST /api/auth/logout (EP-AUTH-03). Idempotent: 204 even without a live session. */
export async function signOut(): Promise<void> {
  await apiFetch<null>('/auth/logout', { method: 'POST' });
}

/**
 * GET /api/auth/me (EP-AUTH-04). The caller decides what a 401 means, so the global
 * sign-out handler is not run for this probe.
 */
export function getCurrentUser(): Promise<{ user: User }> {
  return apiFetch<{ user: User }>('/auth/me', { handleUnauthorized: false });
}
