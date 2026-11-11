// tier: unit
import { describe, expect, it, vi } from 'vitest';
import { flushPendingDeletes, registerFlush } from './pendingFlush';

describe('pendingFlush registry', () => {
  it('resolves at once when nothing is registered', async () => {
    await expect(flushPendingDeletes()).resolves.toBeUndefined();
  });

  it('waits for every registered flush to settle', async () => {
    const done: string[] = [];
    const slow = () =>
      new Promise<void>((resolve) =>
        setTimeout(() => {
          done.push('slow');
          resolve();
        }, 20),
      );
    const fast = () => {
      done.push('fast');
      return Promise.resolve();
    };
    const offSlow = registerFlush(slow);
    const offFast = registerFlush(fast);
    await flushPendingDeletes();
    expect(done.sort()).toEqual(['fast', 'slow']);
    offSlow();
    offFast();
  });

  it('does not call a flush after it was unregistered', async () => {
    const flush = vi.fn(() => Promise.resolve());
    registerFlush(flush)();
    await flushPendingDeletes();
    expect(flush).not.toHaveBeenCalled();
  });

  it('never rejects, even when a flush does', async () => {
    const off = registerFlush(() => Promise.reject(new Error('refused')));
    await expect(flushPendingDeletes()).resolves.toBeUndefined();
    off();
  });
});
