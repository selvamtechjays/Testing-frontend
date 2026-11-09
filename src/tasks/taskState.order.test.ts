// tier: unit
import { describe, expect, it } from 'vitest';
import { buildTask } from '../test/builders/task';
import { patchField } from './taskState';

const list = [
  buildTask({ id: 'newest', title: 'Newest', createdAt: '2026-11-07T10:00:00.000Z' }),
  buildTask({ id: 'middle', title: 'Middle', createdAt: '2026-11-07T09:00:00.000Z' }),
  buildTask({ id: 'oldest', title: 'Oldest', createdAt: '2026-11-07T08:00:00.000Z' }),
];
const ids = (rows: typeof list) => rows.map((row) => row.id);

describe('patchField keeps the list order', () => {
  it.each(['newest', 'middle', 'oldest'])(
    'ticking %s does not move any row (AC-9 BR-6 TS-12)',
    (id) => {
      expect(ids(patchField(list, id, 'status', 'completed'))).toEqual(ids(list));
    },
  );

  it.each(['newest', 'middle', 'oldest'])(
    'editing the title of %s does not move any row (AC-9 BR-6 TS-13)',
    (id) => {
      expect(ids(patchField(list, id, 'title', 'Changed'))).toEqual(ids(list));
    },
  );

  it('never changes createdAt, the one thing the order rests on (AC-9 R-1)', () => {
    const result = patchField(
      patchField(list, 'middle', 'status', 'completed'),
      'middle',
      'title',
      'X',
    );
    expect(result.map((row) => row.createdAt)).toEqual(list.map((row) => row.createdAt));
  });

  it('keeps completed rows in the list (AC-10 BR-4)', () => {
    const result = patchField(list, 'middle', 'status', 'completed');
    expect(result).toHaveLength(list.length);
    expect(result[1].status).toBe('completed');
  });
});
