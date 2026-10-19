import type { ReportAccess } from './reportAccessApi.ts';

/** allowed: opens. restricted: exists, caller may not open it. unavailable: not configured. unknown: permissions could not be loaded. loading: still asking. */
export type CardState = 'allowed' | 'restricted' | 'unavailable' | 'unknown' | 'loading';
export type AccessLookup = { status: 'loading' } | { status: 'ready'; rows: Map<string, ReportAccess> } | { status: 'error' };

/** A failed or incomplete lookup is never read as access: it is `unknown`, not `allowed`. */
export function deriveCardState(access: AccessLookup, slug: string): CardState {
  if (access.status === 'loading') return 'loading';
  if (access.status === 'error') return 'unknown';
  const row = access.rows.get(slug);
  if (!row) return 'unknown';
  return row.state === 'ALLOWED' ? 'allowed' : row.state === 'RESTRICTED' ? 'restricted' : 'unavailable';
}
