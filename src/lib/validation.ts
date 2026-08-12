/**
 * Shared request-field coercion used by the API routes.
 *
 * Every write endpoint receives untrusted JSON, so the same three primitives
 * kept being re-declared per route: trim-and-cap a string, treat blank as
 * absent, and validate an email. They live here instead.
 */

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

/** Trimmed string capped at `maxLength`, or `undefined` when absent/blank/non-string. */
export function optionalText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

/** Like {@link optionalText} but `null` when absent/blank, for required fields. */
export function requiredText(value: unknown, maxLength: number): string | null {
  return optionalText(value, maxLength) ?? null;
}

/** Finite number rounded to a whole unit (dollars), or `undefined` when unusable. */
export function roundedAmount(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.round(value);
}
