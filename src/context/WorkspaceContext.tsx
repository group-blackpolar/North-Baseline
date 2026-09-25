/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useState, useEffect, type ReactNode } from 'react';
import { useAppErrorSafe } from '@/context/ErrorContext';
import { markSessionEstablished } from '@/lib/sessionState';
import { getDemoWorkspaces, isDemoOrganization, type DemoWorkspace } from '@/lib/demo/store';

type Workspace = DemoWorkspace;

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isLoading: boolean;
  error: string | null;
  switchWorkspace: (wsId: string) => void;
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  organizationId,
  onAuthError: _onAuthError,
  children,
}: {
  organizationId: string;
  onAuthError?: () => void;
  children: ReactNode;
}) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const appError = useAppErrorSafe();

  const loadWorkspaces = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Shortcut para orgs demo: no llamar a la API
      if (isDemoOrganization(organizationId)) {
        const demoWorkspaces = getDemoWorkspaces(organizationId);
        markSessionEstablished();
        setWorkspaces(demoWorkspaces);
        setActiveWorkspace(demoWorkspaces[0] ?? null);
        return;
      }

      // Real organizations are organization-scoped in the current CORECROW
      // contract. The former /workspaces route was removed, so keep this
      // compatibility provider empty while CatalogProvider loads authoritative
      // organization navigation directly.
      markSessionEstablished();
      setWorkspaces([]);
      setActiveWorkspace(null);
    } catch (err) {
      appError?.classifyAndRaise(err);
      setError(err instanceof Error ? err.message : 'Error al cargar workspaces');
    } finally {
      setIsLoading(false);
    }
  }, [appError, organizationId]);

  useEffect(() => {
    void loadWorkspaces();
  }, [loadWorkspaces]);

  const switchWorkspace = (wsId: string) => {
    const ws = workspaces.find((w) => w.id === wsId);
    if (ws) {
      setActiveWorkspace(ws);
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        isLoading,
        error,
        switchWorkspace,
        refresh: loadWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }
  return context;
}
