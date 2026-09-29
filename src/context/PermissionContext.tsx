/* oxlint-disable react/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchPermissions } from '@/lib/permission';
import { PERSONAL_ORG_ID } from '@/lib/demo/store';

interface PermissionContextValue {
  can: (permission: string) => boolean;
  permissions: string[];
  isLoading: boolean;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

export function PermissionProvider({
  organizationId,
  children,
}: {
  organizationId?: string;
  children: ReactNode;
}) {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Personal is a user-scoped surface, not a tenant. It has no organization
    // permissions and must never be sent to CoreCrow as an organization id.
    if (!organizationId || organizationId === PERSONAL_ORG_ID) {
      setPermissions([]);
      setIsLoading(false);
      return;
    }

    let live = true;
    setPermissions([]);
    setIsLoading(true);
    void fetchPermissions(organizationId)
      .then((result) => {
        if (live) setPermissions(result.permissions);
      })
      .catch(() => {
        // Navigation is default-deny when capability discovery fails.
        if (live) setPermissions([]);
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
      permissions,
      isLoading,
    };
  }, [isLoading, permissions]);

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
