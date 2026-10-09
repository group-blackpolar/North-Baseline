import { useState } from 'react';
import { EnvelopeSimple, Key, UsersFour, Users } from '@phosphor-icons/react';
import { AccessAdminView, type AccessSection } from '@/features/access-admin/AccessAdminView';
import { useI18n } from '@/lib/i18n';
import { takeAdminIntent } from './navigation';
import { SectionTabs } from './ui';

type Tab = 'members' | 'invitations' | 'groups' | 'permissions';
const SECTION: Record<Tab, AccessSection> = { members: 'users', invitations: 'invitations', groups: 'groups', permissions: 'permissions' };
const isTab = (value: string | null): value is Tab => value === 'members' || value === 'invitations' || value === 'groups' || value === 'permissions';

/**
 * Members & Access: members (roles, status), invitations (email + organization keys, history), groups and the
 * effective/direct permission grants. The tables, filters and actions are the existing CORECROW-backed screens; this
 * wrapper only unifies them under one capability. Every action is authorized server-side (members/invitations/groups/
 * permissions.manage); a missing capability renders the screen read-only.
 */
export function MembersScreen({ organizationId, currentUserId }: { organizationId: string; currentUserId: string }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>(() => { const intent = takeAdminIntent('members'); return isTab(intent) ? intent : 'members'; });
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pt-4 lg:px-5">
        <SectionTabs
          label={t('adm.nav.members')} value={tab} onChange={setTab}
          tabs={[
            { id: 'members', label: t('adm2.members.tab.members'), icon: Users },
            { id: 'invitations', label: t('adm2.members.tab.invitations'), icon: EnvelopeSimple },
            { id: 'groups', label: t('adm2.members.tab.groups'), icon: UsersFour },
            { id: 'permissions', label: t('adm2.members.tab.permissions'), icon: Key },
          ]}
        />
      </div>
      <AccessAdminView section={SECTION[tab]} organizationId={organizationId} currentUserId={currentUserId} />
    </div>
  );
}
