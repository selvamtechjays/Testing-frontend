/** A task title is at most this many UTF-16 units, counted the same way the server counts (R-3). */
export const MAX_TITLE_LENGTH = 200;

export type TitleCheck = { ok: true; title: string } | { ok: false; reason: 'empty' };

/** Trims the title; a title with nothing left is refused and nothing is sent (DEC-062). */
export function validateTitle(raw: string): TitleCheck {
  const title = raw.trim();
  return title === '' ? { ok: false, reason: 'empty' } : { ok: true, title };
}

const HIGH_SURROGATE = /[\uD800-\uDBFF]$/;

/** Cuts typed or pasted text to the limit without leaving half an emoji at the end. */
export function clampTitle(raw: string): { value: string; truncated: boolean } {
  if (raw.length <= MAX_TITLE_LENGTH) return { value: raw, truncated: false };
  const cut = raw.slice(0, MAX_TITLE_LENGTH).replace(HIGH_SURROGATE, '');
  return { value: cut, truncated: true };
}
