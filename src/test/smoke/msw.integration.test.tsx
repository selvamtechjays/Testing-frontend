import { http, HttpResponse } from 'msw';
import { useEffect, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '../utils';
import { server } from '../mocks/server';

// Harness-only component: proves render + fetch + MSW wiring. Not product code.
function PingProbe() {
  const [status, setStatus] = useState('loading');
  useEffect(() => {
    fetch('/api/__harness/ping')
      .then((res) => res.json())
      .then((body: { ok: boolean }) => setStatus(body.ok ? 'ok' : 'not-ok'))
      .catch(() => setStatus('error'));
  }, []);
  return <p>{status}</p>;
}

describe('harness: MSW + renderWithProviders', () => {
  it('serves the default handler', async () => {
    renderWithProviders(<PingProbe />);
    expect(await screen.findByText('ok')).toBeInTheDocument();
  });

  it('supports per-test overrides', async () => {
    server.use(http.get('/api/__harness/ping', () => HttpResponse.json({ ok: false })));
    renderWithProviders(<PingProbe />);
    expect(await screen.findByText('not-ok')).toBeInTheDocument();
  });

  it('fails unhandled requests instead of reaching the network', async () => {
    await expect(fetch('/api/__harness/unmocked')).rejects.toThrow();
  });
});
