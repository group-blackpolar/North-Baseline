import { useSyncExternalStore } from 'react';

/**
 * Platform inspection: an ADMIN/SUPERADMIN reads one organization without membership. State only names the
 * organization being inspected (not a secret); CORECROW re-validates role, target and read-only on every
 * request that carries `X-Platform-Inspect`.
 */
export interface InspectedOrganization {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  iconData: string | null;
  /** Audit correlation id issued by CORECROW when the inspection started (not an authentication session). */
  inspectionSessionId: string;
}

const KEY = 'north-platform-inspection-v1';
const listeners = new Set<() => void>();

function load(): InspectedOrganization | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as InspectedOrganization) : null;
  } catch {
    return null;
  }
}

let current: InspectedOrganization | null = load();

export const getInspection = () => current;

export function setInspection(next: InspectedOrganization | null) {
  current = next;
  try {
    if (next) sessionStorage.setItem(KEY, JSON.stringify(next));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: inspection simply does not survive a reload */
  }
  listeners.forEach((listener) => listener());
}

export function useInspection() {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getInspection,
  );
}

/** Header value for a request, or undefined when it must not carry inspection (non-GET or another resource). */
export function inspectionHeadersFor(path: string, method: string | undefined): Record<string, string> {
  const inspected = current;
  if (!inspected || (method ?? 'GET').toUpperCase() !== 'GET') return {};
  const scoped = path.startsWith(`/v1/organizations/${encodeURIComponent(inspected.id)}`) || path.startsWith('/v1/content/resolve');
  return scoped ? { 'X-Platform-Inspect': inspected.id, 'X-Platform-Inspection-Session': inspected.inspectionSessionId } : {};
}
