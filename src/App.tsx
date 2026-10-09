import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Buildings } from '@phosphor-icons/react';
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
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { useIsCompactShell } from '@/lib/responsive';
import { Skeleton, WorkspaceSkeleton } from '@/components/ui/skeleton';
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
  checkSession,
  getIdentityConfig,
  logout as authLogout,
  type IdentityConfig,
  type SessionUser,
  SESSION_USER_UPDATED_EVENT,
} from '@/lib/auth';
import { isTauri } from '@/lib/tauri';
import { acceptInvitation, resolvePublicOrganization, resolvePublishedPanel, type PublicOrganization } from '@/lib/organizations';
import { currentNorthRoute, replacePath, type NorthRoute } from '@/lib/routes';
import { GenericNotFound, OrganizationAccessGate } from '@/components/organization/OrganizationAccessGate';
import { InspectionBanner } from '@/components/organization/InspectionBanner';
import { ConnectionProblem } from '@/components/errors/ConnectionProblem';
import { useInspection } from '@/lib/inspection';
import { PlatformAdminView } from '@/features/platform-admin/PlatformAdminView';
import { ShowcaseView } from '@/features/showcase/ShowcaseView';
import { navigateToPublishedTarget, publishedTabFromResolved } from '@/lib/publishedNavigation';
import { navKey } from '@/lib/navState';
import { apiCache } from '@/lib/apiCache';

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
    <div className="north-app-shell flex bg-background">
      <div className="hidden md:block w-14 border-r border-border bg-surface p-2 space-y-2">
        <Skeleton className="h-9 w-9 rounded-xl" />
        <Skeleton className="h-9 w-9 rounded-xl" />
      </div>
      <div className="hidden md:block w-64 border-r border-border bg-surface p-3 space-y-3">
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

/** Transition frame when the URL names another organization than the active one: the real organization rail
 *  stays put and the workspace area shows its skeleton, instead of a generic grey shell (no blank/flash). */
function SwitchingShell() {
  const compact = useIsCompactShell();
  return (
    <>
      <div className="north-app-shell flex bg-background text-text" aria-busy="true">
        {!compact && <OrganizationRail />}
        {!compact && (
          <div className="flex h-full shrink-0 border-r border-border bg-surface" style={{ width: 'calc(var(--shell-category-rail) + var(--shell-context-sidebar))' }}>
            <div className="w-(--shell-category-rail) space-y-2 p-2"><Skeleton className="size-9 rounded-lg" /><Skeleton className="size-9 rounded-lg" /></div>
            <div className="flex-1 space-y-3 border-l border-border p-3"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-2/3" /></div>
          </div>
        )}
        <div className="min-w-0 flex-1"><WorkspaceSkeleton /></div>
      </div>
    </>
  );
}

