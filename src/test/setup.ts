import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// App lazy-loads its pages. In the files that render them, warm the modules once the file's own vi.mock
// calls are registered (this hook runs after collection), so no test waits on a cold chunk import.
const RENDERS_PAGES = /\/(App|pages\/[^/]+)\.([\w-]+\.)*test\.tsx$/;
beforeAll(async () => {
  const testPath = (expect.getState().testPath ?? '').replace(/\\/g, '/');
  if (!RENDERS_PAGES.test(testPath)) return;
  await Promise.all([
    import('../pages/RegisterPage'),
    import('../pages/SignInPage'),
    import('../pages/TaskListPage'),
  ]);
}, 60_000);

afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
