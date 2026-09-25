import { useEffect, useState, type ReactNode } from 'react';
import { Building2 } from 'lucide-react';
import { Login } from '@/views/Login';
import { TemporaryPasswordChange } from '@/views/TemporaryPasswordChange';
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
import {
  clearLocalSession,
  clearSessionKilled,
  isSessionKilled,
  markSessionKilled,
} from '@/lib/sessionCleanup';

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
import { acceptInvitation, resolvePublicOrganization, resolvePublishedPanel, type PublicOrganization } from '@/lib/organizations';
import { currentNorthRoute, replacePath, type NorthRoute } from '@/lib/routes';
import { GenericNotFound, OrganizationAccessGate } from '@/components/organization/OrganizationAccessGate';

const PENDING_ROUTE_INVITATION_KEY = 'north-pending-route-invitation-v1';
type PendingRouteInvitation = { token: string; path: string; userId?: string };
function loadPendingRouteInvitation(): PendingRouteInvitation | null {
  if (isTauri()) return null;
  try { const raw = sessionStorage.getItem(PENDING_ROUTE_INVITATION_KEY); const value = raw ? JSON.parse(raw) as PendingRouteInvitation : null; return value && typeof value.token === 'string' && typeof value.path === 'string' && (!value.userId || typeof value.userId === 'string') ? value : null; } catch { return null; }
}
function savePendingRouteInvitation(value: PendingRouteInvitation | null) {
  if (isTauri()) return;
  try { if (value) sessionStorage.setItem(PENDING_ROUTE_INVITATION_KEY, JSON.stringify(value)); else sessionStorage.removeItem(PENDING_ROUTE_INVITATION_KEY); } catch { /* storage unavailable */ }
}

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

  useEffect(() => {
    // The authoritative organization navigation is not workspace-scoped.
    if (isLoading || categories.length === 0) return;

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
  }, [categories, isLoading, activeTab, navigate]);

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// WorkspaceGate — ensambla providers internos
// ---------------------------------------------------------------------------

function WorkspaceGate({
  organizationId,
  role,
  user,
  route,
}: {
  organizationId: string;
  role: string;
  user: SessionUser;
  route: NorthRoute;
}) {
  const { activeWorkspace } = useWorkspace();
  const activeWorkspaceId = activeWorkspace?.id ?? null;

  return (
    <CatalogProvider workspaceId={activeWorkspaceId} organizationId={organizationId}>
      <PermissionProvider
        organizationId={organizationId}
        workspaceId={activeWorkspaceId ?? undefined}
        role={role}
      >
        <TabsProvider>
          <LayoutProvider>
            <NotificationProvider>
              <CatalogSync>
                <PublishedRouteIntent route={route} />
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
  route,
}: {
  user: SessionUser;
  onAuthError: () => void;
  route: NorthRoute;
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
        route={route}
      />
    </WorkspaceProvider>
  );
}

// ---------------------------------------------------------------------------
// AppInner — maneja sesión, términos y providers globales
// ---------------------------------------------------------------------------

