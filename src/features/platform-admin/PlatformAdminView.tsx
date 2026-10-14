import type { ReactNode } from 'react';
import { Buildings, ClockCounterClockwise, Key, Layout, PaperPlaneTilt, Receipt, ShieldWarning, SquaresFour, Users } from '@phosphor-icons/react';
import { EmptyState } from '@/components/ui/empty-state';
import type { SessionUser } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { pushPath } from '@/lib/routes';
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
  icon: typeof SquaresFour;
  superadminOnly?: boolean;
};

/** §10 — visibility map. It only drives navigation: every request is still
 * authorized by CORECROW, and a forced URL renders a denied state. */
const SECTIONS: SectionDefinition[] = [
  { id: 'dashboard', labelKey: 'pa.nav.dashboard', icon: SquaresFour },
  { id: 'users', labelKey: 'pa.nav.users', icon: Users },
  { id: 'organizations', labelKey: 'pa.nav.organizations', icon: Buildings },
  { id: 'billing', labelKey: 'pa.nav.billing', icon: Receipt },
  { id: 'contacts', labelKey: 'pa.nav.contacts', icon: PaperPlaneTilt },
  { id: 'audit', labelKey: 'pa.nav.audit', icon: ClockCounterClockwise, superadminOnly: true },
  { id: 'permissions', labelKey: 'pa.nav.permissions', icon: Key, superadminOnly: true },
  { id: 'templates', labelKey: 'pa.nav.templates', icon: Layout, superadminOnly: true },
];

function screenFor(section: PlatformSection, canManage: boolean): ReactNode {
  switch (section) {
    case 'users':
      return <UsersScreen canManage={canManage} />;
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

/** Platform Administration inside the NORTH shell: the content of one subcategory of the Administration category.
 * Visibility only drives navigation; a forced URL for a section the role may not see renders a denied state, and every
 * request is authorized by CORECROW. */
export function PlatformSectionContent({ user, section }: { user: SessionUser; section: string | null }) {
  const { t } = useI18n();
  const isSuperAdmin = user.role === 'SUPERADMIN';
  const isOperator = user.role === 'ADMIN' || isSuperAdmin;
  const visible = SECTIONS.filter((entry) => !entry.superadminOnly || isSuperAdmin);
  const allowed = isOperator && visible.some((entry) => entry.id === section);
  if (!allowed) {
    return (
      <div className="max-w-md p-6">
        <EmptyState
          icon={ShieldWarning}
          title={t('pa.state.deniedTitle')}
          body={t('pa.state.deniedBody')}
          action={isOperator ? <button type="button" onClick={() => pushPath('/workspace/admin/dashboard')} className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover">{t('pa.nav.dashboard')}</button> : undefined}
        />
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <header>
        <h1 className="font-display text-xl font-semibold">{t(visible.find((entry) => entry.id === section)!.labelKey)}</h1>
        <p className="text-sm text-text-secondary">{t('pa.description')}</p>
      </header>
      {screenFor(section as PlatformSection, isSuperAdmin)}
    </div>
  );
}
