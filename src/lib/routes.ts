/** Routes which can be interpreted as organization URLs.  This is deliberately
 * small: all other first path segments are application-owned, never slugs. */
// Keep this list in lockstep with CoreCrow's `modules/tenancy/slug.ts`.
// A reserved backend slug must never be interpreted as a tenant URL here.
export const RESERVED_ROOTS = new Set([
  'admin', 'api', 'auth', 'billing', 'callback', 'create', 'dashboard',
  'desktop-auth', 'health', 'invitations', 'login', 'logout', 'me',
  'organizations', 'personal', 'privacy', 'register', 'security', 'settings', 'showcase',
  'sign-in', 'sign-up', 'support', 'terms', 'users', 'v1', 'verify',
  'workspace', 'workspaces', 'www',
]);

export type NorthRoute =
  | { kind: 'workspace'; path: string }
  | { kind: 'platform-admin'; path: string }
  | { kind: 'showcase'; organizationSlug: string; panel: { categorySlug: string; subcategorySlug: string; panelSlug: string } | null; path: string }
  | { kind: 'organization'; organizationSlug: string; path: string }
  | { kind: 'panel'; organizationSlug: string; categorySlug: string; subcategorySlug: string; panelSlug: string; path: string }
  | { kind: 'unknown'; path: string };

function segment(value: string) {
  try { return decodeURIComponent(value).trim().toLowerCase(); } catch { return ''; }
}

export function parseNorthRoute(pathname: string): NorthRoute {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const parts = path.split('/').filter(Boolean).map(segment);
  // Anonymous public showcase: /showcase/:org and /showcase/:org/:category/:subcategory/:panel
  if (parts[0] === 'showcase' && parts[1]) {
    if (parts.length === 2) return { kind: 'showcase', organizationSlug: parts[1], panel: null, path };
    if (parts.length === 5 && parts.every(Boolean)) return { kind: 'showcase', organizationSlug: parts[1], panel: { categorySlug: parts[2], subcategorySlug: parts[3], panelSlug: parts[4] }, path };
    return { kind: 'unknown', path };
  }
  if (parts[0] === 'workspace') {
    return parts[1] === 'admin' ? { kind: 'platform-admin', path } : { kind: 'workspace', path };
  }
  if (parts.length === 1 && parts[0] && !RESERVED_ROOTS.has(parts[0])) {
    return { kind: 'organization', organizationSlug: parts[0], path };
  }
  if (parts.length === 4 && parts.every(Boolean) && !RESERVED_ROOTS.has(parts[0])) {
    return { kind: 'panel', organizationSlug: parts[0], categorySlug: parts[1], subcategorySlug: parts[2], panelSlug: parts[3], path };
  }
  return { kind: 'unknown', path };
}

export function currentNorthRoute() {
  return parseNorthRoute(window.location.pathname);
}

export function replacePath(path: string) {
  if (window.location.pathname !== path) {
    window.history.replaceState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

/** History does not emit popstate for pushState. Notify the SPA explicitly so
 * URL and organization state update as one navigation transaction. */
export function pushPath(path: string) {
  if (window.location.pathname !== path) {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}
