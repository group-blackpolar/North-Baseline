// Pure model for the Activity & Audit screen. CORECROW's audit trail is the source of truth; these helpers only
// categorize and filter the events that were already loaded (the API pages by `before` + `limit`, nothing else).

export interface AuditLike { id: string; actorId?: string | null; action: string; targetType?: string | null; targetId?: string | null; requestId?: string | null; metadata?: unknown; createdAt: string }

export interface AuditFilters { q: string; categories: string[]; actors: string[]; from: string; to: string }
export const emptyAuditFilters = (): AuditFilters => ({ q: '', categories: [], actors: [], from: '', to: '' });

/** `member.role_changed` -> `member`; `invitation:created` -> `invitation`. */
export const auditCategory = (action: string) => action.split(/[.:_/\s]/)[0]?.toLowerCase() || 'other';

const fold = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const flat = (value: unknown, out: string[] = [], depth = 0): string[] => {
  if (depth > 3) return out;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') out.push(String(value));
  else if (Array.isArray(value)) value.forEach((item) => flat(item, out, depth + 1));
  else if (value && typeof value === 'object') Object.entries(value as Record<string, unknown>).forEach(([key, item]) => { out.push(key); flat(item, out, depth + 1); });
  return out;
};

export function filterAudit<T extends AuditLike>(events: T[], filters: AuditFilters, actorName: (id: string) => string): T[] {
  const needle = fold(filters.q.trim());
  const from = filters.from ? Date.parse(`${filters.from}T00:00:00.000Z`) : null;
  const to = filters.to ? Date.parse(`${filters.to}T23:59:59.999Z`) : null;
  return events.filter((event) => {
    if (filters.categories.length && !filters.categories.includes(auditCategory(event.action))) return false;
    if (filters.actors.length && !(event.actorId && filters.actors.includes(event.actorId))) return false;
    const time = Date.parse(event.createdAt);
    if (from !== null && time < from) return false;
    if (to !== null && time > to) return false;
    if (!needle) return true;
    const haystack = [event.action, event.targetType ?? '', event.targetId ?? '', event.requestId ?? '', event.actorId ?? '', event.actorId ? actorName(event.actorId) : '', ...flat(event.metadata)].map(fold);
    return needle.split(/\s+/).every((word) => haystack.some((value) => value.includes(word)));
  });
}

/** Events grouped by calendar day (newest first), for the timeline. */
export function groupByDay<T extends AuditLike>(events: T[]): Array<{ day: string; items: T[] }> {
  const groups = new Map<string, T[]>();
  for (const event of events) {
    const day = event.createdAt.slice(0, 10);
    (groups.get(day) ?? groups.set(day, []).get(day)!).push(event);
  }
  return [...groups.entries()].map(([day, items]) => ({ day, items }));
}

// 'Hide from my view' is a presentation preference, never a deletion: CORECROW keeps every event. It lives in this
// browser only (per organization), is validated on read and can always be undone.
const hiddenKey = (organizationId: string) => `north-audit-hidden-v1:${organizationId}`;
export function loadHiddenAudit(organizationId: string): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(hiddenKey(organizationId)) ?? '[]');
    return new Set(Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string').slice(-5000) : []);
  } catch { return new Set(); }
}
export function saveHiddenAudit(organizationId: string, ids: Set<string>) {
  try { localStorage.setItem(hiddenKey(organizationId), JSON.stringify([...ids].slice(-5000))); } catch { /* storage unavailable */ }
}
