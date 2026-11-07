// tier: unit
import { describe, expect, it } from 'vitest';
import { copy } from '../copy';
import { passwordHint, usernameHint } from './credentials';

describe('usernameHint', () => {
  it('accepts exactly 3 and exactly 30 valid characters (AC-3 BR-1 TS-3 TS-4)', () => {
    expect(usernameHint('abc')).toBeUndefined();
    expect(usernameHint('a'.repeat(30))).toBeUndefined();
    expect(usernameHint('Priya_B_01')).toBeUndefined();
  });

  it('asks for a username when it is empty (AC-5 TS-6)', () => {
    expect(usernameHint('')).toBe(copy.usernameMissing);
  });

  it('refuses 2 and 31 characters with the length message (AC-6 BR-1 TS-8 TS-9)', () => {
    expect(usernameHint('ab')).toBe(copy.usernameLength);
    expect(usernameHint('a'.repeat(31))).toBe(copy.usernameLength);
  });

  it('refuses spaces, symbols, accents, emoji and HTML (AC-7 BR-1 TS-10 TS-11 TS-12)', () => {
    for (const bad of [
      'has space',
      'a-b-c',
      'josé_x',
      'name\u{1F600}',
      '<img src=x onerror=a()>',
    ]) {
      expect(usernameHint(bad), bad).toBe(copy.usernameChars);
    }
  });
});

describe('passwordHint', () => {
  it('accepts exactly 8 lower-case characters with no symbol or capital (AC-4 BR-2 TS-5)', () => {
    expect(passwordHint('abcdefgh')).toBeUndefined();
  });

  it('asks for a password when it is empty (AC-5 TS-7)', () => {
    expect(passwordHint('')).toBe(copy.passwordMissing);
  });

  it('refuses 7 characters (AC-8 BR-2 TS-13)', () => {
    expect(passwordHint('abcdefg')).toBe(copy.passwordLength);
  });

  it('does not check for common passwords on the client (AC-9 BR-2)', () => {
    expect(passwordHint('password')).toBeUndefined();
  });
});
