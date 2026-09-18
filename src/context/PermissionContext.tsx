/* oxlint-disable react/only-export-components */
import { createContext, useContext, type ReactNode } from 'react';

interface PermissionContextValue {
  can: (permission: string) => boolean;
  permissions: string[];
  isLoading: boolean;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

/** MOCK para demo: todos los permisos habilitados, sin llamadas a API.
 *  TODO: reemplazar con la versión real que llama a CoreCrow cuando esté listo. */
export function PermissionProvider({
  organizationId: _organizationId,
  workspaceId: _workspaceId,
  role: _role,
  children,
}: {
  organizationId?: string;
  workspaceId?: string;
  role?: string;
  children: ReactNode;
}) {
  const allPermissions = [
    'organization:read',
    'organization:write',
    'workspace:read',
    'workspace:write',
    'workspace:admin',
    'billing:read',
    'billing:write',
    'settings:manage',
    'members:read',
    'members:write',
    'members:admin',
    'audit:read',
    'categories:read',
    'categories:write',
    'catalog:manage',
  ];

  return (
    <PermissionContext.Provider
      value={{
        can: () => true,
        permissions: allPermissions,
        isLoading: false,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within PermissionProvider');
  }
  return context;
}   