function AppInner() {
  const { t } = useI18n();
  const route = useNorthRoute();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [accessAuthMode, setAccessAuthMode] = useState<'login' | 'signup' | null>(null);
  // Kept only in memory while the visitor completes authentication; never in
  // localStorage or the URL. It is discarded after acceptance/final failure.
  const [pendingRouteInvitation, setPendingRouteInvitation] = useState<PendingRouteInvitation | null>(loadPendingRouteInvitation);
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
          if (sessionUser.passwordChangeRequired) {
            setUser(sessionUser);
            return;
          }
          const onboarding = await completePendingOnboarding(sessionUser);
          const pending = loadPendingRouteInvitation();
          if (pending?.path && (!pending.userId || pending.userId === sessionUser.id)) replacePath(pending.path);
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

  useEffect(() => {
    if (!user) return;
    setPendingRouteInvitation((current) => {
      if (!current || !current.userId || current.userId === user.id) return current;
      savePendingRouteInvitation(null);
      return null;
    });
  }, [user]);

  const handleLogout = () => {
    void authLogout().catch(() => {}).finally(() => {
      clearLocalSession();
      markSessionKilled();
    });
    savePendingRouteInvitation(null); setPendingRouteInvitation(null); setUser(null);
  };

  const handleTemporaryPasswordComplete = async (updatedUser: SessionUser) => {
    try {
      const onboarding = await completePendingOnboarding(updatedUser);
      setUser(onboarding?.user ?? updatedUser);
      setOnboardingIssue('');
    } catch (error) {
      setUser(updatedUser);
      setOnboardingIssue(
        error instanceof Error ? error.message : 'No fue posible completar el registro'
      );
    }
  };

  if (checkingSession) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background text-text-muted font-display text-xs">
        {t('app.checkingSession')}
      </div>
    );
  }

  if (!user) {
    if ((route.kind === 'organization' || route.kind === 'panel') && !accessAuthMode) {
      return <OrganizationRouteGate
        route={route}
        authenticated={false}
        onSignIn={() => setAccessAuthMode('login')}
        onCreateAccount={() => setAccessAuthMode('signup')}
        onInvitation={(token) => { const value = { token, path: route.path }; setPendingRouteInvitation(value); savePendingRouteInvitation(value); setAccessAuthMode('login'); }}
      />;
    }
    return (
      <Login
        onSuccess={(loggedUser) => {
          clearSessionKilled(); // login exitoso levanta el kill-switch
          setUser(loggedUser);
        }}
        onOnboardingIssue={(message) => {
          setOnboardingIssue(message);
        }}
        initialMode={accessAuthMode ?? 'login'}
      />
    );
  }

  const isSuperAdmin = user.role === 'SUPERADMIN';
  if (user.passwordChangeRequired) {
    return (
      <TemporaryPasswordChange
        user={user}
        onComplete={(updatedUser) => {
          void handleTemporaryPasswordComplete(updatedUser);
        }}
        onLogout={handleLogout}
      />
    );
  }

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
          <AuthenticatedRouter user={user} onAuthError={handleLogout} route={route} pendingInvitation={pendingRouteInvitation} onInvitationHandled={() => { savePendingRouteInvitation(null); setPendingRouteInvitation(null); }} onInvitationBound={(userId) => setPendingRouteInvitation((current) => { if (!current || current.userId) return current; const next = { ...current, userId }; savePendingRouteInvitation(next); return next; })} />
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

/** Resolves a shared published URL only after the member-only shell is mounted.
 * CoreCrow returns 404 for both missing and unauthorized resources, so the
 * client deliberately presents the same generic state in both cases. */
function PublishedRouteIntent({ route }: { route: NorthRoute }) {
  const { navigate } = useTabs();
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (route.kind !== 'panel') { setMissing(false); return; }
    let live = true;
    setMissing(false);
    void resolvePublishedPanel(route)
      .then((result) => {
        if (!live) return;
        if (result.canonicalPath) replacePath(result.canonicalPath);
        const localeOrder = result.revision ? [result.revision.locale.resolved, ...result.revision.locale.fallbackChain, result.revision.defaultLocale] : [];
        // A direct, user-requested deep link is an intentional tab navigation.
        navigate(result.category.id, result.subcategory.id, {
          id: result.panel.id,
          title: String(localeOrder.map((locale) => result.panel.name[locale]).find((value) => typeof value === 'string') ?? Object.values(result.panel.name).find((value) => typeof value === 'string') ?? result.panel.slug),
          document: result.revision?.document ?? null,
          localeOrder,
        });
      })
      .catch(() => { if (live) setMissing(true); });
    return () => { live = false; };
  }, [navigate, route]);

  if (!missing) return null;
  return <div className="fixed inset-0 z-[100] bg-background"><GenericNotFound /></div>;
}

