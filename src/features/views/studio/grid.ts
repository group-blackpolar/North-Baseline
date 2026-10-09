// Pure 12-column grid maths for the Views Studio canvas. Positions use the same contract CORECROW validates
// (x 0-11, w 1-12, x+w <= 12, y >= 0, h 1-100), so nothing produced here can be rejected for geometry.
// Framework-free and unit-tested with `node --test`.

export interface Cell { x: number; y: number; w: number; h: number }
export interface GridItem extends Cell { id: string }

export const COLUMNS = 12;
export const MAX_ROWS = 10_000;
export const MAX_HEIGHT = 100;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value)));

/** Force a cell inside the grid contract. */
export function clampCell(cell: Cell): Cell {
  const w = clamp(cell.w, 1, COLUMNS);
  const x = clamp(cell.x, 0, COLUMNS - w);
  return { x, y: clamp(cell.y, 0, MAX_ROWS), w, h: clamp(cell.h, 1, MAX_HEIGHT) };
}

export function overlaps(a: Cell, b: Cell): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** First empty row below everything already placed. */
export function bottomOf(items: ReadonlyArray<Cell>): number {
  return items.reduce((max, item) => Math.max(max, item.y + item.h), 0);
}

/**
 * Place `id` at `target`, then push every colliding item down (cascading) until nothing overlaps. The moved item
 * always keeps the requested cell. Other items only ever move downwards, so the result is deterministic and the
 * relative order of unaffected items is preserved.
 */
export function placeItem(items: ReadonlyArray<GridItem>, id: string, target: Cell): GridItem[] {
  const placed = clampCell(target);
  const result = items.map((item) => (item.id === id ? { ...item, ...placed } : { ...item }));
  const fixed = result.find((item) => item.id === id);
  if (!fixed) return result;
  // Process the others top-to-bottom so a pushed item can in turn push the ones below it.
  const queue = result.filter((item) => item.id !== id).sort((a, b) => a.y - b.y || a.x - b.x);
  const settled: GridItem[] = [fixed];
  for (const item of queue) {
    let guard = 0;
    while (guard++ < 1_000) {
      const blocker = settled.find((other) => overlaps(item, other));
      if (!blocker) break;
      item.y = Math.min(MAX_ROWS, blocker.y + blocker.h);
    }
    settled.push(item);
  }
  return result;
}

/**
 * Cell for a new item of size w×h. It goes beside what is already on the last row band when there is room (so a KPI row
 * fills left to right), otherwise at the left of the first free row below everything.
 */
export function appendCell(items: ReadonlyArray<Cell>, w: number, h: number): Cell {
  const bottom = bottomOf(items);
  if (items.length > 0) {
    const bandTop = items.reduce((max, item) => Math.max(max, item.y), 0);
    for (let x = 0; x + w <= COLUMNS; x++) {
      const candidate = clampCell({ x, y: bandTop, w, h });
      if (!items.some((item) => overlaps(candidate, item))) return candidate;
    }
  }
  return clampCell({ x: 0, y: bottom, w, h });
}

/** Move by whole cells (keyboard), staying inside the grid. */
export function nudge(cell: Cell, dx: number, dy: number): Cell {
  return clampCell({ ...cell, x: cell.x + dx, y: cell.y + dy });
}

/** Resize by whole cells (keyboard), keeping the left/top edge fixed. */
export function growBy(cell: Cell, dw: number, dh: number): Cell {
  return clampCell({ ...cell, w: Math.min(cell.w + dw, COLUMNS - cell.x), h: cell.h + dh });
}

export type ResizeHandle = 'e' | 's' | 'se' | 'w' | 'sw';

/** Apply a pointer delta (in whole cells) to a resize gesture. West handles move the left edge and keep the right edge. */
export function resizeCell(start: Cell, handle: ResizeHandle, dCols: number, dRows: number): Cell {
  let { x, w, h } = start;
  if (handle === 'e' || handle === 'se') w = start.w + dCols;
  if (handle === 'w' || handle === 'sw') {
    const right = start.x + start.w;
    x = Math.min(right - 1, Math.max(0, start.x + dCols));
    w = right - x;
  }
  if (handle === 's' || handle === 'se' || handle === 'sw') h = start.h + dRows;
  return clampCell({ x, y: start.y, w: Math.min(w, COLUMNS - x), h });
}

/** Pointer position -> cell index, given measured column width and (possibly uneven) row track sizes. */
export function columnAt(offsetX: number, gridWidth: number, gap: number): number {
  const cell = (gridWidth - gap * (COLUMNS - 1)) / COLUMNS;
  if (cell <= 0) return 0;
  return clamp(Math.floor(offsetX / (cell + gap)), 0, COLUMNS - 1);
}

export function rowAt(offsetY: number, tracks: ReadonlyArray<number>, gap: number): number {
  let top = 0;
  for (let row = 0; row < tracks.length; row++) {
    const bottom = top + tracks[row]! + gap;
    if (offsetY < bottom) return row;
    top = bottom;
  }
  // Below the last track: extend using the last known track height so drops beyond the content append rows.
  const last = (tracks[tracks.length - 1] ?? 32) + gap;
  return tracks.length + Math.max(0, Math.floor((offsetY - top) / last));
}

/** Keep order consistent with reading order (top-to-bottom, left-to-right) for the given breakpoint positions. */
export function readingOrder<T extends { id: string }>(items: ReadonlyArray<T>, position: (item: T) => Cell): T[] {
  return items.slice().sort((a, b) => {
    const pa = position(a); const pb = position(b);
    return pa.y - pb.y || pa.x - pb.x;
  });
}

export interface GridMetrics { width: number; gap: number; tracks: number[] }
const DEFAULT_ROW = 32;

/** Pixel rectangle (relative to the grid's top-left) of a cell, for ghost/guide overlays. */
export function cellRect(cell: Cell, metrics: GridMetrics): { left: number; top: number; width: number; height: number } {
  const { width, gap, tracks } = metrics;
  const colWidth = (width - gap * (COLUMNS - 1)) / COLUMNS;
  const rowHeight = (row: number) => tracks[row] ?? tracks[tracks.length - 1] ?? DEFAULT_ROW;
  let top = 0;
  for (let row = 0; row < cell.y; row++) top += rowHeight(row) + gap;
  let height = 0;
  for (let row = cell.y; row < cell.y + cell.h; row++) height += rowHeight(row) + (row > cell.y ? gap : 0);
  return { left: cell.x * (colWidth + gap), top, width: cell.w * colWidth + (cell.w - 1) * gap, height };
}
