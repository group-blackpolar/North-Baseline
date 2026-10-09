import { useMemo } from 'react';
import { ArrowsClockwise, Database, EnvelopeSimple, Files, Receipt, ShieldWarning, Stack, UserPlus, Users, Warning } from '@phosphor-icons/react';
import { DashboardCard } from '@/components/dashboard/primitives';
import { OrganizationAvatar } from '@/components/organization/OrganizationAvatar';
import { Button } from '@/components/ui/button';
import { Icon, type IconComponent } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Status } from '@/components/ui/status';
import { usePermissions } from '@/context/PermissionContext';
import { useI18n } from '@/lib/i18n';
import { listAuthorizedTaxonomy } from '@/lib/northAdmin';
import { cn } from '@/lib/utils';
import { listInvitations, listMembers } from '@/features/access-admin/api';
import { detectHealth, flattenTree, summarize, type TreeCategory } from '@/features/views/workspace/resources';
import { formatMinor, getBilling, getOrganizationDetail, listAuditEntries, listDatasets } from './api';
import { useResource, type Resource } from './hooks';
import { useAdminNavigation } from './navigation';
import { Shell, Unavailable, invalidateOrganization, toneForStatus } from './ui';

function Kpi({ label, value, icon, state, hint }: { label: string; value: string | number | null; icon: IconComponent; state: Resource<unknown>['status']; hint?: string }) {
  const { t } = useI18n();
  return (
    <div className="np-card flex items-start justify-between gap-2 p-3.5" title={state === 'forbidden' ? t('adm2.kpi.forbidden') : state === 'error' ? t('adm2.kpi.error') : undefined}>
      <div className="min-w-0">
        <p className="ui-label pb-1">{label}</p>
        {state === 'loading' ? <Skeleton className="h-7 w-14" /> : <p className="font-display text-2xl font-semibold tabular-nums text-text">{value ?? '—'}</p>}
        {hint ? <p className="mt-0.5 truncate text-[11px] text-text-muted">{hint}</p> : null}
      </div>
      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-active text-text-secondary"><Icon icon={icon} size="sm" /></div>
    </div>
  );
}

