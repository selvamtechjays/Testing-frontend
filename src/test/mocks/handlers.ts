import { http, HttpResponse } from 'msw';

// Default handlers shared by every test. Keep this list minimal: per-test
// behaviour belongs in `server.use(...)` overrides, which reset after each test.
export const handlers = [http.get('/api/__harness/ping', () => HttpResponse.json({ ok: true }))];