function NoOrganizationState() {
  const { t } = useI18n();
  return (
    <div className="north-app-shell flex items-center justify-center bg-background p-6">
      <EmptyState
        icon={Buildings}
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
  const { activeOrganization } = useOrganization();

  useEffect(() => {
    // The authoritative organization navigation is not workspace-scoped.
    if (isLoading || categories.length === 0) return;

    let live = true;
    const openCategory = (category: (typeof categories)[number]) => {
      const subcategory = category.subcategories[0];
      void navigateToPublishedTarget({
        organizationSlug: activeOrganization?.slug,
        category,
        subcategory,
        navigate,
        history: 'replace',
      }).catch(() => {
        if (live) navigate(category.id, subcategory?.id ?? null);
      });
    };

    // Si no hay tab activa, navegar al primer panel publicado si existe.
    if (!activeTab) {
      const firstCategory = categories[0];
      if (firstCategory) openCategory(firstCategory);
      return () => { live = false; };
    }

    // Verificar si la tab actual apunta a una categoría que existe en el catálogo
    const currentCategory = categories.find((category) => category.id === activeTab.route.categoryId);
    if (!currentCategory) {
      // La tab apunta a una categoría inexistente → re-rutear a la primera categoría
      const firstCategory = categories[0];
      if (firstCategory) openCategory(firstCategory);
    } else if (activeTab.route.subcategoryId && !currentCategory.subcategories.some((sub) => sub.id === activeTab.route.subcategoryId)) {
      // A restored tab whose subcategory no longer exists (archived, or access changed) → the category's first entry.
      openCategory(currentCategory);
    }
    return () => { live = false; };
  }, [activeOrganization?.slug, categories, isLoading, activeTab, navigate]);

  return <>{children}</>;
}

/** Resolves the published panels of tabs restored after a reload/discarded page. Documents are never persisted: only
 *  the panel id is, and CORECROW is asked again (so a revoked or archived panel simply does not come back). */
function RestoredPanels() {
  const { tabs, hydratePanel } = useTabs();
  const { categories, isLoading } = useCatalog();
  const { activeOrganization } = useOrganization();
  const requested = useRef(new Set<string>());

  useEffect(() => {
    if (isLoading || !activeOrganization?.slug) return;
    for (const tab of tabs) {
      if (!tab.restorePanelId || tab.publishedPanel || requested.current.has(tab.id)) continue;
      const category = categories.find((item) => item.id === tab.route.categoryId);
      const subcategory = category?.subcategories.find((item) => item.id === tab.route.subcategoryId);
      const panel = subcategory?.publishedPanels?.find((item) => item.id === tab.restorePanelId);
      if (!category?.slug || !subcategory?.slug || !panel) continue;
      requested.current.add(tab.id);
      void resolvePublishedPanel({ organizationSlug: activeOrganization.slug, categorySlug: category.slug, subcategorySlug: subcategory.slug, panelSlug: panel.slug })
        .then((result) => hydratePanel(tab.id, publishedTabFromResolved(result)))
        .catch(() => { requested.current.delete(tab.id); });
    }
  }, [activeOrganization?.slug, categories, hydratePanel, isLoading, tabs]);

  return null;
}

// ---------------------------------------------------------------------------
// WorkspaceGate — ensambla providers internos
// ---------------------------------------------------------------------------

function WorkspaceGate({
  organizationId,
  user,
  route,
}: {
  organizationId: string;
  user: SessionUser;
  route: NorthRoute;
}) {
  const { activeWorkspace } = useWorkspace();
  const activeWorkspaceId = activeWorkspace?.id ?? null;
  const compact = useIsCompactShell();

  return (
    <CatalogProvider workspaceId={activeWorkspaceId} organizationId={organizationId} platformRole={user.role}>
      <PermissionProvider
        organizationId={organizationId}
      >
        <TabsProvider persistKey={navKey(user.id, organizationId)}>
          <LayoutProvider>
            <CatalogSync>
              <RestoredPanels />
              <PublishedRouteIntent route={route} />
              {/* The organization rail and the shell frame live outside this keyed subtree (see AppShell), so
                  switching organization keeps them on screen while the tenant-scoped state below remounts. */}
              <div className="flex min-w-0 flex-1">
                {/* Conditional siblings keep the content column at a stable position, so a resize never remounts the workspace. */}
                {!compact && (
                  <CategoryRail>
                    <ContextSidebar user={user} />
                  </CategoryRail>
                )}
                <div className="flex-1 flex flex-col min-w-0">
                  {compact ? <MobileHeader user={user} /> : <CurrentPath />}
                  {!compact && <TabBar />}
                  <div className="flex-1 flex flex-col min-h-0">
                    <SplitContent user={user} />
                  </div>
                </div>
                {!compact && <LayoutSwitcher />}
              </div>
            </CatalogSync>
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
  const compact = useIsCompactShell();
  const inspection = useInspection();

  if (isLoading) return <ShellSkeleton />;
  if (!activeOrganization) return <NoOrganizationState />;
  const inspecting = inspection && inspection.id === activeOrganization.id ? inspection : null;

  return (
    <>
      <div className="north-app-shell flex flex-col bg-background text-text">
        {inspecting && <InspectionBanner organization={inspecting} />}
        <div className="flex min-h-0 flex-1">
        {!compact && <OrganizationRail />}
        {/* FIX CLAVE: key={activeOrganization.id} fuerza re-mount completo del subtree
           cuando cambia la org. Esto reinicia workspaces, tabs y catálogo desde cero,
           exactamente igual que un full reload. Sin el key, React solo re-renderiza
           y el estado viejo persiste (que era el bug original). */}
        <WorkspaceProvider
          key={activeOrganization.id}
          organizationId={activeOrganization.id}
          onAuthError={onAuthError}
        >
          <WorkspaceGate
            organizationId={activeOrganization.id}
            user={user}
            route={route}
          />
        </WorkspaceProvider>
        </div>
      </div>
    </>
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
  const [bootUnreachable, setBootUnreachable] = useState(false);
  const [onboardingIssue, setOnboardingIssue] = useState('');
  const [identityConfig, setIdentityConfig] = useState<IdentityConfig>({
    termsVersion: FALLBACK_TERMS_VERSION,
    passwordMinLength: 12,
    passwordMaxLength: 128,
    googleAuthEnabled: false,
    captchaRequired: false,
  });

  const bootSession = useCallback(async () => {
    setBootUnreachable(false);
    setCheckingSession(true);
    try {
      // Kill-switch: sesión invalidada localmente → ignorar cookie zombi
      if (isSessionKilled()) return;
      // "Unreachable" is not "signed out": retry briefly, then offer a retry screen instead of the login form.
      let check = await checkSession();
      for (let attempt = 1; check.status === 'unreachable' && attempt <= 2; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
        check = await checkSession();
      }
      if (check.status === 'unreachable') { setBootUnreachable(true); return; }
      if (check.status !== 'authenticated') return;
      const sessionUser = check.user;
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
    } finally {
      setCheckingSession(false);
    }
  }, []);

  useEffect(() => {
    getIdentityConfig().then(setIdentityConfig).catch(() => {});
    if (isTauri()) {
      setCheckingSession(false);
      return;
    }
    void bootSession();
  }, [bootSession]);

  useEffect(() => {
    // Profile reads re-publish an identical user. Keep the previous reference so
    // nothing downstream (providers, effects keyed on `user`) re-runs for no change.
    const updateUser = (event: Event) => {
      const next = (event as CustomEvent<SessionUser>).detail;
      setUser((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    window.addEventListener(SESSION_USER_UPDATED_EVENT, updateUser);
    return () => window.removeEventListener(SESSION_USER_UPDATED_EVENT, updateUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    setPendingRouteInvitation((current) => {
      if (!current || !current.userId || current.userId === user.id) return current;
      savePendingRouteInvitation(null);
      return null;
    });
  }, [user]);

  // Cached API reads are bound to the signed-in person: a different (or no) user starts from an empty cache.
  useEffect(() => { apiCache.setScope(user?.id ?? ''); }, [user?.id]);

  const handleLogout = useCallback(() => {
    void authLogout().catch(() => {}).finally(() => {
      clearLocalSession();
      markSessionKilled();
    });
    savePendingRouteInvitation(null); setPendingRouteInvitation(null); setUser(null);
  }, []);

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

  // Public showcase: anonymous, read-only, independent of session state.
  if (route.kind === 'showcase') return <ShowcaseView route={route} />;

  if (checkingSession) {
    return (
      <div className="fixed inset-0" role="status" aria-busy="true">
        <span className="sr-only">{t('app.checkingSession')}</span>
        <ShellSkeleton />
      </div>
    );
  }

  if (!user && bootUnreachable) return <ConnectionProblem onRetry={bootSession} className="fixed inset-0" />;

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
        {/* Notifications and toasts are user-scoped (localStorage), so they sit above every organization switch. */}
        <NotificationProvider>
        <OrganizationProvider user={user} onAuthError={handleLogout}>
          <AuthenticatedRouter user={user} onAuthError={handleLogout} route={route} pendingInvitation={pendingRouteInvitation} onInvitationHandled={() => { savePendingRouteInvitation(null); setPendingRouteInvitation(null); }} onInvitationBound={(userId) => setPendingRouteInvitation((current) => { if (!current || current.userId) return current; const next = { ...current, userId }; savePendingRouteInvitation(next); return next; })} />
        </OrganizationProvider>
        </NotificationProvider>
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
          className="w-full h-10 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium text-sm transition-colors duration-(--duration-fast) disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? '…' : (t('terms.accept') || 'Aceptar y continuar')}
        </button>
      </div>
    </div>
  );
}

/** `route` keeps its identity while the path is unchanged (see useNorthRoute), so
 * the effect below does not re-resolve the same panel on unrelated popstates.
 * Resolves a shared published URL only after the member-only shell is mounted.
 * CoreCrow returns 404 for both missing and unauthorized resources, so the
 * client deliberately presents the same generic state in both cases. */
function PublishedRouteIntent({ route }: { route: NorthRoute }) {
  const { activeTab, navigate } = useTabs();
  const { categories, isLoading } = useCatalog();
  const [missing, setMissing] = useState(false);
  const resolvedPathRef = useRef<string | null>(null);

  const knownCategory = route.kind === 'panel' ? categories.find((category) => category.slug === route.categorySlug) : undefined;
  const knownSubcategory = route.kind === 'panel' ? knownCategory?.subcategories.find((subcategory) => subcategory.slug === route.subcategorySlug) : undefined;
  const knownPanelId = route.kind === 'panel' ? knownSubcategory?.publishedPanels?.find((panel) => panel.slug === route.panelSlug)?.id : undefined;
  // The organization Views editor (admin/settings) is rendered from the catalog
  // route, never from a published panel document. Resolving its system panel can
  // 404 and would cover a valid OWNER session with the not-found overlay.
  // The access screens (settings, users, invitations, groups, permissions, audit) are catalog routes too and do not
  // change the URL, so any admin tab in this category counts as already resolved.
  const isViewsAdminTarget = knownCategory?.slug === 'admin' && activeTab?.route.categoryId === knownCategory.id
    && ((knownSubcategory?.slug === 'settings' && activeTab.route.subcategoryId === knownSubcategory.id)
      || Boolean(activeTab.route.subcategoryId?.startsWith('access-')));
  const alreadyResolved = Boolean(
    isViewsAdminTarget
    || (knownPanelId && activeTab?.publishedPanel?.id === knownPanelId),
  );

  useEffect(() => {
    if (route.kind !== 'panel') { setMissing(false); return; }
    // Catalog navigation resolves and opens the published panel before it
    // updates the canonical URL. Do not immediately resolve the same route a
    // second time: a late duplicate failure would otherwise cover valid,
    // already-authorized content with the generic not-found overlay.
    if (alreadyResolved) { setMissing(false); return; }
    if (isLoading) return;
    // A URL is resolved once. Catalog refreshes (e.g. after saving organization settings) re-run this effect while the
    // user is on a screen whose route is not in the URL; resolving again would hijack that tab or flash not-found.
    if (resolvedPathRef.current === route.path) return;
    let live = true;
    setMissing(false);
    void resolvePublishedPanel(route)
      .then((result) => {
        if (!live) return;
        resolvedPathRef.current = route.path;
        if (result.canonicalPath) replacePath(result.canonicalPath);
        // A direct, user-requested deep link is an intentional tab navigation.
        navigate(result.category.id, result.subcategory.id, publishedTabFromResolved(result));
      })
      .catch(() => { if (live) { resolvedPathRef.current = route.path; setMissing(true); } });
    return () => { live = false; };
  }, [alreadyResolved, isLoading, navigate, route]);

  if (!missing) return null;
  return <div className="fixed inset-0 z-(--z-modal) bg-background"><GenericNotFound /></div>;
}

function AuthenticatedRouter({ user, onAuthError, route, pendingInvitation, onInvitationHandled, onInvitationBound }: { user: SessionUser; onAuthError: () => void; route: NorthRoute; pendingInvitation: PendingRouteInvitation | null; onInvitationHandled: () => void; onInvitationBound: (userId: string) => void }) {
  const { organizations, activeOrganization, isLoading, status, switchOrganization, refresh } = useOrganization();
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

  // The public organization record only feeds the non-member access gate. Members
  // already have everything from OrganizationContext, so never block (or
  // unmount) the shell on this request, and re-run it per slug, not per route.
  const organizationSlug = isOrganizationRoute ? route.organizationSlug : null;
  const isMember = Boolean(member);
  useEffect(() => {
    if (!organizationSlug || isMember) { setPublicOrganization(null); setMissing(false); return; }
    let live = true;
    setPublicOrganization(null); setMissing(false);
    void resolvePublicOrganization(organizationSlug)
      .then((result) => { if (live) setPublicOrganization(result); })
      .catch(() => { if (live) setMissing(true); });
    return () => { live = false; };
  }, [organizationSlug, isMember]);

  useEffect(() => {
    if (member && activeOrganization?.id !== member.id) switchOrganization(member.id);
  }, [activeOrganization?.id, member, switchOrganization]);

  // Platform Administration is global: it must render before the organization
  // shell so it never depends on activeOrganization or its remount boundary (§9).
  if (route.kind === 'platform-admin') {
    return <div className="north-app-shell north-app-shell-host"><PlatformAdminView user={user} route={route} /></div>;
  }
  if (!isOrganizationRoute) return <AppShell user={user} onAuthError={onAuthError} route={route} />;
  if (isLoading) return <ShellSkeleton />;
  // The organization list could not be loaded: that is an API problem, never "you are not a member".
  if (!member && status === 'error') return <ConnectionProblem onRetry={refresh} />;
  if (!member) {
    if (missing) return <GenericNotFound />;
    if (!publicOrganization) return <ShellSkeleton />;
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
  if (activeOrganization?.id !== member.id) return <SwitchingShell />;
  return <AppShell user={user} onAuthError={onAuthError} route={route} />;
}

function useNorthRoute() {
  const [route, setRoute] = useState<NorthRoute>(() => currentNorthRoute());
  useEffect(() => {
    const sync = () => setRoute((prev) => {
      const next = currentNorthRoute();
      return prev.path === next.path ? prev : next;
    });
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
