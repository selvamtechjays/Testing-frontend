import { useEffect, useState } from 'react';

export interface Rendered<T> {
  item: T;
  leaving: boolean;
}

/**
 * Keeps an item that left `next` in its old position, marked `leaving`, so it can animate out.
 * An item that comes back (Undo) simply rejoins as a live item.
 */
export function mergeExiting<T extends { id: string }>(
  previous: Rendered<T>[],
  next: T[],
): Rendered<T>[] {
  const nextIds = new Set(next.map((item) => item.id));
  const out: Rendered<T>[] = next.map((item) => ({ item, leaving: false }));
  previous.forEach((entry, index) => {
    if (nextIds.has(entry.item.id)) return;
    let at = 0;
    for (let back = index - 1; back >= 0; back -= 1) {
      const anchor = out.findIndex((o) => o.item.id === previous[back].item.id);
      if (anchor >= 0) {
        at = anchor + 1;
        break;
      }
    }
    out.splice(at, 0, { item: entry.item, leaving: true });
  });
  return out;
}

/**
 * `items` plus any just-removed ones, kept for `durationMs` so they can animate out.
 * With a duration of 0 the list is passed straight through.
 */
export function useExitingItems<T extends { id: string }>(
  items: T[],
  durationMs: number,
): Rendered<T>[] {
  const [rendered, setRendered] = useState<Rendered<T>[]>(() =>
    items.map((item) => ({ item, leaving: false })),
  );
  const [source, setSource] = useState(items);

  // Derive during render when the source list changes (React's "adjust state on prop change").
  if (source !== items) {
    setSource(items);
    setRendered((previous) =>
      durationMs > 0
        ? mergeExiting(previous, items)
        : items.map((item) => ({ item, leaving: false })),
    );
  }

  const hasLeaving = rendered.some((entry) => entry.leaving);
  useEffect(() => {
    if (!hasLeaving) return;
    const timer = setTimeout(() => {
      setRendered((current) => current.filter((entry) => !entry.leaving));
    }, durationMs);
    return () => clearTimeout(timer);
  }, [hasLeaving, durationMs, rendered]);

  return rendered;
}
