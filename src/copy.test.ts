// tier: unit
import { describe, expect, it } from 'vitest';
import { copy } from './copy';

// BR-1, BR-5, AC-4, AC-8, AC-11, TS-4, TS-9, TS-12
const FORBIDDEN_TERMS = [
  'terms',
  'privacy',
  'cookie',
  'analytics',
  'email',
  'google',
  'language',
  'idioma',
];
const NON_ENGLISH_CHARS = /[^\x20-\x7E]/;

describe('copy', () => {
  it('has no forbidden term in any string (AC-8 AC-11 BR-1 BR-5)', () => {
    for (const text of Object.values(copy)) {
      const lower = text.toLowerCase();
      for (const term of FORBIDDEN_TERMS) {
        expect(lower, `"${text}" must not contain "${term}"`).not.toContain(term);
      }
    }
  });

  it('is plain English text with no non-Latin characters (AC-4 BR-1)', () => {
    for (const text of Object.values(copy)) {
      expect(NON_ENGLISH_CHARS.test(text), `"${text}" must be plain English`).toBe(false);
    }
  });

  it('gives every string a non-empty value (AC-4)', () => {
    for (const text of Object.values(copy)) {
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });
});
