/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useState, useEffect, type ReactNode } from 'react';
import { getOrganizations } from '@/lib/organizations';
import { useAppErrorSafe } from '@/context/ErrorContext';
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
  refresh: () => Promise<void>;
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
  const appError = useAppErrorSafe();

  const loadOrganizations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const apiOrgs = await getOrganizations();
      markSessionEstablished();
      const base = apiOrgs.length > 0 ? apiOrgs : getDemoOrganizations();
      const effective = ensurePersonalWorkspace(base);
      setOrganizations(effective);
      setActiveOrganization((current) => current ?? effective[0] ?? null);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401 && !hasEstablishedSession()) {
        onAuthError?.();
        return;
      }
      const fallback = ensurePersonalWorkspace(getDemoOrganizations());
      setOrganizations(fallback);
      setActiveOrganization((current) => current ?? fallback[0] ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [appError, onAuthError]);

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