import { CreditCard } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { DashboardCard } from '@/components/dashboard/primitives';
import type { TabRoute } from '@/context/TabsContext';
import type { SessionUser } from '@/lib/auth';
import { PersonalHome } from './pages/PersonalHome';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsShell } from './pages/settings/settingsShell';

function BillingInline({ sub }: { sub: string }) {
  return (
    <div className="p-6 space-y-4 max-w-2xl">
      <h1 className="text-xl font-display font-semibold text-text">Billing</h1>
      <DashboardCard title="Current plan">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-text">Free</p>
            <p className="text-xs text-text-secondary">1 workspace personal · funciones básicas</p>
          </div>
          <span className="rounded-full bg-accent-soft text-accent text-xs font-semibold px-2.5 py-1">Active</span>
        </div>
      </DashboardCard>
      <EmptyState
        icon={CreditCard}
        title={sub === 'invoices' ? 'Sin facturas' : 'Planes'}
        body="Tus facturas y opciones de plan aparecerán aquí cuando CoreCrow habilite billing."
      />
    </div>
  );
}

function PreferencesInline({ sub }: { sub: string }) {
  return (
    <div className="p-6 space-y-4 max-w-2xl">
      <h1 className="text-xl font-display font-semibold text-text">Preferences</h1>
      <DashboardCard title={sub === 'language' ? 'Language' : 'Appearance'}>
        <p className="text-sm text-text-secondary">
          {/* TODO: TASK-07/08/09 — Settings architecture, Appearance e i18n */}
          Esta sección se reconstruye en el ciclo 3 con la arquitectura de Settings.
        </p>
      </DashboardCard>
    </div>
  );
}

export function PersonalView({ route, user }: { route: TabRoute; user: SessionUser }) {
  const sub = route.subcategoryId ?? 'overview';

  switch (route.categoryId) {
    case 'home':
      return sub === 'overview' ? <PersonalHome user={user} /> : <PersonalHome user={user} />;
    case 'profile':
      return <ProfilePage sub={sub} user={user} />;
    case 'billing':
      return <BillingInline sub={sub} />;
    case 'settings':
    case 'preferences':
      return <SettingsShell sub={sub}  />;
    default:
      return <PreferencesInline sub={sub} />;
  }
}