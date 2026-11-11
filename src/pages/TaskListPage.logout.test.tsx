// tier: integration
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { meSignedIn } from '../test/mocks/auth';
import { server } from '../test/mocks/server';
import { serverErrorBody } from '../test/mocks/tasks';
import { buildTask } from '../test/builders/task';
import { renderWithProviders, screen } from '../test/utils';

const SLOW_DELETE_MS = 150;

/** Records the order in which the stand-in server sees requests. */
function recordingServer(deleteStatus: number) {
  const order: string[] = [];
  server.use(
    meSignedIn,
    http.get('/api/tasks', () =>
      HttpResponse.json({ tasks: [buildTask({ id: 'm', title: 'Old idea' })] }),
    ),
    http.delete('/api/tasks/:id', async () => {
      order.push('delete-received');
      await delay(SLOW_DELETE_MS);
      order.push('delete-answered');
      return deleteStatus === 204
        ? new HttpResponse(null, { status: 204 })
        : HttpResponse.json(serverErrorBody, { status: deleteStatus });
    }),
    http.post('/api/auth/logout', () => {
      order.push('logout-received');
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return order;
}

async function deleteThenLogOut() {
  renderWithProviders(<App />, { route: '/' });
  await screen.findByRole('list', { name: 'Your tasks' });
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Delete Old idea' }));
  await user.click(screen.getByRole('button', { name: 'Log out' }));
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
}

describe('log out with a deletion still inside its undo window', () => {
  it('sends the DELETE and waits for its answer before calling logout (SR-B-005)', async () => {
    const order = recordingServer(204);
    await deleteThenLogOut();
    expect(order).toEqual(['delete-received', 'delete-answered', 'logout-received']);
  }, 15000);

  it('still logs out and signs out locally when the flushed DELETE fails', async () => {
    const order = recordingServer(500);
    await deleteThenLogOut();
    expect(order).toEqual(['delete-received', 'delete-answered', 'logout-received']);
    expect(screen.queryByText('Old idea')).not.toBeInTheDocument();
  }, 15000);
});
