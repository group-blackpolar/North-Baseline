/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useState, useEffect, type ReactNode } from 'react';
import { getOrganizations } from '@/lib/organizations';
import { hasEstablishedSession, markSessionEstablished } from '@/lib/sessionState';
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
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrganizations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const apiOrgs = await getOrganizations();
      markSessionEstablished();
      // Demo organizations must never stand in for an authoritative tenant list.
      const effective = ensurePersonalWorkspace(apiOrgs);
      setOrganizations(effective);
      setActiveOrganization((current) => current ?? effective[0] ?? null);
      return effective;
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401 && !hasEstablishedSession()) {
        onAuthError?.();
        return [];
      }
      // The isolated personal workspace remains available offline. Do not invent
      // organization membership or organization data after an API failure.
      const personalOnly = ensurePersonalWorkspace([]);
      setOrganizations(personalOnly);
      setActiveOrganization((current) => current?.id === PERSONAL_ORG_ID ? current : personalOnly[0] ?? null);
      return personalOnly;
    } finally {
      setIsLoading(false);
    }
  }, [onAuthError]);

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations, user.id]);

  const switchOrganization = (orgId: string) => {
    const org = organizations.find((o) => o.id === orgId);
    if (org) {
      setActiveOrganization(org);
    }
  };

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        activeOrganization,
        isLoading,
        error,
        switchOrganization,
        refresh: loadOrganizations,
      }}
    >
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
