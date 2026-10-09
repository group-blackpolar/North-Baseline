/* oxlint-disable react/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchPermissions } from '@/lib/permission';
import { PERSONAL_ORG_ID } from '@/lib/demo/store';

interface PermissionContextValue {
  can: (permission: string) => boolean;
  /** Navigation hint only: like `can`, but a failed discovery (network) never locks entries; CORECROW still authorizes each request. */
  canNavigate: (permission: string) => boolean;
  permissions: string[];
  /** True until the first discovery for this organization has settled (allowed, denied or failed). */
  isLoading: boolean;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

const isTenant = (organizationId?: string) => Boolean(organizationId) && organizationId !== PERSONAL_ORG_ID;

export function PermissionProvider({
  organizationId,
  children,
}: {
  organizationId?: string;
  children: ReactNode;
}) {
  const [permissions, setPermissions] = useState<string[]>([]);
  // A real tenant starts in the loading state: "not loaded yet" must never look like "denied".
  const [discoveryFailed, setDiscoveryFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(() => isTenant(organizationId));

  useEffect(() => {
    // Personal is a user-scoped surface, not a tenant. It has no organization
    // permissions and must never be sent to CoreCrow as an organization id.
    if (!organizationId || !isTenant(organizationId)) {
      setPermissions([]);
      setDiscoveryFailed(false);
      setIsLoading(false);
      return;
    }

    let live = true;
    setIsLoading(true);
    setDiscoveryFailed(false);
    void fetchPermissions(organizationId)
      .then((result) => {
        if (live) setPermissions(result.permissions);
      })
      .catch(() => {
        // Discovery failed: keep what was known and stop hiding entries behind an unknown (CORECROW still decides).
        if (live) setDiscoveryFailed(true);
      })
      .finally(() => {
        if (live) setIsLoading(false);
      });

    return () => {
      live = false;
    };
  }, [organizationId]);

  const value = useMemo<PermissionContextValue>(() => {
    const available = new Set(permissions);
    return {
      can: (permission) => available.has(permission),
      canNavigate: (permission) => discoveryFailed || available.has(permission),
      permissions,
      isLoading,
    };
  }, [discoveryFailed, isLoading, permissions]);

  return (
    <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within PermissionProvider');
  }
  return context;
}
