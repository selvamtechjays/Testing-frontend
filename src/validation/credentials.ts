import { copy } from '../copy';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;
export const PASSWORD_MIN = 8;

/** Local hint for a username, or undefined when it looks valid. The server is authoritative. */
export function usernameHint(username: string): string | undefined {
  if (username.length === 0) return copy.usernameMissing;
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) return copy.usernameLength;
  if (!USERNAME_PATTERN.test(username)) return copy.usernameChars;
  return undefined;
}

/** Local hint for a password; the common-password check is server-only. */
export function passwordHint(password: string): string | undefined {
  if (password.length === 0) return copy.passwordMissing;
  if (password.length < PASSWORD_MIN) return copy.passwordLength;
  return undefined;
}
