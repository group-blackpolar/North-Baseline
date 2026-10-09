// Unsaved-work recovery. The Studio mirrors the dirty document to sessionStorage (per user-visible tab, cleared when the
// tab closes) so a reload, a crash-restore or an accidental navigation does not lose edits. It stores the document only
// (no tokens, no credentials: bindings are references, never connection details) plus the server ETag it was based on;
// it is offered back only when that ETag still matches the server draft, so recovery can never overwrite newer work.
// Storage is injected and the module is framework-free and unit-tested with `node --test`.

export interface RecoveryStore { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export interface RecoveryEntry<T> { baseEtag: string; savedAt: number; document: T }

export const RECOVERY_TTL_MS = 12 * 60 * 60 * 1000;
export const RECOVERY_MAX_BYTES = 1_500_000;
export const recoveryKey = (organizationId: string, panelId: string) => `north.studio.recovery.${organizationId}.${panelId}`;

export function writeRecovery<T>(store: RecoveryStore | null, key: string, entry: RecoveryEntry<T>): boolean {
  if (!store) return false;
  try {
    const raw = JSON.stringify(entry);
    if (raw.length > RECOVERY_MAX_BYTES) return false;
    store.setItem(key, raw);
    return true;
  } catch { return false; /* quota or storage disabled: recovery is best-effort */ }
}

export function readRecovery<T>(store: RecoveryStore | null, key: string, now = Date.now()): RecoveryEntry<T> | null {
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as RecoveryEntry<T>;
    if (!entry || typeof entry.baseEtag !== 'string' || typeof entry.savedAt !== 'number' || now - entry.savedAt > RECOVERY_TTL_MS || entry.document == null) { store.removeItem(key); return null; }
    return entry;
  } catch { return null; }
}

export function clearRecovery(store: RecoveryStore | null, key: string): void {
  try { store?.removeItem(key); } catch { /* ignore */ }
}

/** Offer recovery only when it was based on the draft the server still has and actually differs from it. */
export function shouldOffer<T>(entry: RecoveryEntry<T> | null, serverEtag: string, serverDocument: T): boolean {
  return Boolean(entry && entry.baseEtag === serverEtag && JSON.stringify(entry.document) !== JSON.stringify(serverDocument));
}
