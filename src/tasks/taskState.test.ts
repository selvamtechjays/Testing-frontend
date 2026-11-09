// tier: unit
import { describe, expect, it } from 'vitest';
import type { Task } from '../api/types';
import { buildTask } from '../test/builders/task';
import {
  indexByCreatedAt,
  insertTemp,
  isTempId,
  nextTempId,
  patchField,
  reinsertAt,
  removeById,
  replaceId,
} from './taskState';

const a = buildTask({ id: 'a', title: 'A' });
const b = buildTask({ id: 'b', title: 'B' });
const c = buildTask({ id: 'c', title: 'C' });

describe('task list reducers', () => {
  it('inserts a temporary row first and does not mutate the input (AC-3)', () => {
    const list: Task[] = [a, b];
    const temp = buildTask({ id: nextTempId(), title: 'new' });
    expect(insertTemp(list, temp).map((t) => t.id)).toEqual([temp.id, 'a', 'b']);
    expect(list).toEqual([a, b]);
  });

  it('keeps newest first when a second task is added above the first (AC-11 TS-17)', () => {
    const first = buildTask({ id: nextTempId(), title: 'First' });
    const second = buildTask({ id: nextTempId(), title: 'Second' });
    const result = insertTemp(insertTemp([a], first), second);
    expect(result.map((t) => t.title)).toEqual(['Second', 'First', 'A']);
  });

  it('hands out distinct temp ids that look temporary (AC-3)', () => {
    const first = nextTempId();
    const second = nextTempId();
    expect(first).not.toBe(second);
    expect(first).toMatch(/^temp-[0-9a-f]+$/);
    expect(isTempId(first)).toBe(true);
    expect(isTempId('64f0c1')).toBe(false);
  });

  it('replaces a temporary id with the stored task in the same position (AC-2)', () => {
    const temp = buildTask({ id: 'temp-9', title: 'new' });
    const stored = buildTask({ id: 'real-1', title: 'new', createdAt: '2026-11-07T10:00:00Z' });
    const result = replaceId([temp, a], 'temp-9', stored);
    expect(result).toEqual([stored, a]);
  });

  it('removes the temporary row when the add fails (AC-3)', () => {
    const temp = buildTask({ id: 'temp-9' });
    expect(removeById([temp, a, b], 'temp-9')).toEqual([a, b]);
  });

  it('patches one field of one row and leaves everything else (AC-4 AC-5)', () => {
    const list = [a, b, c];
    const result = patchField(list, 'b', 'status', 'completed');
    expect(result[1]).toEqual({ ...b, status: 'completed' });
    expect(result[0]).toBe(a);
    expect(result[2]).toBe(c);
    expect(list[1]).toBe(b);
    expect(patchField(list, 'b', 'title', 'Renamed')[1].title).toBe('Renamed');
  });

  it('restores a field without touching a later change to another field (AC-4 AC-5)', () => {
    const ticked = patchField([a], 'a', 'status', 'completed');
    const edited = patchField(ticked, 'a', 'title', 'Edited');
    const rolledBack = patchField(edited, 'a', 'status', 'pending');
    expect(rolledBack[0]).toEqual({ ...a, title: 'Edited', status: 'pending' });
  });

  it('puts a deleted row back in its place (AC-6)', () => {
    const list = removeById([a, b, c], 'b');
    expect(reinsertAt(list, b, 1)).toEqual([a, b, c]);
  });

  it('clamps the index and never duplicates a row that is already back (AC-6)', () => {
    expect(reinsertAt([a], b, 99)).toEqual([a, b]);
    expect(reinsertAt([a], b, -3)).toEqual([b, a]);
    const present = [a, b];
    expect(reinsertAt(present, b, 0)).toBe(present);
  });
});

describe('indexByCreatedAt', () => {
  const at = (hour: number) => `2026-11-07T${String(hour).padStart(2, '0')}:00:00.000Z`;
  const newer = buildTask({ id: 'n', createdAt: at(12) });
  const older = buildTask({ id: 'o', createdAt: at(8) });

  it('puts a task newer than every row first (AC-2)', () => {
    expect(indexByCreatedAt([newer, older], buildTask({ createdAt: at(13) }))).toBe(0);
  });

  it('puts a task between a newer and an older row between them (AC-2)', () => {
    expect(indexByCreatedAt([newer, older], buildTask({ createdAt: at(10) }))).toBe(1);
  });

  it('puts a task older than every row last (AC-2)', () => {
    expect(indexByCreatedAt([newer, older], buildTask({ createdAt: at(6) }))).toBe(2);
  });

  it('puts a task into an empty list at 0 (TS-11)', () => {
    expect(indexByCreatedAt([], buildTask())).toBe(0);
  });

  it('places a task with the same time after the rows that share it (AC-2)', () => {
    expect(indexByCreatedAt([newer, older], buildTask({ createdAt: at(12) }))).toBe(1);
  });
});
