// Presentation helpers shared by the analytics components. Pure and framework-free: values are never derived or
// invented here, only formatted; every number shown comes from a CORECROW result.
import type { AnalyticsValue } from '../types';

export type ValueFormat = 'number' | 'decimal' | 'percent' | 'text' | 'date' | 'month';
export type Tone = 'blue' | 'violet' | 'green' | 'amber' | 'rose' | 'cyan' | 'slate';

/** Tone -> CSS custom properties. `blue` follows the organization accent so brand colors reach every card. */
export const TONE_VARS: Record<Tone, { fg: string; bg: string }> = {
  blue: { fg: 'var(--color-accent)', bg: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' },
  violet: { fg: '#7C5CFC', bg: 'color-mix(in srgb, #7C5CFC 13%, transparent)' },
  green: { fg: '#1F9D63', bg: 'color-mix(in srgb, #1F9D63 13%, transparent)' },
  amber: { fg: '#D98A0B', bg: 'color-mix(in srgb, #D98A0B 14%, transparent)' },
  rose: { fg: '#E0475B', bg: 'color-mix(in srgb, #E0475B 13%, transparent)' },
  cyan: { fg: '#0FA3C4', bg: 'color-mix(in srgb, #0FA3C4 13%, transparent)' },
  slate: { fg: '#5B6B83', bg: 'color-mix(in srgb, #5B6B83 13%, transparent)' },
};

export const toneOf = (value: unknown, fallback: Tone = 'blue'): Tone => (typeof value === 'string' && value in TONE_VARS ? value as Tone : fallback);

export function asNumber(value: AnalyticsValue | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
  return null;
}

/** Aggregates come back as ISO timestamps (UTC midnight) or YYYY-MM-DD; read them as UTC so no time zone shifts the day. */
export function parseDay(value: AnalyticsValue | undefined): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Spanish analytics use the Latin-American convention (1,234.56); other locales are unchanged. */
export const numberLocale = (locale: string) => (locale === 'es' ? 'es-419' : locale);

export function formatValue(value: AnalyticsValue | undefined, format: ValueFormat, rawLocale: string, decimals?: number): string {
  const locale = numberLocale(rawLocale);
  if (value === null || value === undefined) return '—';
  if (format === 'date' || format === 'month') {
    const date = parseDay(value);
    if (!date) return String(value);
    return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', year: 'numeric', month: format === 'month' ? 'short' : 'short', ...(format === 'date' ? { day: 'numeric' } : {}) }).format(date);
  }
  const number = asNumber(value);
  if (format === 'text' || number === null) return String(value);
  if (format === 'percent') return `${new Intl.NumberFormat(locale, { maximumFractionDigits: decimals ?? 1, minimumFractionDigits: decimals ?? 0 }).format(number)}%`;
  const places = decimals ?? (format === 'decimal' ? 2 : 0);
  return new Intl.NumberFormat(locale, { minimumFractionDigits: format === 'decimal' ? places : 0, maximumFractionDigits: places }).format(number);
}

/** Compact notation for tight spaces (axis ticks, map legends). */
export const compactNumber = (value: number, locale: string) => new Intl.NumberFormat(numberLocale(locale), { notation: 'compact', maximumFractionDigits: 1 }).format(value);

/** Whole-day distance from `now` to a data date, as "hace 3 días" (never finer than the data allows). */
export function relativeDay(value: AnalyticsValue | undefined, locale: string, now: Date = new Date()): string | null {
  const date = parseDay(value);
  if (!date) return null;
  const days = Math.round((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - date.getTime()) / 86_400_000);
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-days, 'day');
}

export type Delta = { absolute: number; percent: number | null; direction: 'up' | 'down' | 'flat' };

/** Period-over-period change. `percent` is null when the previous value is 0 (no meaningful ratio). */
export function deltaOf(current: number | null, previous: number | null): Delta | null {
  if (current === null || previous === null) return null;
  const absolute = current - previous;
  return { absolute, percent: previous === 0 ? null : (absolute / Math.abs(previous)) * 100, direction: absolute === 0 ? 'flat' : absolute > 0 ? 'up' : 'down' };
}

export const localizedText = (value: unknown, locales: string[]): string => {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  return String(locales.map((locale) => record[locale]).find((entry) => typeof entry === 'string') ?? Object.values(record).find((entry) => typeof entry === 'string') ?? '');
};
