// tier: unit
import { describe, expect, it } from 'vitest';
import { MAX_TITLE_LENGTH, clampTitle, validateTitle } from './title';

describe('validateTitle', () => {
  it('accepts a 1-character title (AC-4 TS-5)', () => {
    expect(validateTitle('a')).toEqual({ ok: true, title: 'a' });
  });

  it('trims surrounding spaces before the title is sent (BR-1 DEC-062)', () => {
    expect(validateTitle('  Send logo  ')).toEqual({ ok: true, title: 'Send logo' });
  });

  it('refuses an empty title (AC-6 BR-1 TS-8)', () => {
    expect(validateTitle('')).toEqual({ ok: false, reason: 'empty' });
  });

  it('refuses a title of only spaces, so nothing is sent (AC-6 DEC-062)', () => {
    expect(validateTitle('   \t ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('keeps emoji, accents and CJK exactly as typed (AC-4 TS-7)', () => {
    const title = 'Plan 🚀 café 計画';
    expect(validateTitle(title)).toEqual({ ok: true, title });
  });
});

describe('clampTitle', () => {
  it('leaves a title of exactly 200 characters whole and unflagged (AC-5 BR-2 TS-6)', () => {
    const exact = 'x'.repeat(MAX_TITLE_LENGTH);
    expect(clampTitle(exact)).toEqual({ value: exact, truncated: false });
  });

  it('cuts a 201st character and flags it (AC-7 BR-2 TS-10)', () => {
    const result = clampTitle('x'.repeat(MAX_TITLE_LENGTH + 1));
    expect(result.value).toHaveLength(MAX_TITLE_LENGTH);
    expect(result.truncated).toBe(true);
  });

  it('cuts a pasted 250-character paragraph to 200 (AC-7 TS-9)', () => {
    const result = clampTitle('y'.repeat(250));
    expect(result).toEqual({ value: 'y'.repeat(200), truncated: true });
  });

  it('never leaves half an emoji at the cut (R-3)', () => {
    const text = 'a'.repeat(MAX_TITLE_LENGTH - 1) + '😀';
    const result = clampTitle(text);
    expect(result.truncated).toBe(true);
    expect(result.value).toBe('a'.repeat(MAX_TITLE_LENGTH - 1));
  });

  it('counts the same way the server counts: UTF-16 units (R-3)', () => {
    expect('😀'.length).toBe(2);
    expect(clampTitle('😀'.repeat(100)).truncated).toBe(false);
    expect(clampTitle('😀'.repeat(101)).truncated).toBe(true);
  });
});
