/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useState, useEffect, type ReactNode } from 'react';
import { getWorkspaces } from '@/lib/organizations';
import { useAppErrorSafe } from '@/context/ErrorContext';
import { hasEstablishedSession, markSessionEstablished } from '@/lib/sessionState';
import { PERSONAL_ORG_ID, PERSONAL_WORKSPACE_ID } from '@/lib/personalCatalog';
import { getDemoWorkspaces, isDemoOrganization } from '@/lib/demo/store';


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
      if (isDemoOrganization(organizationId)) {
        const ws = getDemoWorkspaces(organizationId);
        markSessionEstablished();
        setWorkspaces(ws);
        setActiveWorkspace((current) => current ?? ws[0] ?? null);
        return; // el finally ya hace setIsLoading(false)
      }

      if (organizationId === PERSONAL_ORG_ID) {
        // Workspace personal virtual
        const personalWorkspace: Workspace = {
          id: PERSONAL_WORKSPACE_ID,
          organizationId: PERSONAL_ORG_ID,
          name: 'Personal Workspace',
          slug: 'personal',
          description: 'Tu espacio personal',
        };
        setWorkspaces([personalWorkspace]);
        setActiveWorkspace(personalWorkspace);
        markSessionEstablished();
      } else {
        const wss = await getWorkspaces(organizationId);
        markSessionEstablished();
        setWorkspaces(wss);
        if (wss.length > 0) setActiveWorkspace((current) => current ?? wss[0]);
      }
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