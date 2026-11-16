/** A note is at most this many UTF-16 units, counted the way the server counts (DEC-240). */
export const NOTES_MAX = 1000;

/**
 * What a note is stored as: trimmed, with nothing left meaning no note. Inner newlines are kept.
 * Trimming only shortens, so the box's own 1000 cap never blocks text the server accepts.
 */
export function normaliseNotes(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === '' ? null : trimmed;
}

/** How many more characters the box takes; never below 0. */
export function notesLeft(text: string): number {
  return Math.max(0, NOTES_MAX - text.length);
}
