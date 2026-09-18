/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useState, useEffect, type ReactNode } from 'react';
import { getOrganizations } from '@/lib/organizations';
import { useAppErrorSafe } from '@/context/ErrorContext';
import { hasEstablishedSession, markSessionEstablished } from '@/lib/sessionState';
import { PERSONAL_ORG_ID } from '@/lib/personalCatalog';
import { getDemoOrganizations } from '@/lib/demo/store';


type Organization = Awaited<ReturnType<typeof getOrganizations>>[number];

interface OrganizationContextValue {
  organizations: Organization[];
  activeOrganization: Organization | null;
  isLoading: boolean;
  error: string | null;
  switchOrganization: (orgId: string) => void;
  refresh: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

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

      const orgs = await getOrganizations();
      markSessionEstablished();
      const effective = orgs.length > 0 ? orgs : getDemoOrganizations();
      setOrganizations(effective);
      setActiveOrganization((current) => current ?? effective[0] ?? null);

      if (orgs.length === 0) {
        // Usuario sin organizaciones: crear workspace personal virtual
        const personalOrg: Organization = {
          id: PERSONAL_ORG_ID,
          name: 'Personal',
          slug: 'personal',
          avatarUrl: null,
        };
        setOrganizations([personalOrg]);
        setActiveOrganization(personalOrg);
      } else {
        setOrganizations(orgs);
        setActiveOrganization((current) => current ?? orgs[0]);
      }
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401 && !hasEstablishedSession()) {
        onAuthError?.();
        return;
      }
      appError?.classifyAndRaise(err);
      setError(err instanceof Error ? err.message : 'Error al cargar organizaciones');
    } finally {
      setIsLoading(false);
    }
  }, [appError, onAuthError]);

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations, user.id]);

  const switchOrganization = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
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