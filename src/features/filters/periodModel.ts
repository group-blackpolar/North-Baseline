// Calendar maths for the period filter. Pure and zone-free: every value is an ISO day (YYYY-MM-DD) in UTC.
export type PeriodBounds = { from: string; to: string };
export type PeriodPreset = 'lastMonth' | 'last3Months' | 'last12Months' | 'yearToDate' | 'previousYear';

const pad = (value: number) => String(value).padStart(2, '0');
export const isIsoDay = (value: string | undefined): value is string => Boolean(value) && /^\d{4}-\d{2}-\d{2}$/.test(value!) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
const lastDayOf = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const parts = (iso: string) => ({ year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)), day: Number(iso.slice(8, 10)) });

/** First and last day of the month containing `iso` (a day or a first-of-month bucket value). */
export function monthBounds(iso: string): PeriodBounds {
  const { year, month } = parts(iso);
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(lastDayOf(year, month))}` };
}

export const yearBounds = (year: number): PeriodBounds => ({ from: `${year}-01-01`, to: `${year}-12-31` });

function shiftMonths(iso: string, months: number): string {
  const { year, month } = parts(iso);
  const index = year * 12 + (month - 1) + months;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}-01`;
}

/**
 * Presets are anchored on the latest day that holds data (not on "today"): a dataset that ends in August must still give
 * a meaningful "last month". Each result is a closed [from, to] range of whole months or years.
 */
export function presetBounds(preset: PeriodPreset, latest: string): PeriodBounds {
  const month = monthBounds(latest);
  if (preset === 'lastMonth') return month;
  if (preset === 'last3Months') return { from: shiftMonths(month.from, -2), to: month.to };
  if (preset === 'last12Months') return { from: shiftMonths(month.from, -11), to: month.to };
  const { year } = parts(latest);
  if (preset === 'yearToDate') return { from: `${year}-01-01`, to: month.to };
  return yearBounds(year - 1);
}

export type PeriodKind = { kind: 'month'; label: string } | { kind: 'year'; label: string } | { kind: 'range' } | { kind: 'open' };

/** Classifies a selection so it can be named ("Aug 2026", "2025") instead of printed as two dates. */
export function classifyPeriod(from?: string, to?: string): PeriodKind {
  if (!isIsoDay(from) || !isIsoDay(to)) return { kind: 'open' };
  const month = monthBounds(from);
  if (month.from === from && month.to === to) return { kind: 'month', label: from.slice(0, 7) };
  const { year } = parts(from);
  if (from === `${year}-01-01` && to === `${year}-12-31`) return { kind: 'year', label: String(year) };
  return { kind: 'range' };
}

export function describePeriod(from: string | undefined, to: string | undefined, locale: string): string {
  const day = (iso: string) => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${iso}T00:00:00.000Z`));
  const kind = classifyPeriod(from, to);
  if (kind.kind === 'month') return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${kind.label}-01T00:00:00.000Z`));
  if (kind.kind === 'year') return kind.label;
  if (isIsoDay(from) && isIsoDay(to)) return `${day(from)} – ${day(to)}`;
  if (isIsoDay(from)) return `≥ ${day(from)}`;
  if (isIsoDay(to)) return `≤ ${day(to)}`;
  return '';
}
