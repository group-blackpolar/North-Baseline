// Recoverable navigation (open tabs + active tab) per user and organization, kept in sessionStorage so a reload, a
// discarded mobile page or a restored browser tab lands where the person was. Only ids are stored (no documents, no
// data, no secrets); the catalog re-validates them against CORECROW on restore. Framework-free, `node --test`-able.

import type { FlowStorage } from './authFlow.ts';

export interface StoredTab { id: string; categoryId: string; subcategoryId: string | null; panelId?: string }
export interface NavSnapshot { tabs: StoredTab[]; activeId: string; savedAt: number }

const PREFIX = 'north-nav-v1:';
const TTL_MS = 12 * 60 * 60_000;
const MAX_TABS = 12;

export const navKey = (userId: string, organizationId: string) => `${PREFIX}${userId}:${organizationId}`;

function defaultStorage(): FlowStorage | null {
  if (typeof window === 'undefined') return null;
  try { return window.sessionStorage; } catch { return null; }
}

const isString = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200;

export function parseNavSnapshot(raw: string | null, now: number): NavSnapshot | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<NavSnapshot>;
    if (!value || !Array.isArray(value.tabs) || typeof value.savedAt !== 'number' || now - value.savedAt > TTL_MS) return null;
    const tabs: StoredTab[] = [];
    for (const item of value.tabs.slice(0, MAX_TABS)) {
      const tab = item as Partial<StoredTab>;
      if (!isString(tab.id) || !isString(tab.categoryId)) continue;
      if (tab.subcategoryId !== null && tab.subcategoryId !== undefined && !isString(tab.subcategoryId)) continue;
      tabs.push({ id: tab.id, categoryId: tab.categoryId, subcategoryId: tab.subcategoryId ?? null, ...(isString(tab.panelId) ? { panelId: tab.panelId } : {}) });
    }
    if (tabs.length === 0) return null;
    const activeId = isString(value.activeId) && tabs.some((tab) => tab.id === value.activeId) ? value.activeId : tabs[0]!.id;
    return { tabs, activeId, savedAt: value.savedAt };
  } catch {
    return null;
  }
}

export function loadNavState(key: string | null, now = Date.now(), storage: FlowStorage | null = defaultStorage()): NavSnapshot | null {
  if (!key || !storage) return null;
  try { return parseNavSnapshot(storage.getItem(key), now); } catch { return null; }
}

export function saveNavState(key: string | null, snapshot: { tabs: StoredTab[]; activeId: string }, now = Date.now(), storage: FlowStorage | null = defaultStorage()) {
  if (!key || !storage) return;
  try {
    if (snapshot.tabs.length === 0) { storage.removeItem(key); return; }
    storage.setItem(key, JSON.stringify({ tabs: snapshot.tabs.slice(0, MAX_TABS), activeId: snapshot.activeId, savedAt: now } satisfies NavSnapshot));
  } catch { /* storage unavailable or full: navigation is simply not restorable */ }
}

/** Forget every stored navigation (logout, user change). */
export function clearNavState(storage: Pick<Storage, 'length' | 'key' | 'removeItem'> | null = defaultStorage() as Storage | null) {
  if (!storage) return;
  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) { const key = storage.key(index); if (key?.startsWith(PREFIX)) keys.push(key); }
    keys.forEach((key) => storage.removeItem(key));
  } catch { /* ignore */ }
}
