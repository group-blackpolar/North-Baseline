/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchPermissions, type PermissionSet } from '@/lib/permissions';

interface PermissionContextValue {
  permissionSet: PermissionSet | null;
  isLoadingPermissions: boolean;
  can: (permission?: string) => boolean;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

export function PermissionProvider({
  organizationId,
  workspaceId,
  role,
  children,
}: {
  organizationId: string;
  workspaceId: string | null;
  role: string;
  children: ReactNode;
}) {
  const [permissionSet, setPermissionSet] = useState<PermissionSet | null>(null);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);

  useEffect(() => {
    let alive = true;
    setIsLoadingPermissions(true);
    fetchPermissions(organizationId, workspaceId, role)
      .then((set) => {
        if (alive) setPermissionSet(set);
      })
      .catch(() => {
        if (alive) setPermissionSet({ permissions: [], source: 'role-fallback' });
      })
      .finally(() => {
        if (alive) setIsLoadingPermissions(false);
      });
    return () => {
      alive = false;
    };
  }, [organizationId, workspaceId, role]);

  const can = useCallback(
    (permission?: string) => {
      if (!permission) return true;
      const list = permissionSet?.permissions ?? [];
      return list.includes('*') || list.includes(permission);
    },
    [permissionSet]
  );

  return (
    <PermissionContext.Provider value={{ permissionSet, isLoadingPermissions, can }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (!context) throw new Error('usePermissions must be used within PermissionProvider');
  return context;
}