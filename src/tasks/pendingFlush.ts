/**
 * Lets code outside the task list (the Log out button in the header) make any held deletion final
 * and wait for the server to answer. The list registers while it is mounted.
 */
type Flush = () => Promise<void>;

const flushes = new Set<Flush>();

/** Registers a flush; returns the function that removes it. */
export function registerFlush(flush: Flush): () => void {
  flushes.add(flush);
  return () => {
    flushes.delete(flush);
  };
}

/** Runs every registered flush and resolves when all have settled; never rejects. */
export async function flushPendingDeletes(): Promise<void> {
  await Promise.allSettled([...flushes].map((flush) => flush()));
}
