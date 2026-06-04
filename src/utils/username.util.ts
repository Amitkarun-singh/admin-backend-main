import crypto from "crypto";

/**
 * Generates a memorable, unique username from a full name.
 *
 * Strategy:
 *   1. Take the first word (first name) and last word (last name) of the full name.
 *   2. Lowercase and strip non-alpha characters.
 *   3. Append 4 random digits for uniqueness.
 *
 * Examples:
 *   "Rahul Kumar Sharma" → "rahul.sharma2847"
 *   "Priya"             → "priya4193"
 *   (no name)           → "user7361"
 */
export function generateUsername(fullName?: string | null): string {
  const digits = String(crypto.randomInt(1000, 9999));

  if (!fullName || !fullName.trim()) {
    return `user${digits}`;
  }

  const parts = fullName
    .trim()
    .split(/\s+/)
    .map((p) => p.toLowerCase().replace(/[^a-z]/g, ""))
    .filter(Boolean);

  if (parts.length === 0) return `user${digits}`;

  const first = parts[0];
  const last  = parts.length > 1 ? parts[parts.length - 1] : null;

  const base = last ? `${first}.${last}` : first;
  return `${base}${digits}`;
}
