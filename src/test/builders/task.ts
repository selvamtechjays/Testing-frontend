import type { Task } from '../../api/types';

// Plain TS builder: sensible defaults, override only what the test cares about.
let sequence = 0;

export function buildTask(overrides: Partial<Task> = {}): Task {
  sequence += 1;
  return {
    id: `task-${sequence}`,
    title: `Task ${sequence}`,
    status: 'pending',
    createdAt: '2026-11-07T09:00:00.000Z',
    ...overrides,
  };
}
