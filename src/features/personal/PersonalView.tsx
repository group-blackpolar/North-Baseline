import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n';
import type { TabRoute } from '@/context/TabsContext';
import type { SessionUser } from '@/lib/auth';
import { PersonalHome } from './pages/PersonalHome';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsShell } from './pages/settings/settingsShell';
const PlatformSectionContent = lazy(() => import('@/features/platform-admin/PlatformAdminView').then((module) => ({ default: module.PlatformSectionContent })));

/** Accounts created by an organization have no Personal Workspace; CORECROW also refuses its personal-scope calls. */
function PersonalRestricted() {
  const { t } = useI18n();
  return (
    <div className="w-full space-y-4 p-4 lg:p-5" role="status">
      <div className="np-card space-y-1 p-4">
        <p className="text-sm font-display font-semibold text-text">{t('personal.restricted.title')}</p>
        <p className="text-sm text-text-secondary">{t('personal.restricted.body')}</p>
      </div>
      <div aria-hidden="true" className="space-y-3 opacity-60">
        <Skeleton className="h-8 w-56" /><Skeleton className="h-40 w-full rounded-xl" /><Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function PersonalView({ route, user }: { route: TabRoute; user: SessionUser }) {
  if (user.createdByOrganizationId) return <PersonalRestricted />;
  const sub = route.subcategoryId ?? 'overview';

  switch (route.categoryId) {
    case 'home':
      return sub === 'overview' ? <PersonalHome user={user} /> : <PersonalHome user={user} />;
    case 'profile':
      return <ProfilePage sub={sub} user={user} />;
    case 'settings':
    case 'preferences':
      return <SettingsShell sub={sub}  />;
    case 'platform-administration':
      // Operator-only screens: loaded on demand so they never weigh on the main bundle.
      return <Suspense fallback={<div className="w-full space-y-3 p-4 lg:p-5" aria-busy="true"><Skeleton className="h-8 w-56" /><Skeleton className="h-64 w-full rounded-xl" /></div>}><PlatformSectionContent user={user} section={route.subcategoryId ?? 'dashboard'} /></Suspense>;
    default:
      return <PersonalHome user={user} />;
  }
}
