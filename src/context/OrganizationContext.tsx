/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect, type ReactNode } from 'react';
import { getOrganizations } from '@/lib/organizations';
import { hasEstablishedSession, markSessionEstablished } from '@/lib/sessionState';
import { useInspection } from '@/lib/inspection';
import { getDemoOrganizations, PERSONAL_ORG_ID, type DemoOrganization } from '@/lib/demo/store';

type ApiOrganization = Awaited<ReturnType<typeof getOrganizations>>[number];
type Organization = ApiOrganization | DemoOrganization;

interface OrganizationContextValue {
  organizations: Organization[];
  activeOrganization: Organization | null;
  isLoading: boolean;
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
  const [error, setError] = useState<string | null>(null);
  // Parents recreate `onAuthError` on every render. Reading it through a ref keeps
  // `loadOrganizations` stable; otherwise each parent render re-fetched the list
  // and flipped `isLoading`, unmounting the whole shell (flashes / Profile loop).
  const onAuthErrorRef = useRef(onAuthError);
  useEffect(() => { onAuthErrorRef.current = onAuthError; }, [onAuthError]);
  const loadedRef = useRef(false);

  const loadOrganizations = useCallback(async () => {
    // Only the first load may blank the shell; later refreshes are silent.
    if (!loadedRef.current) setIsLoading(true);
    setError(null);
    try {
      const apiOrgs = await getOrganizations();
      markSessionEstablished();
      loadedRef.current = true;
      // Demo organizations must never stand in for an authoritative tenant list.
      const effective = ensurePersonalWorkspace(apiOrgs);
      setOrganizations(effective);
      setActiveOrganization((current) => current ?? effective[0] ?? null);
      return effective;
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401 && !hasEstablishedSession()) {
        onAuthErrorRef.current?.();
        return [];
      }
      // The isolated personal workspace remains available offline. Do not invent
      // organization membership or organization data after an API failure.
      loadedRef.current = true;
      const personalOnly = ensurePersonalWorkspace([]);
      setOrganizations(personalOnly);
      setActiveOrganization((current) => current?.id === PERSONAL_ORG_ID ? current : personalOnly[0] ?? null);
      return personalOnly;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadedRef.current = false;
    void loadOrganizations();
  }, [loadOrganizations, user.id]);

  const switchOrganization = useCallback((orgId: string) => {
    setActiveOrganization((current) => {
      if (current?.id === orgId) return current;
      return organizations.find((o) => o.id === orgId) ?? current;
    });
  }, [organizations]);

  const value = useMemo(
    () => ({ organizations, activeOrganization, isLoading, error, switchOrganization, refresh: loadOrganizations }),
    [organizations, activeOrganization, isLoading, error, switchOrganization, loadOrganizations],
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
