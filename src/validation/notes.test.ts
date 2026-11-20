// tier: unit
import { describe, expect, it } from 'vitest';
import { applyNotesRule, NOTES_MESSAGES } from '../test/mocks/tasks';
import { normaliseNotes, notesLeft, NOTES_MAX } from './notes';

describe('normaliseNotes (AC-3 AC-2)', () => {
  it('trims the ends and keeps the text (AC-1)', () => {
    expect(normaliseNotes('  Call Ravi 98400 12345  ')).toBe('Call Ravi 98400 12345');
  });

  it('keeps inner newlines and spaces', () => {
    expect(normaliseNotes('one\n\ntwo  three')).toBe('one\n\ntwo  three');
  });

  it('reads empty and whitespace-only text as no notes (AC-3)', () => {
    expect(normaliseNotes('')).toBeNull();
    expect(normaliseNotes('   \n\t ')).toBeNull();
  });
});

describe('notesLeft (AC-9)', () => {
  it('is the limit for an empty box and counts each character used', () => {
    expect(NOTES_MAX).toBe(1000);
    expect(notesLeft('')).toBe(1000);
    expect(notesLeft('abc')).toBe(997);
  });

  it('is 0 at exactly 1000 characters and never negative', () => {
    expect(notesLeft('a'.repeat(1000))).toBe(0);
    expect(notesLeft('a'.repeat(1200))).toBe(0);
  });

  it('counts UTF-16 units, so an emoji uses two', () => {
    expect(notesLeft('😀')).toBe(998);
  });
});

describe('the box and the stand-in server count the same way (AC-3 AC-9 DEC-240)', () => {
  it('takes 500 emoji and refuses 501, as 1000 and 1002 UTF-16 units', () => {
    const fits = '😀'.repeat(500);
    const over = '😀'.repeat(501);
    expect(notesLeft(fits)).toBe(0);
    expect(applyNotesRule(fits)).toEqual({ ok: true, notes: fits });
    expect(applyNotesRule(over)).toEqual({ ok: false, message: NOTES_MESSAGES.tooLong });
  });
});
