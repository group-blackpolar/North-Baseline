/**
 * Recently opened published panels, kept per user and organization so closing a tab does not lose them (UX-01d).
 * Only identifiers and a title are stored; the Home resolves them against the current catalog, so anything the user can
 * no longer see simply does not appear.
 */
export type Recent = { panelId: string; categoryId: string; subcategoryId: string; title: string; openedAt: number };

export const MAX_RECENTS = 12;

/** Newest first, one entry per panel, capped. */
export function pushRecent(list: readonly Recent[], entry: Recent): Recent[] {
  return [entry, ...list.filter((item) => item.panelId !== entry.panelId)].slice(0, MAX_RECENTS);
}

/** Tolerant parse: anything malformed is dropped instead of breaking the Home. */
export function parseRecents(raw: string | null): Recent[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is Recent => Boolean(item) && typeof item === 'object'
        && typeof (item as Recent).panelId === 'string' && typeof (item as Recent).categoryId === 'string'
        && typeof (item as Recent).subcategoryId === 'string' && typeof (item as Recent).title === 'string'
        && Number.isFinite((item as Recent).openedAt))
      .slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

const key = (userId: string, organizationId: string) => `north-recents-v1:${userId}:${organizationId}`;
export const RECENTS_EVENT = 'north:recents';

export function readRecents(userId: string, organizationId: string): Recent[] {
  try {
    return parseRecents(localStorage.getItem(key(userId, organizationId)));
  } catch {
    return [];
  }
}

export function recordRecent(userId: string, organizationId: string, entry: Recent): void {
  try {
    localStorage.setItem(key(userId, organizationId), JSON.stringify(pushRecent(readRecents(userId, organizationId), entry)));
    window.dispatchEvent(new Event(RECENTS_EVENT));
  } catch {
    /* storage unavailable: recents are a convenience */
  }
}
