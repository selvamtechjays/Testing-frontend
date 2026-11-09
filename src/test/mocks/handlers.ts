import { http, HttpResponse } from 'msw';
import { meUnauthenticated } from './auth';
import { deleteTaskNoContent, listTasksEmpty } from './tasks';

// Default handlers shared by every test. Keep this list minimal: per-test
// behaviour belongs in `server.use(...)` overrides, which reset after each test.
// AuthProvider asks /api/auth/me on mount, so every test starts signed out unless it overrides.
export const handlers = [
  http.get('/api/__harness/ping', () => HttpResponse.json({ ok: true })),
  meUnauthenticated,
  listTasksEmpty,
  deleteTaskNoContent,
];