export function OverviewScreen({ organizationId }: { organizationId: string }) {
  const { t, locale } = useI18n();
  const { can } = usePermissions();
  const go = useAdminNavigation();
  const organization = useResource(() => getOrganizationDetail(organizationId), [organizationId]);
  const members = useResource(() => listMembers(organizationId), [organizationId]);
  const invitations = useResource(() => listInvitations(organizationId), [organizationId]);
  const tree = useResource(() => listAuthorizedTaxonomy(organizationId), [organizationId]);
  const datasets = useResource(() => listDatasets(organizationId), [organizationId]);
  const billing = useResource(() => getBilling(organizationId), [organizationId]);
  const audit = useResource(() => listAuditEntries(organizationId, { limit: 8 }), [organizationId]);
  const all = [organization, members, invitations, tree, datasets, billing, audit];

  const resources = useMemo(() => (tree.data ? flattenTree(tree.data as unknown as TreeCategory[]) : []), [tree.data]);
  const views = useMemo(() => summarize(resources), [resources]);
  const health = useMemo(() => detectHealth(resources), [resources]);
  const unpublished = health.filter((issue) => issue.code === 'UNPUBLISHED_CHANGES').length;

  const roleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const member of members.data ?? []) counts.set(member.role, (counts.get(member.role) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [members.data]);
  const activeMembers = (members.data ?? []).filter((member) => member.status !== 'SUSPENDED').length;
  const suspended = (members.data?.length ?? 0) - activeMembers;
  const pending = (invitations.data ?? []).filter((invitation) => invitation.status === 'PENDING').length;

  const alerts: Array<{ id: string; tone: 'error' | 'pending' | 'info'; text: string; action?: () => void; actionLabel?: string }> = [];
  if (organization.data && organization.data.status !== 'ACTIVE') alerts.push({ id: 'org', tone: 'error', text: t('adm2.alert.orgStatus', { status: organization.data.status }), action: () => go('settings'), actionLabel: t('adm.nav.settings') });
  if (billing.data && billing.data.status !== 'ACTIVE') alerts.push({ id: 'billing', tone: 'error', text: t('adm2.alert.billing', { status: billing.data.status }), action: () => go('billing'), actionLabel: t('adm.nav.billing') });
  if (unpublished > 0) alerts.push({ id: 'unpub', tone: 'pending', text: t('adm2.alert.unpublished', { count: unpublished }), action: () => go('views'), actionLabel: t('adm.nav.views') });
  if (suspended > 0) alerts.push({ id: 'susp', tone: 'info', text: t('adm2.alert.suspended', { count: suspended }), action: () => go('members'), actionLabel: t('adm.nav.members') });
  const unavailable = all.filter((resource) => resource.status === 'error').length;
  if (unavailable > 0) alerts.push({ id: 'partial', tone: 'info', text: t('adm2.alert.partial', { count: unavailable }) });

  const refresh = () => { invalidateOrganization(organizationId); all.forEach((resource) => void resource.reload()); };
  const date = (value: string) => new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
  const total = members.data?.length ?? 0;

  const actions: Array<{ id: string; label: string; icon: IconComponent; show: boolean; run: () => void }> = [
    { id: 'invite', label: t('adm2.qa.invite'), icon: EnvelopeSimple, show: can('invitations.manage'), run: () => go('members', 'invitations') },
    { id: 'member', label: t('adm2.qa.addMember'), icon: UserPlus, show: can('members.manage'), run: () => go('members', 'members') },
    { id: 'view', label: t('adm2.qa.openViews'), icon: Stack, show: true, run: () => go('views') },
    { id: 'query', label: t('adm2.qa.openQueries'), icon: Database, show: true, run: () => go('queries') },
    { id: 'audit', label: t('adm2.qa.audit'), icon: Files, show: can('audit.read'), run: () => go('audit') },
    { id: 'billing', label: t('adm2.qa.billing'), icon: Receipt, show: can('billing.read'), run: () => go('billing') },
  ];

  return (
    <Shell title={t('adm2.overview.title')} hint={t('adm2.overview.hint')}>
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={refresh}><ArrowsClockwise className="size-3.5" />{t('access.refresh')}</Button>
      </div>

      <section aria-label={t('adm2.overview.summary')} className="grid gap-3 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="np-card flex items-start gap-3 p-4">
          {organization.data ? <OrganizationAvatar name={organization.data.name} iconData={organization.data.iconData} organizationId={organizationId} iconAssetId={organization.data.iconAssetId} className="size-12 text-lg" /> : <Skeleton className="size-12 rounded-xl" />}
          <div className="min-w-0 flex-1 space-y-1">
            {organization.status === 'loading' ? <Skeleton className="h-5 w-40" /> : <p className="truncate font-display text-base font-semibold text-text">{organization.data?.name ?? '—'}</p>}
            <p className="mono-data truncate text-xs text-text-secondary">/{organization.data?.slug ?? '—'}</p>
            {organization.data ? <div className="flex flex-wrap items-center gap-2 pt-1"><Status tone={toneForStatus(organization.data.status)}>{organization.data.status}</Status><span className="text-[11px] text-text-muted">{t('adm2.overview.since', { date: new Date(organization.data.createdAt).toLocaleDateString(locale) })}</span></div> : null}
            {organization.data?.description ? <p className="line-clamp-2 pt-1 text-xs text-text-secondary">{organization.data.description}</p> : null}
            {organization.status === 'error' || organization.status === 'forbidden' ? <p role="alert" className="text-xs text-error">{organization.error}</p> : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
          <Kpi label={t('adm2.kpi.members')} value={members.data ? total : null} icon={Users} state={members.status} />
          <Kpi label={t('adm2.kpi.activeMembers')} value={members.data ? activeMembers : null} icon={Users} state={members.status} />
          <Kpi label={t('adm2.kpi.pendingInvites')} value={invitations.data ? pending : null} icon={EnvelopeSimple} state={invitations.status} />
          <Kpi label={t('adm2.kpi.published')} value={tree.data ? views.published : null} icon={Stack} state={tree.status} />
          <Kpi label={t('adm2.kpi.drafts')} value={tree.data ? views.drafts : null} icon={Stack} state={tree.status} />
          <Kpi label={t('adm2.kpi.datasets')} value={datasets.data ? datasets.data.filter((dataset) => dataset.status === 'ACTIVE').length : null} icon={Database} state={datasets.status} />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <DashboardCard title={t('adm2.alerts.title')} description={t('adm2.alerts.hint')}>
          {alerts.length === 0 ? (
            <p className="text-xs text-text-secondary">{all.some((resource) => resource.status === 'loading') ? t('admin.loading') : t('adm2.alerts.none')}</p>
          ) : (
            <ul className="space-y-2">
              {alerts.map((alert) => (
                <li key={alert.id} className="flex items-start gap-2 rounded-lg border border-border bg-surface-hover/40 p-2.5">
                  <Icon icon={alert.tone === 'error' ? ShieldWarning : Warning} size="sm" className={cn('mt-0.5', alert.tone === 'error' ? 'text-error' : alert.tone === 'pending' ? 'text-warning' : 'text-text-muted')} />
                  <p className="min-w-0 flex-1 text-xs text-text">{alert.text}</p>
                  {alert.action ? <Button size="sm" variant="ghost" onClick={alert.action}>{alert.actionLabel}</Button> : null}
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>

        <DashboardCard title={t('adm2.roles.title')} description={t('adm2.roles.hint')}>
          {members.status === 'loading' ? <Skeleton className="h-20 w-full" /> : members.status !== 'ready' || total === 0 ? (
            <p className="text-xs text-text-secondary">{members.status === 'forbidden' ? t('adm2.kpi.forbidden') : members.status === 'error' ? t('adm2.kpi.error') : t('access.users.empty')}</p>
          ) : (
            <div className="space-y-3">
              <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-active" role="img" aria-label={roleCounts.map(([role, count]) => `${role}: ${count}`).join(', ')}>
                {roleCounts.map(([role, count], index) => <span key={role} title={`${role}: ${count}`} style={{ width: `${(count / total) * 100}%`, opacity: 1 - index * 0.16 }} className="bg-accent" />)}
              </div>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                {roleCounts.map(([role, count]) => <li key={role} className="flex items-center justify-between text-xs"><span className="text-text-secondary">{role}</span><span className="tabular-nums text-text">{count}</span></li>)}
              </ul>
            </div>
          )}
        </DashboardCard>

        <DashboardCard title={t('adm2.usage.title')} description={t('adm2.usage.hint')}>
          <dl className="space-y-1.5 text-xs">
            <div className="flex justify-between"><dt className="text-text-secondary">{t('adm2.usage.billable')}</dt><dd className="tabular-nums text-text">{billing.data ? billing.data.billableMemberCount : '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-text-secondary">{t('adm2.usage.estimate')}</dt><dd className="tabular-nums text-text">{billing.data ? formatMinor(billing.data.estimatedMonthlyMinor, billing.data.currency, locale) : '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-text-secondary">{t('adm2.usage.views')}</dt><dd className="tabular-nums text-text">{tree.data ? views.views : '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-text-secondary">{t('adm2.usage.datasets')}</dt><dd className="tabular-nums text-text">{datasets.data ? datasets.data.length : '—'}</dd></div>
          </dl>
          <Unavailable title={t('adm2.usage.storage')} body={t('adm2.usage.storageBody')} needs={t('adm2.usage.storageNeeds')} />
        </DashboardCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <DashboardCard title={t('adm2.activity.title')} description={t('adm2.activity.hint')} actions={can('audit.read') ? <Button size="sm" variant="ghost" onClick={() => go('audit')}>{t('adm2.activity.all')}</Button> : undefined}>
          {audit.status === 'loading' ? <Skeleton className="h-24 w-full" /> : audit.status === 'forbidden' ? <p className="text-xs text-text-secondary">{t('adm2.audit.forbidden')}</p> : audit.status === 'error' ? <p role="alert" className="text-xs text-error">{audit.error}</p> : (audit.data ?? []).length === 0 ? <p className="text-xs text-text-secondary">{t('adm.audit.empty')}</p> : (
            <ol className="space-y-2">
              {(audit.data ?? []).map((entry) => (
                <li key={entry.id} className="flex items-start gap-2.5 text-xs">
                  <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                  <div className="min-w-0 flex-1"><p className="truncate font-medium text-text">{entry.action}</p><p className="truncate text-text-muted">{entry.targetType ? `${entry.targetType}${entry.targetId ? ` · ${entry.targetId}` : ''}` : '—'}</p></div>
                  <time className="shrink-0 text-text-muted" dateTime={entry.createdAt}>{date(entry.createdAt)}</time>
                </li>
              ))}
            </ol>
          )}
        </DashboardCard>

        <DashboardCard title={t('adm2.qa.title')} description={t('adm2.qa.hint')}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {actions.filter((action) => action.show).map((action) => (
              <Button key={action.id} variant="secondary" className="justify-start" onClick={action.run}><action.icon />{action.label}</Button>
            ))}
          </div>
        </DashboardCard>
      </div>
    </Shell>
  );
}
