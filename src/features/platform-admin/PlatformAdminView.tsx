import type { ReactNode } from 'react';
import { ArrowLeft, Building2, FileClock, KeyRound, LayoutDashboard, LayoutTemplate, Receipt, Send, ShieldAlert, Users2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import type { SessionUser } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { pushPath, type NorthRoute } from '@/lib/routes';
import { DashboardScreen } from './screens/DashboardScreen';
import { UsersScreen } from './screens/UsersScreen';
import { OrganizationsScreen } from './screens/OrganizationsScreen';
import { BillingScreen } from './screens/BillingScreen';
import { ContactsScreen } from './screens/ContactsScreen';
import { AuditScreen } from './screens/AuditScreen';
import { PermissionsScreen, TemplatesScreen } from './screens/AccessScreens';

export type PlatformSection =
  | 'dashboard'
  | 'users'
  | 'organizations'
  | 'billing'
  | 'contacts'
  | 'audit'
  | 'permissions'
  | 'templates';

type SectionDefinition = {
  id: PlatformSection;
  labelKey:
    | 'pa.nav.dashboard'
    | 'pa.nav.users'
    | 'pa.nav.organizations'
    | 'pa.nav.billing'
    | 'pa.nav.contacts'
    | 'pa.nav.audit'
    | 'pa.nav.permissions'
    | 'pa.nav.templates';
  icon: typeof LayoutDashboard;
  superadminOnly?: boolean;
};

/** §10 — visibility map. It only drives navigation: every request is still
 * authorized by CORECROW, and a forced URL renders a denied state. */
const SECTIONS: SectionDefinition[] = [
  { id: 'dashboard', labelKey: 'pa.nav.dashboard', icon: LayoutDashboard },
  { id: 'users', labelKey: 'pa.nav.users', icon: Users2 },
  { id: 'organizations', labelKey: 'pa.nav.organizations', icon: Building2 },
  { id: 'billing', labelKey: 'pa.nav.billing', icon: Receipt },
  { id: 'contacts', labelKey: 'pa.nav.contacts', icon: Send },
  { id: 'audit', labelKey: 'pa.nav.audit', icon: FileClock, superadminOnly: true },
  { id: 'permissions', labelKey: 'pa.nav.permissions', icon: KeyRound, superadminOnly: true },
  { id: 'templates', labelKey: 'pa.nav.templates', icon: LayoutTemplate, superadminOnly: true },
];

function sectionOf(path: string): PlatformSection | null {
  const parts = path.split('/').filter(Boolean);
  const candidate = parts[2];
  return SECTIONS.some((entry) => entry.id === candidate) ? (candidate as PlatformSection) : null;
}

function screenFor(section: PlatformSection): ReactNode {
  switch (section) {
    case 'users':
      return <UsersScreen />;
    case 'organizations':
      return <OrganizationsScreen />;
    case 'billing':
      return <BillingScreen />;
    case 'contacts':
      return <ContactsScreen />;
    case 'audit':
      return <AuditScreen />;
    case 'permissions':
      return <PermissionsScreen />;
    case 'templates':
      return <TemplatesScreen />;
    default:
      return <DashboardScreen />;
  }
}

/** Platform Administration shell (§9, §21).
 *
 * It renders outside the organization providers: no `activeOrganization`, no
 * organization catalog and no `key={activeOrganization.id}` remount. Platform
 * Administration is global, not tenant-scoped. */
export function PlatformAdminView({ user, route }: { user: SessionUser; route: NorthRoute }) {
  const { t } = useI18n();
  const isOperator = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
  const isSuperAdmin = user.role === 'SUPERADMIN';
  const visible = SECTIONS.filter((entry) => !entry.superadminOnly || isSuperAdmin);
  const section = sectionOf(route.path);
  const allowed = section !== null && visible.some((entry) => entry.id === section);

  if (!isOperator) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md">
          <EmptyState icon={ShieldAlert} title={t('pa.state.deniedTitle')} body={t('pa.state.deniedBody')} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex bg-background text-text">
      <nav className="w-60 shrink-0 border-r border-border bg-surface flex flex-col" aria-label={t('pa.title')}>
        <div className="border-b border-border px-4 py-4">
          <p className="ui-label">{t('pa.eyebrow')}</p>
          <p className="font-display text-sm font-semibold">{t('pa.title')}</p>
          <Badge className="mt-2">{user.role}</Badge>
        </div>
        <ul className="flex-1 overflow-y-auto p-2 space-y-1">
          {visible.map((entry) => {
            const active = entry.id === section;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => pushPath(`/workspace/admin/${entry.id}`)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors duration-150 ${
                    active ? 'bg-surface-active font-medium text-text' : 'text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  <entry.icon className={`h-4 w-4 ${active ? 'text-accent' : 'text-text-muted'}`} />
                  {t(entry.labelKey)}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={() => pushPath('/workspace')}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-hover"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('pa.backToWorkspace')}
          </button>
        </div>
      </nav>

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="mx-auto max-w-6xl space-y-5 p-6">
          <header>
            <h1 className="font-display text-xl font-semibold">{t('pa.title')}</h1>
            <p className="text-sm text-text-secondary">{t('pa.description')}</p>
          </header>
          {allowed && section ? (
            screenFor(section)
          ) : (
            <div className="max-w-md">
              <EmptyState
                icon={ShieldAlert}
                title={t('pa.state.deniedTitle')}
                body={t('pa.state.deniedBody')}
                action={
                  <button
                    type="button"
                    onClick={() => pushPath('/workspace/admin/dashboard')}
                    className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
                  >
                    {t('pa.nav.dashboard')}
                  </button>
                }
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
