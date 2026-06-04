import crypto from "crypto";

const UPPERCASE  = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE  = "abcdefghijklmnopqrstuvwxyz";
const DIGITS     = "0123456789";
const SPECIALS   = "!@#$%^&*()_+-=[]{}|;:,.<>?";
const ALL_CHARS  = UPPERCASE + LOWERCASE + DIGITS + SPECIALS;

const PASSWORD_LENGTH = 10;

/**
 * Generates a secure random 10-character password.
 * Guaranteed to contain at least:
 *   - 1 uppercase letter
 *   - 1 lowercase letter
 *   - 1 digit
 *   - 1 special character
 */
export function generatePassword(): string {
  // Pick one mandatory character from each required charset
  const mandatory = [
    randomChar(UPPERCASE),
    randomChar(LOWERCASE),
    randomChar(DIGITS),
    randomChar(SPECIALS),
  ];

  // Fill the remaining slots from the full charset
  const remaining: string[] = [];
  for (let i = mandatory.length; i < PASSWORD_LENGTH; i++) {
    remaining.push(randomChar(ALL_CHARS));
  }

  // Combine and shuffle so mandatory chars aren't always at the start
  const combined = [...mandatory, ...remaining];
  return shuffleArray(combined).join("");
}

function randomChar(charset: string): string {
  const index = crypto.randomInt(0, charset.length);
  return charset[index];
}

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
