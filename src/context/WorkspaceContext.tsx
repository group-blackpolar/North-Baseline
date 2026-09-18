/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useState, useEffect, type ReactNode } from 'react';
import { getWorkspaces } from '@/lib/organizations';
import { useAppErrorSafe } from '@/context/ErrorContext';
import { hasEstablishedSession, markSessionEstablished } from '@/lib/sessionState';
import { getDemoWorkspaces, isDemoOrganization, type DemoWorkspace } from '@/lib/demo/store';

type ApiWorkspace = Awaited<ReturnType<typeof getWorkspaces>>[number];
type Workspace = ApiWorkspace | DemoWorkspace;

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
  onAuthError,
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

      // Orgs reales: llamar a la API
      const wss = await getWorkspaces(organizationId);
      markSessionEstablished();
      setWorkspaces(wss);
      setActiveWorkspace(wss[0] ?? null);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401 && !hasEstablishedSession()) {
        onAuthError?.();
        return;
      }
      appError?.classifyAndRaise(err);
      setError(err instanceof Error ? err.message : 'Error al cargar workspaces');
    } finally {
      setIsLoading(false);
    }
  }, [appError, organizationId, onAuthError]);

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