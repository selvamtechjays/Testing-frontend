// tier: unit
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeExiting, useExitingItems, type Rendered } from './useExitingItems';

const item = (id: string) => ({ id });
const live = (...ids: string[]): Rendered<{ id: string }>[] =>
  ids.map((id) => ({ item: item(id), leaving: false }));
const view = (rows: Rendered<{ id: string }>[]) =>
  rows.map((row) => (row.leaving ? `${row.item.id}*` : row.item.id));

describe('mergeExiting', () => {
  it('keeps a removed item in its old place, marked leaving', () => {
    expect(view(mergeExiting(live('a', 'b', 'c'), [item('a'), item('c')]))).toEqual([
      'a',
      'b*',
      'c',
    ]);
  });

  it('keeps a removed first item at the top', () => {
    expect(view(mergeExiting(live('a', 'b'), [item('b')]))).toEqual(['a*', 'b']);
  });

  it('lets an item that comes back rejoin as live (Undo)', () => {
    const leaving = mergeExiting(live('a', 'b'), [item('a')]);
    expect(view(mergeExiting(leaving, [item('a'), item('b')]))).toEqual(['a', 'b']);
  });
});

describe('useExitingItems', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('drops leaving rows once the exit duration has passed', () => {
    const { result, rerender } = renderHook(({ items }) => useExitingItems(items, 200), {
      initialProps: { items: [item('a'), item('b')] },
    });
    rerender({ items: [item('a')] });
    expect(view(result.current)).toEqual(['a', 'b*']);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(view(result.current)).toEqual(['a']);
  });

  it('passes the list straight through with a duration of 0', () => {
    const { result, rerender } = renderHook(({ items }) => useExitingItems(items, 0), {
      initialProps: { items: [item('a'), item('b')] },
    });
    rerender({ items: [item('a')] });
    expect(view(result.current)).toEqual(['a']);
  });
});
