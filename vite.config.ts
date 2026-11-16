/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Tests run in a zone west of UTC, set here before any worker starts so every one inherits it:
// a calendar date built from UTC fields is a day off there in the evening, which is what the
// date tests must catch whatever zone the machine or CI runs in.
process.env.TZ = 'America/Los_Angeles';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@fontsource-files': fileURLToPath(
        new URL('./node_modules/@fontsource-variable/inter/files', import.meta.url),
      ),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',
      thresholds: { lines: 80, statements: 80, branches: 70, functions: 80 },
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/test/**', 'src/**/*.test.{ts,tsx}', 'src/vite-env.d.ts'],
    },
  },
});
