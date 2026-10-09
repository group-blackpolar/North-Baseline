import { useMemo, useState } from 'react';
import { Gear, House, Info, Lock, Trash, WarningOctagon } from '@phosphor-icons/react';
import { DashboardCard } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Status } from '@/components/ui/status';
import { SettingsScreen } from '@/features/access-admin/SettingsScreen';
import { useNotifications } from '@/context/NotificationContext';
import { useOrganization } from '@/context/OrganizationContext';
import { usePermissions } from '@/context/PermissionContext';
import { useI18n } from '@/lib/i18n';
import { listAuthorizedTaxonomy, setOrganizationHome } from '@/lib/northAdmin';
import { PERM } from '@/lib/permission';
import { pushPath } from '@/lib/routes';
import { flattenTree, localName, type TreeCategory } from '@/features/views/workspace/resources';
import { getOrganizationDetail, setOrganizationStatus } from './api';
import { useResource } from './hooks';
import { KeyValue, Loading, Notice, SectionTabs, Shell, Unavailable, errorText, invalidateOrganization, toneForStatus, selectClass } from './ui';

type Tab = 'general' | 'details' | 'preferences' | 'security' | 'retention' | 'danger';

export function OrgSettingsScreen({ organizationId }: { organizationId: string }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('general');
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pt-4 lg:px-5">
        <SectionTabs
          label={t('adm.nav.settings')} value={tab} onChange={setTab}
          tabs={[
            { id: 'general', label: t('adm2.settings.tab.general'), icon: Gear },
            { id: 'details', label: t('adm2.settings.tab.details'), icon: Info },
            { id: 'preferences', label: t('adm2.settings.tab.preferences'), icon: House },
            { id: 'security', label: t('adm2.settings.tab.security'), icon: Lock },
            { id: 'retention', label: t('adm2.settings.tab.retention'), icon: Trash },
            { id: 'danger', label: t('adm2.settings.tab.danger'), icon: WarningOctagon },
          ]}
        />
      </div>
      {tab === 'general' ? <SettingsScreen organizationId={organizationId} /> : null}
      {tab === 'details' ? <DetailsTab organizationId={organizationId} /> : null}
      {tab === 'preferences' ? <PreferencesTab organizationId={organizationId} /> : null}
      {tab === 'security' ? (
        <Shell title={t('adm2.settings.security.title')} hint={t('adm2.settings.security.hint')}>
          <Unavailable title={t('adm2.settings.security.policies')} body={t('adm2.settings.security.body')} needs={t('adm2.settings.security.needs')} />
        </Shell>
      ) : null}
      {tab === 'retention' ? (
        <Shell title={t('adm2.settings.retention.title')} hint={t('adm2.settings.retention.hint')}>
          <Unavailable title={t('adm2.settings.retention.policies')} body={t('adm2.settings.retention.body')} needs={t('adm2.settings.retention.needs')} />
        </Shell>
      ) : null}
      {tab === 'danger' ? <DangerTab organizationId={organizationId} /> : null}
    </div>
  );
}

function DetailsTab({ organizationId }: { organizationId: string }) {
  const { t, locale } = useI18n();
  const organization = useResource(() => getOrganizationDetail(organizationId), [organizationId]);
  const data = organization.data;
  const date = (value: string) => new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <Shell title={t('adm2.settings.details.title')} hint={t('adm2.settings.details.hint')}>
      <DashboardCard title={t('adm2.settings.tab.details')}>
        {organization.status === 'loading' ? <Loading /> : !data ? <Notice error={organization.error} /> : (
          <dl className="max-w-xl">
            <KeyValue label={t('adm.settings.name')}>{data.name}</KeyValue>
            <KeyValue label={t('adm.settings.slug')} mono>{data.slug}</KeyValue>
            <KeyValue label={t('adm.settings.status')}><Status tone={toneForStatus(data.status)}>{data.status}</Status></KeyValue>
            <KeyValue label="ID" mono>{data.id}</KeyValue>
            <KeyValue label={t('adm2.billing.since')}>{date(data.createdAt)}</KeyValue>
            <KeyValue label={t('adm2.settings.details.updated')}>{date(data.updatedAt)}</KeyValue>
            <KeyValue label={t('adm2.settings.details.home')} mono>{data.homePanelId ?? '—'}</KeyValue>
          </dl>
        )}
      </DashboardCard>
    </Shell>
  );
}

