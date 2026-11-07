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