function AuthenticatedRouter({ user, onAuthError, route, pendingInvitation, onInvitationHandled, onInvitationBound }: { user: SessionUser; onAuthError: () => void; route: NorthRoute; pendingInvitation: PendingRouteInvitation | null; onInvitationHandled: () => void; onInvitationBound: (userId: string) => void }) {
  const { organizations, activeOrganization, isLoading, switchOrganization, refresh } = useOrganization();
  const isOrganizationRoute = route.kind === 'organization' || route.kind === 'panel';
  const [publicOrganization, setPublicOrganization] = useState<PublicOrganization | null>(null);
  const [missing, setMissing] = useState(false);
  const [gateError, setGateError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const member = isOrganizationRoute ? organizations.find((organization) => organization.slug === route.organizationSlug) : null;

  useEffect(() => {
    if (!pendingInvitation) return;
    if (pendingInvitation.path !== route.path || pendingInvitation.userId && pendingInvitation.userId !== user.id || member) { onInvitationHandled(); return; }
    if (!pendingInvitation.userId) onInvitationBound(user.id);
  }, [member, onInvitationBound, onInvitationHandled, pendingInvitation, route.path, user.id]);

  useEffect(() => {
    if (!isOrganizationRoute) { setPublicOrganization(null); setMissing(false); return; }
    let live = true;
    setPublicOrganization(null); setMissing(false);
    void resolvePublicOrganization(route.organizationSlug)
      .then((result) => { if (live) setPublicOrganization(result); })
      .catch(() => { if (live) setMissing(true); });
    return () => { live = false; };
  }, [isOrganizationRoute, route]);

  useEffect(() => {
    if (member && activeOrganization?.id !== member.id) switchOrganization(member.id);
  }, [activeOrganization?.id, member, switchOrganization]);

  if (!isOrganizationRoute) return <AppShell user={user} onAuthError={onAuthError} route={route} />;
  if (missing) return <GenericNotFound />;
  if (isLoading || !publicOrganization) return <ShellSkeleton />;
  if (!member) {
    return <OrganizationAccessGate
      organization={publicOrganization}
      authenticated
      onSignIn={() => {}}
      onCreateAccount={() => {}}
      accepting={accepting}
      error={gateError}
      initialToken={pendingInvitation?.userId === user.id && pendingInvitation.path === route.path ? pendingInvitation.token : ''}
      onAcceptInvitation={async (token) => {
        setAccepting(true); setGateError('');
        try { await acceptInvitation(token); onInvitationHandled(); await refresh(); }
        catch (reason) {
          const status = (reason as { status?: number }).status;
          if ([400, 403, 404, 410].includes(status ?? 0)) onInvitationHandled();
          setGateError(reason instanceof Error ? reason.message : 'Unable to accept the invitation.');
        }
        finally { setAccepting(false); }
      }}
    />;
  }
  if (activeOrganization?.id !== member.id) return <ShellSkeleton />;
  return <AppShell user={user} onAuthError={onAuthError} route={route} />;
}

function useNorthRoute() {
  const [route, setRoute] = useState<NorthRoute>(() => currentNorthRoute());
  useEffect(() => {
    const sync = () => setRoute(currentNorthRoute());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  return route;
}

function OrganizationRouteGate({
  route,
  authenticated,
  onSignIn,
  onCreateAccount,
  onAccepted,
  onInvitation,
}: {
  route: Extract<NorthRoute, { kind: 'organization' | 'panel' }>;
  authenticated: boolean;
  onSignIn: () => void;
  onCreateAccount: () => void;
  onAccepted?: () => Promise<void>;
  onInvitation?: (token: string) => void;
}) {
  const [organization, setOrganization] = useState<PublicOrganization | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    let live = true;
    setOrganization(null); setMissing(false); setError('');
    void resolvePublicOrganization(route.organizationSlug)
      .then((result) => { if (live) setOrganization(result); })
      .catch(() => { if (live) setMissing(true); });
    return () => { live = false; };
  }, [route.organizationSlug]);

  if (missing) return <GenericNotFound />;
  if (!organization) return <ShellSkeleton />;

  return <OrganizationAccessGate
    organization={organization}
    authenticated={authenticated}
    onSignIn={onSignIn}
    onCreateAccount={onCreateAccount}
    accepting={accepting}
    error={error}
    onAcceptInvitation={async (token) => {
      if (!authenticated || !onAccepted) { onInvitation?.(token); return; }
      setAccepting(true); setError('');
      try { await acceptInvitation(token); await onAccepted(); }
      catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to accept the invitation.'); }
      finally { setAccepting(false); }
    }}
  />;
}
