import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { Login } from '@/views/Login';
import { OrganizationRail } from '@/components/organization/OrganizationRail';
import { CategoryRail } from '@/components/organization/CategoryRail';
import { ContextSidebar } from '@/views/Sidebar';
import { TabBar } from '@/components/tabs/TabBar';
import { CurrentPath } from '@/components/tabs/CurrentPath';
import { SplitContent } from '@/components/layout/SplitContent';
import { LayoutSwitcher } from '@/components/layout/LayoutSwitcher';
import { LayoutProvider } from '@/context/LayoutContext';
import { OrganizationProvider, useOrganization } from '@/context/OrganizationContext';
import { WorkspaceProvider, useWorkspace } from '@/context/WorkspaceContext';
import { TabsProvider } from '@/context/TabsContext';
import { CatalogProvider } from '@/context/CatalogContext';
import { PermissionProvider } from '@/context/PermissionContext';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { SessionGuard } from '@/components/session/SessionGuard';
import { ErrorProvider } from '@/context/ErrorContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton';

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
      <EmptyState icon={Building2} title={t('empty.org.title')} body={t('empty.org.body')} className="w-full max-w-sm" />
    </div>
  );
}

function WorkspaceGate({ organizationId, role, user }: { organizationId: string; role: string; user: SessionUser }) {
  const { activeWorkspace } = useWorkspace();
  const activeWorkspaceId = activeWorkspace?.id ?? null;

  return (
    <CatalogProvider workspaceId={activeWorkspaceId}>
      <PermissionProvider organizationId={organizationId} workspaceId={activeWorkspaceId} role={role}>
        <TabsProvider>
          <LayoutProvider>
            <NotificationProvider>
              <div className="h-screen w-screen flex bg-background text-text">
                <OrganizationRail />
                <CategoryRail />
                <ContextSidebar />
                <div className="flex-1 flex flex-col min-w-0">
                  <CurrentPath />
                  <TabBar />
                  <div className="flex-1 flex flex-col min-h-0">
                    <SplitContent user={user} />
                  </div>
                </div>
                <LayoutSwitcher />
              </div>
            </NotificationProvider>
          </LayoutProvider>
        </TabsProvider>
      </PermissionProvider>
    </CatalogProvider>
  );
}

function AppShell({ user }: { user: SessionUser }) {
  const { activeOrganization, isLoading } = useOrganization();
  if (isLoading) return <ShellSkeleton />;
  if (!activeOrganization) return <NoOrganizationState />;
  return (
    <WorkspaceProvider organizationId={activeOrganization.id}>
      <WorkspaceGate organizationId={activeOrganization.id} role={user.role} user={user} />
    </WorkspaceProvider>
  );
}

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
        if (!sessionUser) return;
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
        onSuccess={setUser}
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
        <OrganizationProvider user={user}>
          <AppShell user={user} />
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

function TermsAcceptance({
  version,
  onAccept,
  error,
}: {
  version: string;
  onAccept: () => Promise<void>;
  error: string;
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-6 text-text">
      <div className="np-card w-full max-w-md space-y-4 p-6">
        <h1 className="font-display text-xl font-semibold">Acepta los términos</h1>
        <p className="text-sm text-text-secondary">Versión vigente: {version}</p>
        {error && <p className="text-sm text-error">{error}</p>}
        <button
          onClick={() => void onAccept()}
          className="north-primary rounded-md bg-text px-4 py-2 text-sm font-medium text-background transition-opacity duration-150 hover:opacity-90"
        >
          Aceptar y continuar
        </button>
      </div>
    </div>
  );
}