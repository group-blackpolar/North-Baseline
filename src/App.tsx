import { useEffect, useState, type ReactNode } from 'react';
import { Building2 } from 'lucide-react';
import { Login } from '@/views/Login';
import { OrganizationRail } from '@/components/organization/OrganizationRail';
import { CategoryRail } from '@/components/organization/CategoryRail';
import { ContextSidebar } from '@/views/Sidebar';
import { TabBar } from '@/components/tabs/TabBar';
import { CurrentPath } from '@/components/tabs/CurrenPath';
import { SplitContent } from '@/components/layout/SplitContent';
import { LayoutSwitcher } from '@/components/layout/LayoutSwitcher';
import { LayoutProvider } from '@/context/LayoutContext';
import { OrganizationProvider, useOrganization } from '@/context/OrganizationContext';
import { WorkspaceProvider, useWorkspace } from '@/context/WorkspaceContext';
import { TabsProvider, useTabs } from '@/context/TabsContext';
import { CatalogProvider, useCatalog } from '@/context/CatalogContext';
import { PermissionProvider } from '@/context/PermissionContext';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { SessionGuard } from '@/components/session/SessionGuard';
import { ErrorProvider } from '@/context/ErrorContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { clearSessionKilled, isSessionKilled } from '@/lib/sessionCleanup';

import {
  acceptTerms,
  completePendingOnboarding,
  FALLBACK_TERMS_VERSION,
  getIdentityConfig,
  getSession,
  logout as authLogout,
  type IdentityConfig,
  type SessionUser,
} from '@/lib/auth';
import { isTauri } from '@/lib/tauri';

// ---------------------------------------------------------------------------
// Shell Skeleton
// ---------------------------------------------------------------------------

