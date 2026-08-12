/** Shared en-US currency and date/time formatting used across pages and widgets. */

const usdFormatters = new Map<number, Intl.NumberFormat>();

function usdFormatter(maximumFractionDigits: number): Intl.NumberFormat {
  const cached = usdFormatters.get(maximumFractionDigits);
  if (cached) return cached;
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
  });
  usdFormatters.set(maximumFractionDigits, formatter);
  return formatter;
}

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Whole-dollar currency by default; non-finite input renders as $0. */
export function formatUsd(value: number, maximumFractionDigits = 0): string {
  return usdFormatter(maximumFractionDigits).format(Number.isFinite(value) ? value : 0);
}

/** Currency stored in cents, rendered with cents. */
export function formatUsdFromCents(cents: number): string {
  return formatUsd(cents / 100, 2);
}

/** Abbreviated currency for dense dashboard cells (e.g. `$1.2K`). */
export function formatCompactUsdFromCents(cents: number): string {
  return `$${compactFormatter.format(Number.isFinite(cents) ? cents / 100 : 0)}`;
}

export function formatDateTime(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = {},
  locale: string | undefined = "en-US",
): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...options,
  }).format(typeof value === "string" ? new Date(value) : value);
}
