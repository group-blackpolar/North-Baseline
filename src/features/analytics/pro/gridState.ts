// Pure helpers behind the data grid: column view state, paging maths, CSV and sparkline series. No React, so they are
// unit-tested with `node --test`.
import type { AnalyticsRow } from '../types';

export type GridColumn = {
  key: string;
  label: string;
  kind: 'text' | 'number' | 'decimal' | 'date' | 'month' | 'year' | 'rank' | 'bar' | 'badge' | 'sparkline' | 'actions';
  align?: 'left' | 'center' | 'right';
  width?: number;
  sortable?: boolean;
  hidden?: boolean;
  barTone?: string;
  /** Discrete intensity background proportional to the column maximum on the current page. */
  heat?: boolean;
  /** Show 0 as a dash (pivot cells with nothing in them). */
  zeroDash?: boolean;
};

export type GridView = { order: string[]; hidden: string[]; widths: Record<string, number> };

const KINDS = new Set(['text', 'number', 'decimal', 'date', 'month', 'year', 'rank', 'bar', 'badge', 'sparkline', 'actions']);

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
      ...(column.heat === true ? { heat: true } : {}),
      ...(column.zeroDash === true ? { zeroDash: true } : {}),
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

// ponytail: CORECROW does not say whether more rows exist, so a page that is a whole multiple of 100 (the default and every
// published trend limit) is followed by one more request. Replace with a `hasMore` from the API if limits stop being round.
/**
 * Reads every page of a binding whose rows come back in a stable order. `complete: false` means rows are missing (page cap
 * reached, or a source that ignores offsets): whatever is built from them would be cut off and must not be shown.
 */
export async function collectPages<R extends { rows: unknown[] }>(fetchPage: (offset: number) => Promise<R>, maxPages = 10): Promise<R & { complete: boolean }> {
  const first = await fetchPage(0);
  const size = first.rows.length;
  if (size < 100 || size % 100 !== 0) return { ...first, complete: true };
  const rows = [...first.rows];
  for (let page = 1; page < maxPages; page += 1) {
    const next = await fetchPage(rows.length);
    if (next.rows.length && JSON.stringify(next.rows[0]) === JSON.stringify(first.rows[0])) break;
    rows.push(...next.rows);
    if (next.rows.length < size) return { ...first, rows, rowCount: rows.length, complete: true };
  }
  return { ...first, rows, rowCount: rows.length, complete: false };
}

export type PageFit = {
  /** OUTER size of the scrolling box: scrollbars that appear inside it do not change it. */
  width: number; height: number;
  head: number; row: number; /** Grand-total row stuck to the bottom (0 without one). */ foot: number;
  /** Narrowest the table can be, and what a horizontal scrollbar takes when the box is narrower than that. */
  tableMinWidth: number; scrollbar: number;
};

/**
 * Rows that fit a fixed cell. Every input is independent of how many rows are asked for: a measure that depends on the
 * page size feeds back into it, and the table then requests two sizes in turn for ever.
 */
export function fitPageRows({ width, height, head, row, foot, tableMinWidth, scrollbar }: PageFit): number {
  const BORDERS = 2;
  const bar = tableMinWidth > width - BORDERS ? scrollbar : 0;
  return Math.max(3, Math.floor((height - BORDERS - head - foot - bar) / row));
}

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
