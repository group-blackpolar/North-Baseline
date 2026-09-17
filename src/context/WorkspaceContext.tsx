/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useState, useEffect, type ReactNode } from 'react';
import { getWorkspaces } from '@/lib/organizations';
import { useAppErrorSafe } from '@/context/ErrorContext';


type Workspace = Awaited<ReturnType<typeof getWorkspaces>>[number];

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isLoading: boolean;
  error: string | null;
  switchWorkspace: (wsId: string) => void;
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ organizationId, children }: { organizationId: string; children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const appError = useAppErrorSafe();


  const loadWorkspaces = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const wss = await getWorkspaces(organizationId);
      setWorkspaces(wss);
      if (wss.length > 0) setActiveWorkspace((current) => current ?? wss[0]);
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
    const ws = workspaces.find(w => w.id === wsId);
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