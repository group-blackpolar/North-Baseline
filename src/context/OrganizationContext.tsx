/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useState, useEffect, type ReactNode } from 'react';
import { getOrganizations } from '@/lib/organizations';
import { useAppErrorSafe } from '@/context/ErrorContext';
import { hasEstablishedSession, markSessionEstablished } from '@/lib/sessionState';
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
      const apiOrgs = await getOrganizations();
      markSessionEstablished();

      // Fallback demo: si la API no devuelve orgs reales, usar demo store
      // (incluye Personal + SHARK sembrados + cualquier org creada vía modal)
      const effective = apiOrgs.length > 0 ? apiOrgs : getDemoOrganizations();
      setOrganizations(effective);
      setActiveOrganization((current) => current ?? effective[0] ?? null);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401 && !hasEstablishedSession()) {
        // 401 en el primer fetch (cookie aún no aceptada): logout silencioso
        onAuthError?.();
        return;
      }
      // En otros errores, intentar el fallback demo para no bloquear la demo
      const fallback = getDemoOrganizations();
      if (fallback.length > 0) {
        setOrganizations(fallback);
        setActiveOrganization((current) => current ?? fallback[0] ?? null);
      } else {
        appError?.classifyAndRaise(err);
        setError(err instanceof Error ? err.message : 'Error al cargar organizaciones');
      }
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