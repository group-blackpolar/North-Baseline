import type { TabRoute } from '@/context/TabsContext';
import type { SessionUser } from '@/lib/auth';
import { PersonalHome } from './pages/PersonalHome';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsShell } from './pages/settings/settingsShell';

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
    default:
      return <PersonalHome user={user} />;
  }
}
