// Framework-free rules for where a session may land (unit-tested with `node --test`).
// CORECROW is the authority: `createdByOrganizationId` is set server-side and the same field gates every personal-scope
// endpoint (`requirePersonalWorkspace`). The e-mail format is never consulted.

/** Accounts created by an organization have no Personal Workspace. */
export function canUsePersonalWorkspace(user: { createdByOrganizationId?: string | null }) {
  return !user.createdByOrganizationId;
}

type Org = { id: string; slug?: string };

/**
 * Deterministic initial destination, first match wins:
 * 1. the organization named by the URL (deep link), if the user belongs to it;
 * 2. Personal Workspace, only when the account may use it;
 * 3. the organization that created the account;
 * 4. the first organization of the list (CORECROW returns it in a stable order).
 */
export function resolveInitialOrganization<T extends Org>(
  organizations: readonly T[],
  opts: { personalId: string; personalAllowed: boolean; managedByOrganizationId?: string | null; routeSlug?: string | null },
): T | null {
  const real = organizations.filter((org) => org.id !== opts.personalId);
  const personal = opts.personalAllowed ? organizations.find((org) => org.id === opts.personalId) : undefined;
  const bySlug = opts.routeSlug ? real.find((org) => org.slug === opts.routeSlug) : undefined;
  const own = opts.managedByOrganizationId ? real.find((org) => org.id === opts.managedByOrganizationId) : undefined;
  return bySlug ?? personal ?? own ?? real[0] ?? null;
}
