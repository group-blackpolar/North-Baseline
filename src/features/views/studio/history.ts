// Local, in-memory undo/redo for the Views Studio. This is deliberately NOT the persisted revision history: it only
// exists while the editor is open and is dropped when another view is loaded. Snapshots are immutable documents, so
// holding them is cheap (structural sharing). Framework-free and unit-tested with `node --test`.

export interface History<T> { past: T[]; future: T[]; lastKey: string | null; lastAt: number }

export const HISTORY_LIMIT = 100;
/** Edits with the same key inside this window collapse into one undo step (typing, slider drags). */
export const COALESCE_MS = 800;

export const emptyHistory = <T>(): History<T> => ({ past: [], future: [], lastKey: null, lastAt: 0 });

/** Record `previous` as an undo step before moving to a new state. */
export function record<T>(history: History<T>, previous: T, options: { key?: string; now?: number } = {}): History<T> {
  const now = options.now ?? Date.now();
  const key = options.key ?? null;
  const merge = key !== null && history.lastKey === key && now - history.lastAt < COALESCE_MS && history.past.length > 0;
  const past = merge ? history.past : [...history.past, previous].slice(-HISTORY_LIMIT);
  return { past, future: [], lastKey: key, lastAt: now };
}

export function undo<T>(history: History<T>, current: T): { history: History<T>; state: T } | null {
  const previous = history.past[history.past.length - 1];
  if (previous === undefined) return null;
  return { state: previous, history: { past: history.past.slice(0, -1), future: [current, ...history.future].slice(0, HISTORY_LIMIT), lastKey: null, lastAt: 0 } };
}

export function redo<T>(history: History<T>, current: T): { history: History<T>; state: T } | null {
  const next = history.future[0];
  if (next === undefined) return null;
  return { state: next, history: { past: [...history.past, current].slice(-HISTORY_LIMIT), future: history.future.slice(1), lastKey: null, lastAt: 0 } };
}
