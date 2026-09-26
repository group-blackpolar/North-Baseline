/** Display helpers for the platform administration screens.
 *
 * Byte counters arrive as decimal strings because CORECROW serializes BigInt
 * columns as strings; converting them to `Number` here for display purposes is
 * safe for human-readable output and keeps the raw value available when needed. */

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;

export function formatBytes(value: string, locale: string): string {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return value;
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < BYTE_UNITS.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toLocaleString(locale, { maximumFractionDigits: unit === 0 ? 0 : 1 })} ${BYTE_UNITS[unit]}`;
}

export function formatMoney(minor: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

export function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: '2-digit' });
}

export function formatDateTime(value: string | null | undefined, locale: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'medium' });
}

export function formatNumber(value: number, locale: string): string {
  return value.toLocaleString(locale);
}