function ShellSkeleton() {
  return (
    <div className="h-screen w-screen flex bg-background">
      <div className="w-14 border-r border-border bg-surface p-2 space-y-2">
        <Skeleton className="h-9 w-9 rounded-xl" />
        <Skeleton className="h-9 w-9 rounded-xl" />
      </div>
      <div className="w-64 border-r border-border bg-surface p-3 space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-2/3" />
      </div>
      <div className="flex-1 p-6 space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  );
}

function NoOrganizationState() {
  const { t } = useI18n();
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background p-6">
      <EmptyState
        icon={Building2}
        title={t('empty.org.title')}
        body={t('empty.org.body')}
        className="w-full max-w-sm"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CatalogSync — re-rutea la tab cuando el catálogo cambia
// ---------------------------------------------------------------------------

/** Wrapper que escucha cambios del catálogo y re-rutea la tab activa a una categoría válida.
 *  Cuando cambia la org, el catálogo cambia, y la tab vieja puede apuntar a categorías inexistentes. */
function CatalogSync({ children }: { children: ReactNode }) {
  const { categories, isLoading } = useCatalog();
  const { activeTab, navigate } = useTabs();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;

  useEffect(() => {
    // Esperar a que el catálogo termine de cargar y haya workspace
    if (isLoading || categories.length === 0 || !workspaceId) return;

    // Si no hay tab activa, navegar a la primera categoría
    if (!activeTab) {
      const firstCategory = categories[0];
      if (firstCategory) {
        navigate(firstCategory.id, firstCategory.subcategories[0]?.id ?? null);
      }
      return;
    }

    // Verificar si la tab actual apunta a una categoría que existe en el catálogo
    const hasCategory = categories.some((category) => category.id === activeTab.route.categoryId);
    if (!hasCategory) {
      // La tab apunta a una categoría inexistente → re-rutear a la primera categoría
      const firstCategory = categories[0];
      if (firstCategory) {
        navigate(firstCategory.id, firstCategory.subcategories[0]?.id ?? null);
      }
    }
  }, [categories, isLoading, activeTab, navigate, workspaceId]);

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// WorkspaceGate — ensambla providers internos
// ---------------------------------------------------------------------------

function WorkspaceGate({
  organizationId,
  role,
  user,
}: {
  organizationId: string;
  role: string;
  user: SessionUser;
}) {
  const { activeWorkspace } = useWorkspace();
  const activeWorkspaceId = activeWorkspace?.id ?? null;

  return (
    <CatalogProvider workspaceId={activeWorkspaceId}>
      <PermissionProvider
        organizationId={organizationId}
        workspaceId={activeWorkspaceId ?? undefined}
        role={role}
      >
        <TabsProvider>
          <LayoutProvider>
            <NotificationProvider>
              <CatalogSync>
                <div className="h-screen w-screen flex bg-background text-text">
                  <OrganizationRail />
                  <CategoryRail />
                  <ContextSidebar user={user} />
                  <div className="flex-1 flex flex-col min-w-0">
                    <CurrentPath />
                    <TabBar />
                    <div className="flex-1 flex flex-col min-h-0">
                      <SplitContent user={user} />
                    </div>
                  </div>
                  <LayoutSwitcher />
                </div>
              </CatalogSync>
            </NotificationProvider>
          </LayoutProvider>
        </TabsProvider>
      </PermissionProvider>
    </CatalogProvider>
  );
}

// ---------------------------------------------------------------------------
// AppShell — renderiza WorkspaceProvider con key para forzar re-mount
// ---------------------------------------------------------------------------

function AppShell({
  user,
  onAuthError,
}: {
  user: SessionUser;
  onAuthError: () => void;
}) {
  const { activeOrganization, isLoading } = useOrganization();

  if (isLoading) return <ShellSkeleton />;
  if (!activeOrganization) return <NoOrganizationState />;

  return (
    // FIX CLAVE: key={activeOrganization.id} fuerza re-mount completo del subtree
    // cuando cambia la org. Esto reinicia workspaces, tabs y catálogo desde cero,
    // exactamente igual que un full reload. Sin el key, React solo re-renderiza
    // y el estado viejo persiste (que era el bug original).
    <WorkspaceProvider
      key={activeOrganization.id}
      organizationId={activeOrganization.id}
      onAuthError={onAuthError}
    >
      <WorkspaceGate
        organizationId={activeOrganization.id}
        role={user.role}
        user={user}
      />
    </WorkspaceProvider>
  );
}

// ---------------------------------------------------------------------------
// AppInner — maneja sesión, términos y providers globales
// ---------------------------------------------------------------------------

function AppInner() {
  const { t } = useI18n();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(!isTauri());
  const [onboardingIssue, setOnboardingIssue] = useState('');
  const [identityConfig, setIdentityConfig] = useState<IdentityConfig>({
    termsVersion: FALLBACK_TERMS_VERSION,
    passwordMinLength: 12,
    passwordMaxLength: 128,
    googleAuthEnabled: false,
    captchaRequired: false,
  });

  useEffect(() => {
    getIdentityConfig().then(setIdentityConfig).catch(() => {});
    if (isTauri()) {
      setCheckingSession(false);
      return;
    }
    getSession()
      .then(async (sessionUser) => {
        // Kill-switch: sesión invalidada localmente → ignorar cookie zombi
        if (!sessionUser || isSessionKilled()) return;
        try {
          const onboarding = await completePendingOnboarding(sessionUser);
          setUser(onboarding?.user ?? sessionUser);
        } catch (error) {
          setUser(sessionUser);
          setOnboardingIssue(
            error instanceof Error ? error.message : 'No fue posible completar el registro'
          );
        }
      })
      .finally(() => setCheckingSession(false));
  }, []);

  const handleLogout = () => {
    void authLogout().catch(() => {});
    setUser(null);
  };

  if (checkingSession) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background text-text-muted font-display text-xs">
        {t('app.checkingSession')}
      </div>
    );
  }

  if (!user) {
    return (
      <Login
        onSuccess={(loggedUser) => {
          clearSessionKilled(); // login exitoso levanta el kill-switch
          setUser(loggedUser);
        }}
        onOnboardingIssue={(message) => {
          setOnboardingIssue(message);
        }}
      />
    );
  }

  const isSuperAdmin = user.role === 'SUPERADMIN';
  if (!isSuperAdmin && (user.termsVersion !== identityConfig.termsVersion || !user.termsAcceptedAt)) {
    return (
      <TermsAcceptance
        version={identityConfig.termsVersion}
        onAccept={async () => {
          try {
            setUser(await acceptTerms(user, identityConfig.termsVersion));
          } catch (error) {
            setOnboardingIssue(
              error instanceof Error ? error.message : 'No fue posible registrar la aceptación'
            );
          }
        }}
        error={onboardingIssue}
      />
    );
  }

  return (
    <ErrorProvider onLogout={handleLogout}>
      <SessionGuard onLogout={handleLogout}>
        <OrganizationProvider user={user} onAuthError={handleLogout}>
          <AppShell user={user} onAuthError={handleLogout} />
        </OrganizationProvider>
      </SessionGuard>
    </ErrorProvider>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppInner />
    </I18nProvider>
  );
}

// ---------------------------------------------------------------------------
// TermsAcceptance
// ---------------------------------------------------------------------------

function TermsAcceptance({
  version,
  onAccept,
  error,
}: {
  version: string;
  onAccept: () => Promise<void>;
  error: string;
}) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    try {
      await onAccept();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-6 text-text">
      <div className="np-card w-full max-w-md space-y-4 p-6">
        <h1 className="font-display text-xl font-semibold">
          {t('terms.title') || 'Acepta los términos'}
        </h1>
        <p className="text-sm text-text-secondary">
          {t('terms.version') || 'Versión vigente:'} {version}
        </p>
        {error && <p className="text-sm text-error">{error}</p>}
        <button
          type="button"
          onClick={() => void handleAccept()}
          disabled={loading}
          className="w-full h-10 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium text-sm transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? '…' : (t('terms.accept') || 'Aceptar y continuar')}
        </button>
      </div>
    </div>
  );
}