/* oxlint-disable react/only-export-components */
import { createContext, useContext, type ReactNode } from 'react';

interface PermissionContextValue {
  can: (permission: string) => boolean;
  permissions: string[];
  isLoading: boolean;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

/** MOCK para demo: todos los permisos habilitados, sin llamadas a API.
 *  TODO: reemplazar con PermissionProvider real cuando CoreCrow esté listo. */
export function MockPermissionProvider({ children }: { children: ReactNode }) {
  // Mock: dar todos los permisos posibles para que la demo funcione sin restricciones
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
  ];

  return (
    <PermissionContext.Provider
      value={{
        can: () => true, // Todo permitido en mock
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
    throw new Error('usePermissions must be used within MockPermissionProvider');
  }
  return context;
}