function PreferencesTab({ organizationId }: { organizationId: string }) {
  const { t, locale } = useI18n();
  const { push } = useNotifications();
  const { can } = usePermissions();
  const organization = useResource(() => getOrganizationDetail(organizationId), [organizationId]);
  const tree = useResource(() => listAuthorizedTaxonomy(organizationId), [organizationId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panels = useMemo(() => flattenTree((tree.data ?? []) as unknown as TreeCategory[]).filter((resource) => resource.kind === 'PANEL' && resource.status === 'PUBLISHED' && resource.resourceKind === 'CONTENT'), [tree.data]);
  const editable = can(PERM.organizationUpdate);

  const choose = async (panelId: string) => {
    setBusy(true); setError(null);
    try {
      await setOrganizationHome(organizationId, panelId || null);
      invalidateOrganization(organizationId);
      push({ type: 'success', title: t('adm.settings.saved') });
      await organization.reload();
    } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); }
  };

  return (
    <Shell title={t('adm2.settings.prefs.title')} hint={t('adm2.settings.prefs.hint')}>
      <DashboardCard title={t('adm2.settings.prefs.home')} description={editable ? t('adm2.settings.prefs.homeHint') : t('access.readOnly')}>
        {organization.status === 'loading' || tree.status === 'loading' ? <Loading /> : (
          <div className="space-y-2">
            <select aria-label={t('adm2.settings.prefs.home')} className={`${selectClass} w-full max-w-md`} disabled={!editable || busy || tree.status !== 'ready'} value={organization.data?.homePanelId ?? ''} onChange={(event) => void choose(event.target.value)}>
              <option value="">{t('adm2.settings.prefs.noHome')}</option>
              {panels.map((panel) => <option key={panel.id} value={panel.id}>{localName(panel.categoryName, locale)} / {localName(panel.name, locale)}</option>)}
            </select>
            {tree.status === 'forbidden' ? <p className="text-xs text-text-muted">{t('adm2.kpi.forbidden')}</p> : null}
            <Notice error={error} />
          </div>
        )}
      </DashboardCard>
      <p className="text-xs text-text-muted">{t('adm2.settings.prefs.personal')}</p>
    </Shell>
  );
}

function DangerTab({ organizationId }: { organizationId: string }) {
  const { t } = useI18n();
  const { refresh } = useOrganization();
  const { can } = usePermissions();
  const organization = useResource(() => getOrganizationDetail(organizationId, true), [organizationId]);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const data = organization.data;
  const archived = data?.status === 'ARCHIVED';
  const allowed = can(PERM.organizationUpdate);
  const matches = typed.trim() === data?.name;

  const run = async () => {
    if (!data) return;
    setBusy(true); setError(null);
    try {
      await setOrganizationStatus(organizationId, archived ? 'ACTIVE' : 'ARCHIVED');
      setConfirming(false); setTyped('');
      await refresh();
      if (!archived) pushPath('/workspace');
      else await organization.reload();
    } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); }
  };

  return (
    <Shell title={t('adm2.settings.danger.title')} hint={t('adm2.settings.danger.hint')}>
      <section className="rounded-xl border border-error/40 bg-error/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-xl space-y-1">
            <h2 className="text-sm font-semibold text-text">{archived ? t('adm2.settings.danger.restore') : t('adm2.settings.danger.archive')}</h2>
            <p className="text-xs leading-relaxed text-text-secondary">{archived ? t('adm2.settings.danger.restoreBody') : t('adm2.settings.danger.archiveBody')}</p>
            {!allowed ? <p className="text-xs text-text-muted">{t('access.readOnly')}</p> : null}
          </div>
          <Button variant={archived ? 'secondary' : 'destructive'} disabled={!allowed || !data} onClick={() => setConfirming(true)}>{archived ? t('adm2.settings.danger.restore') : t('adm2.settings.danger.archive')}</Button>
        </div>
        <Notice error={error} />
      </section>
      <ConfirmDialog
        open={confirming} destructive={!archived} busy={busy}
        title={archived ? t('adm2.settings.danger.restoreTitle') : t('adm2.settings.danger.archiveTitle')}
        description={archived ? t('adm2.settings.danger.restoreBody') : t('adm2.settings.danger.archiveConfirm', { name: data?.name ?? '' })}
        confirmLabel={archived ? t('adm2.settings.danger.restore') : t('adm2.settings.danger.archive')}
        disabled={!archived && !matches}
        onCancel={() => { setConfirming(false); setTyped(''); }}
        onConfirm={() => void run()}
      >
        {!archived ? <Input aria-label={t('adm2.settings.danger.typeName')} placeholder={data?.name} value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" /> : null}
      </ConfirmDialog>
    </Shell>
  );
}
