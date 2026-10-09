// Pure helpers behind the data grid: column view state, paging maths, CSV and sparkline series. No React, so they are
// unit-tested with `node --test`.
import type { AnalyticsRow, AnalyticsValue } from '../types';

export type GridColumn = {
  key: string;
  label: string;
  kind: 'text' | 'number' | 'decimal' | 'date' | 'month' | 'bar' | 'badge' | 'sparkline' | 'actions';
  align?: 'left' | 'center' | 'right';
  width?: number;
  sortable?: boolean;
  hidden?: boolean;
  barTone?: string;
};

export type GridView = { order: string[]; hidden: string[]; widths: Record<string, number> };

const KINDS = new Set(['text', 'number', 'decimal', 'date', 'month', 'bar', 'badge', 'sparkline', 'actions']);

/** Defensive parse of the component props: unknown column shapes are dropped, never guessed. */
export function parseColumns(value: unknown, label: (raw: unknown) => string): GridColumn[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): GridColumn[] => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const column = item as Record<string, unknown>;
    if (typeof column.key !== 'string') return [];
    const kind = typeof column.kind === 'string' && KINDS.has(column.kind) ? column.kind as GridColumn['kind'] : 'text';
    return [{
      key: column.key, label: label(column.label) || column.key, kind,
      ...(column.align === 'left' || column.align === 'center' || column.align === 'right' ? { align: column.align } : {}),
      ...(typeof column.width === 'number' ? { width: column.width } : {}),
      ...(typeof column.sortable === 'boolean' ? { sortable: column.sortable } : {}),
      ...(column.hidden === true ? { hidden: true } : {}),
      ...(typeof column.barTone === 'string' ? { barTone: column.barTone } : {}),
    }];
  });
}

export const defaultView = (columns: GridColumn[]): GridView => ({ order: columns.map((column) => column.key), hidden: columns.filter((column) => column.hidden).map((column) => column.key), widths: {} });

/** Reconciles a stored view with the current column set: removed columns vanish, new ones are appended. */
export function reconcileView(stored: unknown, columns: GridColumn[]): GridView {
  const base = defaultView(columns);
  if (!stored || typeof stored !== 'object') return base;
  const value = stored as Partial<GridView>;
  const known = new Set(base.order);
  const order = [...(Array.isArray(value.order) ? value.order.filter((key): key is string => typeof key === 'string' && known.has(key)) : [])];
  for (const key of base.order) if (!order.includes(key)) order.push(key);
  const hidden = Array.isArray(value.hidden) ? value.hidden.filter((key): key is string => typeof key === 'string' && known.has(key)) : base.hidden;
  const widths: Record<string, number> = {};
  if (value.widths && typeof value.widths === 'object') for (const [key, width] of Object.entries(value.widths)) if (known.has(key) && typeof width === 'number' && width >= 48 && width <= 640) widths[key] = Math.round(width);
  return { order, hidden, widths };
}

export const visibleColumns = (columns: GridColumn[], view: GridView): GridColumn[] => {
  const byKey = new Map(columns.map((column) => [column.key, column]));
  return view.order.flatMap((key) => (view.hidden.includes(key) || !byKey.has(key) ? [] : [byKey.get(key)!]));
};

export function moveColumn(view: GridView, key: string, offset: -1 | 1): GridView {
  const index = view.order.indexOf(key);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= view.order.length) return view;
  const order = [...view.order];
  [order[index], order[target]] = [order[target]!, order[index]!];
  return { ...view, order };
}

export function toggleColumn(view: GridView, key: string): GridView {
  return { ...view, hidden: view.hidden.includes(key) ? view.hidden.filter((item) => item !== key) : [...view.hidden, key] };
}

/** Page numbers for the pager: first, last, and a window around the current one, with `null` for gaps. */
export function pageWindow(page: number, pages: number, span = 2): Array<number | null> {
  if (pages <= 1) return [1];
  const keep = new Set([1, pages]);
  for (let item = page - span; item <= page + span; item += 1) if (item >= 1 && item <= pages) keep.add(item);
  const sorted = [...keep].sort((a, b) => a - b);
  // A gap of exactly one page is shown as that page: an ellipsis must hide at least two.
  return sorted.flatMap((item, index) => {
    const gap = index > 0 ? item - sorted[index - 1]! : 1;
    return gap > 2 ? [null, item] : gap === 2 ? [item - 1, item] : [item];
  });
}

export const rowKeyOf = (row: AnalyticsRow, keys: string[]): string => JSON.stringify(keys.map((key) => row[key] ?? null));

/** One ordered numeric series per row key, built only from the rows CORECROW returned. */
export function sparklineSeries(rows: AnalyticsRow[], rowKeys: string[], categoryKey: string, valueKey: string): Map<string, number[]> {
  const buckets = new Map<string, Array<[string, number]>>();
  for (const row of rows) {
    const value = row[valueKey];
    const category = row[categoryKey];
    if (typeof value !== 'number' || category === null || category === undefined) continue;
    const key = rowKeyOf(row, rowKeys);
    buckets.set(key, [...(buckets.get(key) ?? []), [String(category), value]]);
  }
  return new Map([...buckets].map(([key, points]) => [key, points.sort((a, b) => a[0].localeCompare(b[0])).map(([, value]) => value)]));
}

export const trendDirection = (values: number[]): 'up' | 'down' | 'flat' => {
  if (values.length < 2) return 'flat';
  const last = values[values.length - 1]!;
  const first = values[0]!;
  return last > first ? 'up' : last < first ? 'down' : 'flat';
};

const csvCell = (value: AnalyticsValue | undefined) => {
  const text = value === null || value === undefined ? '' : String(value);
  // Leading = + - @ would be read as a formula by spreadsheet apps; prefix a quote (OWASP CSV injection guidance).
  const safe = /^[=+\-@\t\r]/.test(text) && Number.isNaN(Number(text)) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

export function toCsv(columns: Array<{ key: string; label: string }>, rows: AnalyticsRow[]): string {
  return [columns.map((column) => csvCell(column.label)).join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column.key])).join(','))].join('\r\n');
}
