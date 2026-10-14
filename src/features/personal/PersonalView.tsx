import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { TabRoute } from '@/context/TabsContext';
import type { SessionUser } from '@/lib/auth';
import { PersonalHome } from './pages/PersonalHome';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsShell } from './pages/settings/settingsShell';
const PlatformSectionContent = lazy(() => import('@/features/platform-admin/PlatformAdminView').then((module) => ({ default: module.PlatformSectionContent })));

export function PersonalView({ route, user }: { route: TabRoute; user: SessionUser }) {
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
