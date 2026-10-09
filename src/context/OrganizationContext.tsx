/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect, type ReactNode } from 'react';
import { getOrganizations } from '@/lib/organizations';
import { checkSession } from '@/lib/auth';
import { markSessionEstablished } from '@/lib/sessionState';
import { useInspection } from '@/lib/inspection';
import { getDemoOrganizations, PERSONAL_ORG_ID, type DemoOrganization } from '@/lib/demo/store';
import { shallowEqualOrganization } from '@/lib/organizationState';

type ApiOrganization = Awaited<ReturnType<typeof getOrganizations>>[number];
type Organization = ApiOrganization | DemoOrganization;

/** initializing: first list not resolved yet. ready: the last load succeeded. error: the last load failed for a
 *  reason that says nothing about access (network, 5xx); the previous list, if any, is kept untouched. */
export type OrganizationStatus = 'initializing' | 'ready' | 'error';

interface OrganizationContextValue {
  organizations: Organization[];
  activeOrganization: Organization | null;
  isLoading: boolean;
  status: OrganizationStatus;
  error: string | null;
  switchOrganization: (orgId: string) => void;
  refresh: () => Promise<Organization[]>;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

/** Personal Workspace es una entidad especial del usuario: siempre debe existir,
 *  incluso si la API devuelve organizaciones reales. */
function ensurePersonalWorkspace(orgs: Organization[]): Organization[] {
  if (orgs.some((org) => org.id === PERSONAL_ORG_ID)) return orgs;
  const personal = getDemoOrganizations().find((org) => org.id === PERSONAL_ORG_ID);
  return personal ? [personal, ...orgs] : orgs;
}

export function OrganizationProvider({
  user,
  onAuthError,
  children,
}: {
  user: { id: string };
  onAuthError?: () => void;
  children: ReactNode;
}) {
  const [baseOrganizations, setOrganizations] = useState<Organization[]>([]);
  const inspection = useInspection();
  // A platform operator inspecting an organization sees it in the rail without any membership being created.
  const organizations = useMemo<Organization[]>(
    () => inspection && !baseOrganizations.some((org) => org.id === inspection.id)
      ? [...baseOrganizations, { id: inspection.id, name: inspection.name, slug: inspection.slug, iconData: inspection.iconData, avatarUrl: inspection.iconData, status: inspection.status }]
      : baseOrganizations,
    [baseOrganizations, inspection],
  );
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<OrganizationStatus>('initializing');
  const [error, setError] = useState<string | null>(null);
  // Parents recreate `onAuthError` on every render. Reading it through a ref keeps
  // `loadOrganizations` stable; otherwise each parent render re-fetched the list
  // and flipped `isLoading`, unmounting the whole shell (flashes / Profile loop).
  const onAuthErrorRef = useRef(onAuthError);
  useEffect(() => { onAuthErrorRef.current = onAuthError; }, [onAuthError]);
  /** True once an authoritative list has been received for this user. Only then is a failure "non-destructive". */
  const hasListRef = useRef(false);
  const listRef = useRef<Organization[]>([]);

  const loadOrganizations = useCallback(async () => {
    // Only the first load may blank the shell; later refreshes are silent.
    if (!hasListRef.current) setIsLoading(true);
    try {
      const apiOrgs = await getOrganizations({ force: hasListRef.current });
      markSessionEstablished();
      hasListRef.current = true;
      // Demo organizations must never stand in for an authoritative tenant list.
      const effective = ensurePersonalWorkspace(apiOrgs);
      listRef.current = effective;
      setOrganizations(effective);
      setError(null);
      setStatus('ready');
      setActiveOrganization((current) => {
        if (!current) return effective[0] ?? null;
        const fresh = effective.find((org) => org.id === current.id);
        // Membership really ended (authoritative list): leave the tenant. Otherwise keep the object identity unless
        // something visible changed, so a silent refresh never re-renders the whole shell.
        if (!fresh) return effective[0] ?? null;
        return shallowEqualOrganization(current, fresh) ? current : fresh;
      });
      return effective;
    } catch (err) {
      const httpStatus = (err as { status?: number }).status;
      // A 401 only means "expired" when CORECROW also says there is no session. A 401 with a live session, a 5xx
      // or a network failure is an API problem: never treat it as an access decision.
      if (httpStatus === 401) {
        const check = await checkSession();
        if (check.status === 'anonymous') {
          onAuthErrorRef.current?.();
          return [];
        }
      }
      setError(err instanceof Error ? err.message : 'Request failed');
      setStatus('error');
      if (!hasListRef.current) {
        // First load failed: Personal stays usable, but no organization membership is invented. Routes that need a
        // real organization show a retryable connection problem (see AuthenticatedRouter), not "no access".
        const personalOnly = ensurePersonalWorkspace([]);
        listRef.current = personalOnly;
        setOrganizations(personalOnly);
        setActiveOrganization((current) => current ?? personalOnly[0] ?? null);
        return personalOnly;
      }
      // A refresh failed: keep the tenant, its rail and the user's place exactly as they are.
      return listRef.current;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    hasListRef.current = false;
    void loadOrganizations();
  }, [loadOrganizations, user.id]);

  const switchOrganization = useCallback((orgId: string) => {
    setActiveOrganization((current) => {
      if (current?.id === orgId) return current;
      return organizations.find((o) => o.id === orgId) ?? current;
    });
  }, [organizations]);

  const value = useMemo(
    () => ({ organizations, activeOrganization, isLoading, status, error, switchOrganization, refresh: loadOrganizations }),
    [organizations, activeOrganization, isLoading, status, error, switchOrganization, loadOrganizations],
  );

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return context;
}
