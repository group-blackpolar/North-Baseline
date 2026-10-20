import { useMemo, useState, type ReactNode } from 'react';
import { ArrowsClockwise, ClockCounterClockwise, DeviceMobile, Globe, Gauge, Key, Siren, SlidersHorizontal, Users } from '@phosphor-icons/react';
import { DashboardCard, MetricCard } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Status } from '@/components/ui/status';
import { usePermissions } from '@/context/PermissionContext';
import { useResource, type Resource } from '@/features/admin-center/hooks';
import { Loading, Notice, SectionTabs, Shell, Unavailable, selectClass, td, th, useBusy } from '@/features/admin-center/ui';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import * as api from './api';

type Tab = 'overview' | 'devices' | 'sessions' | 'ips' | 'users' | 'audit' | 'alerts' | 'policies';
/** UI hint only: CORECROW authorizes each call. The "users" view is served by security.sessions.view. */
const TAB_PERMISSION: Record<Tab, string> = {
  overview: 'security.overview.view', devices: 'security.devices.view', sessions: 'security.sessions.view', ips: 'security.ips.view',
  users: 'security.sessions.view', audit: 'security.audit.view', alerts: 'security.alerts.view', policies: 'security.policies.view',
};
const TAB_ICON = { overview: Gauge, devices: DeviceMobile, sessions: Key, ips: Globe, users: Users, audit: ClockCounterClockwise, alerts: Siren, policies: SlidersHorizontal } as const;
const TABS = Object.keys(TAB_PERMISSION) as Tab[];

/** A table that scrolls inside its own card; the page itself never scrolls. */
function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="max-h-[60vh] overflow-auto rounded-lg border border-border">
      <table className="w-full min-w-[720px] border-collapse">
        <thead className="sticky top-0 bg-surface"><tr>{head.map((label) => <th key={label} className={th}>{label}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Gate<T>({ resource, children }: { resource: Resource<T>; children: (data: T) => ReactNode }) {
  const { t } = useI18n();
  if (resource.status === 'loading') return <Loading />;
  if (resource.status === 'forbidden') return <Unavailable tone="forbidden" title={t('sec.forbidden')} body={t('sec.noAccessBody')} />;
  if (resource.status === 'error' && !resource.data) return <EmptyState icon={Siren} title={t('sec.loadError')} body={resource.error ?? undefined} action={<Button size="sm" onClick={() => void resource.reload()}>{t('sec.retry')}</Button>} />;
  return <>{resource.data ? children(resource.data) : null}</>;
}

const who = (name: string | null, email: string) => (name?.trim() ? `${name} · ${email}` : email);
const agent = (value: string | null) => (value ? value.slice(0, 60) : '—');

export function SecurityCenter({ organizationId }: { organizationId: string }) {
  const { t } = useI18n();
  const { can } = usePermissions();
  const allowed = useMemo(() => TABS.filter((tab) => can(TAB_PERMISSION[tab])), [can]);
  const [chosen, setChosen] = useState<Tab>('overview');
  const tab = allowed.includes(chosen) ? chosen : allowed[0];

  return (
    <Shell title={t('sec.title')} hint={t('sec.hint')}>
      {!tab ? <Unavailable tone="forbidden" title={t('sec.noAccess')} body={t('sec.noAccessBody')} /> : (
        <>
          <SectionTabs label={t('sec.tabs')} value={tab} onChange={setChosen} tabs={allowed.map((id) => ({ id, label: t(`sec.tab.${id}`), icon: TAB_ICON[id] }))} />
          {tab === 'overview' && <OverviewPanel organizationId={organizationId} />}
          {tab === 'devices' && <DevicesPanel organizationId={organizationId} canRevoke={can('security.devices.revoke')} />}
          {tab === 'sessions' && <SessionsPanel organizationId={organizationId} canRevoke={can('security.sessions.revoke')} />}
          {tab === 'ips' && <IpsPanel organizationId={organizationId} canManage={can('security.ips.manage')} />}
          {tab === 'users' && <UsersPanel organizationId={organizationId} canRevoke={can('security.sessions.revoke')} />}
          {tab === 'audit' && <AuditPanel organizationId={organizationId} />}
          {tab === 'alerts' && <AlertsPanel organizationId={organizationId} canManage={can('security.alerts.manage')} />}
          {tab === 'policies' && <PoliciesPanel organizationId={organizationId} canManage={can('security.policies.manage')} canNotify={can('security.notifications.manage')} />}
        </>
      )}
    </Shell>
  );
}

function Refresh({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return <Button size="sm" variant="ghost" onClick={onClick}><ArrowsClockwise className="size-3.5" />{t('sec.refresh')}</Button>;
}

function OverviewPanel({ organizationId }: { organizationId: string }) {
  const { t, locale } = useI18n();
  const resource = useResource(() => api.getOverview(organizationId), [organizationId]);
  return (
    <Gate resource={resource}>{(data) => {
      const run = data.lastRetentionRun;
      const when = run ? new Date(run.ranAt).toLocaleString(locale) : '';
      const retention = !run ? t('sec.ov.retentionNever', { days: data.policy.retentionDays })
        : run.skipped ? t('sec.ov.retentionSkipped', { days: data.policy.retentionDays, when })
          : t('sec.ov.retentionLine', { days: data.policy.retentionDays, when, alerts: run.purgedAlerts, devices: run.purgedDevices });
      return (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label={t('sec.ov.devices')} value={String(data.activeDevices)} icon={DeviceMobile} />
            <MetricCard label={t('sec.ov.sessions')} value={String(data.activeSessions)} icon={Key} />
            <MetricCard label={t('sec.ov.alerts')} value={String(data.openAlerts)} icon={Siren} />
            <MetricCard label={t('sec.ov.rules')} value={`${data.allowRules} / ${data.denyRules}`} icon={Globe} />
          </div>
          <DashboardCard title={t('sec.ov.policy')} actions={<Refresh onClick={() => void resource.reload()} />}>
            <p className="text-sm text-text">{!data.policy.configured ? t('sec.ov.off') : data.policy.enforcement ? t('sec.ov.enforcing') : t('sec.ov.tracking')}</p>
            <p className="text-xs text-text-secondary"><span className="ui-label mr-2">{t('sec.ov.retention')}</span>{retention}</p>
          </DashboardCard>
        </div>
      );
    }}</Gate>
  );
}

function DevicesPanel({ organizationId, canRevoke }: { organizationId: string; canRevoke: boolean }) {
  const { t, locale } = useI18n();
  const [revoked, setRevoked] = useState(false);
  const resource = useResource(() => api.listDevices(organizationId, revoked), [organizationId, revoked]);
  const [target, setTarget] = useState<api.Device | null>(null);
  const { busy, error, ok, act } = useBusy();
  const when = (value: string) => new Date(value).toLocaleString(locale);
  return (
    <DashboardCard title={t('sec.tab.devices')} actions={<div className="flex items-center gap-3"><label className="flex items-center gap-2 text-xs text-text-secondary"><input type="checkbox" className="size-3.5 accent-(--color-accent)" checked={revoked} onChange={(event) => setRevoked(event.target.checked)} />{t('sec.dev.showRevoked')}</label><Refresh onClick={() => void resource.reload()} /></div>}>
      <Notice error={error} ok={ok} />
      <Gate resource={resource}>{(rows) => rows.length === 0 ? <EmptyState icon={DeviceMobile} title={t('sec.empty')} /> : (
        <Table head={[t('sec.col.user'), t('sec.col.device'), t('sec.col.ip'), t('sec.col.first'), t('sec.col.last'), t('sec.col.sessions'), t('sec.col.status'), t('sec.col.actions')]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className={td}>{who(row.userName, row.userEmail)}</td><td className={cn(td, 'max-w-56 truncate')} title={row.userAgent ?? undefined}>{agent(row.userAgent)}</td>
              <td className={td}>{row.lastIp ?? '—'}</td><td className={td}>{when(row.firstSeenAt)}</td><td className={td}>{when(row.lastSeenAt)}</td><td className={td}>{row.activeSessions}</td>
              <td className={td}><Status tone={row.revokedAt ? 'error' : 'active'}>{row.revokedAt ? t('sec.dev.revoked') : t('sec.dev.active')}</Status></td>
              <td className={td}>{canRevoke && !row.revokedAt ? <Button size="sm" variant="outline" onClick={() => setTarget(row)}>{t('sec.dev.revoke')}</Button> : null}</td>
            </tr>
          ))}
        </Table>
      )}</Gate>
      <ConfirmDialog open={Boolean(target)} destructive busy={busy === 'revoke'} title={t('sec.dev.revoke')} description={target ? `${t('sec.dev.confirm')} ${target.userEmail}` : ''} confirmLabel={t('sec.dev.revoke')}
        onCancel={() => setTarget(null)}
        onConfirm={() => { if (!target) return; void act('revoke', async () => { const result = await api.revokeDevice(organizationId, target.id); setTarget(null); await resource.reload(); return result; }, undefined).then(() => undefined); }} />
    </DashboardCard>
  );
}

function SessionsPanel({ organizationId, canRevoke }: { organizationId: string; canRevoke: boolean }) {
  const { t, locale } = useI18n();
  const resource = useResource(() => api.listSessions(organizationId), [organizationId]);
  const { busy, error, ok, act } = useBusy();
  const when = (value: string) => new Date(value).toLocaleString(locale);
  return (
    <DashboardCard title={t('sec.tab.sessions')} actions={<Refresh onClick={() => void resource.reload()} />}>
      <Notice error={error} ok={ok} />
      <Gate resource={resource}>{(rows) => rows.length === 0 ? <EmptyState icon={Key} title={t('sec.empty')} /> : (
        <Table head={[t('sec.col.user'), t('sec.col.ip'), t('sec.col.device'), t('sec.col.created'), t('sec.col.expires'), t('sec.col.actions')]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className={td}>{who(row.userName, row.userEmail)}</td><td className={td}>{row.ipAddress ?? '—'}</td><td className={cn(td, 'max-w-56 truncate')} title={row.userAgent ?? undefined}>{agent(row.userAgent)}</td>
              <td className={td}>{when(row.createdAt)}</td><td className={td}>{when(row.expiresAt)}</td>
              <td className={td}>{canRevoke ? <Button size="sm" variant="outline" loading={busy === row.id} onClick={() => void act(row.id, async () => { await api.revokeSession(organizationId, row.id); await resource.reload(); }, t('sec.ses.endedOk'))}>{t('sec.ses.end')}</Button> : null}</td>
            </tr>
          ))}
        </Table>
      )}</Gate>
    </DashboardCard>
  );
}

function UsersPanel({ organizationId, canRevoke }: { organizationId: string; canRevoke: boolean }) {
  const { t, locale } = useI18n();
  const resource = useResource(() => api.listSecurityUsers(organizationId), [organizationId]);
  const { busy, error, ok, act } = useBusy();
  return (
    <DashboardCard title={t('sec.tab.users')} actions={<Refresh onClick={() => void resource.reload()} />}>
      <Notice error={error} ok={ok} />
      <Gate resource={resource}>{(rows) => rows.length === 0 ? <EmptyState icon={Users} title={t('sec.empty')} /> : (
        <Table head={[t('sec.col.user'), t('sec.col.role'), t('sec.col.status'), t('sec.col.mailbox'), t('sec.col.password'), t('sec.col.sessions'), t('sec.col.devices'), t('sec.col.last'), t('sec.col.actions')]}>
          {rows.map((row) => (
            <tr key={row.userId}>
              <td className={td}>{who(row.name, row.email)}</td><td className={td}>{row.role}</td>
              <td className={td}><Status tone={row.status === 'ACTIVE' ? 'active' : 'error'}>{row.status}</Status></td>
              <td className={td}><Status tone={row.mailbox === 'verified' ? 'active' : row.mailbox === 'organization' ? 'info' : 'pending'}>{t(`sec.users.mailbox.${row.mailbox}`)}</Status></td>
              <td className={td}>{row.passwordChangeRequired ? t('sec.users.pwRequired') : t('sec.users.pwOk')}</td><td className={td}>{row.activeSessions}</td><td className={td}>{row.activeDevices}</td>
              <td className={td}>{row.lastSessionAt ? new Date(row.lastSessionAt).toLocaleString(locale) : '—'}</td>
              <td className={td}>{canRevoke && row.activeSessions > 0 ? <Button size="sm" variant="outline" loading={busy === row.userId} onClick={() => void act(row.userId, async () => { const result = await api.revokeUserSessions(organizationId, row.userId); await resource.reload(); return result; })}>{t('sec.ses.endAll')}</Button> : null}</td>
            </tr>
          ))}
        </Table>
      )}</Gate>
    </DashboardCard>
  );
}

function IpsPanel({ organizationId, canManage }: { organizationId: string; canManage: boolean }) {
  const { t } = useI18n();
  const resource = useResource(() => api.listIpRules(organizationId), [organizationId]);
  const [kind, setKind] = useState<'ALLOW' | 'DENY'>('DENY');
  const [cidr, setCidr] = useState('');
  const [note, setNote] = useState('');
  const { busy, error, ok, act } = useBusy();
  const add = async () => {
    const done = await act('add', async () => { await api.addIpRule(organizationId, { kind, cidr: cidr.trim(), ...(note.trim() ? { note: note.trim() } : {}) }); await resource.reload(); }, t('sec.ip.added'));
    if (done) { setCidr(''); setNote(''); }
  };
  return (
    <DashboardCard title={t('sec.tab.ips')} description={t('sec.ip.help')} actions={<Refresh onClick={() => void resource.reload()} />}>
      {canManage ? (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); void add(); }}>
          <select aria-label={t('sec.col.kind')} className={cn(selectClass, 'w-32')} value={kind} onChange={(event) => setKind(event.target.value as 'ALLOW' | 'DENY')}>
            <option value="DENY">{t('sec.ip.kind.DENY')}</option><option value="ALLOW">{t('sec.ip.kind.ALLOW')}</option>
          </select>
          <Input className="min-w-56 flex-1" aria-label={t('sec.col.range')} placeholder={t('sec.ip.placeholder')} value={cidr} onChange={(event) => setCidr(event.target.value)} />
          <Input className="min-w-40 flex-1" aria-label={t('sec.col.note')} placeholder={t('sec.ip.note')} value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} />
          <Button size="sm" variant="accent" type="submit" loading={busy === 'add'} disabled={!cidr.trim()}>{t('sec.ip.add')}</Button>
        </form>
      ) : null}
      <Notice error={error} ok={ok} />
      <Gate resource={resource}>{(rows) => rows.length === 0 ? <EmptyState icon={Globe} title={t('sec.empty')} /> : (
        <Table head={[t('sec.col.kind'), t('sec.col.range'), t('sec.col.note'), t('sec.col.actions')]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className={td}><Status tone={row.kind === 'DENY' ? 'error' : 'active'}>{t(`sec.ip.kind.${row.kind}`)}</Status></td><td className={td}>{row.cidr}</td><td className={td}>{row.note ?? '—'}</td>
              <td className={td}>{canManage ? <Button size="sm" variant="outline" loading={busy === row.id} onClick={() => void act(row.id, async () => { await api.removeIpRule(organizationId, row.id); await resource.reload(); }, t('sec.ip.removed'))}>{t('sec.ip.remove')}</Button> : null}</td>
            </tr>
          ))}
        </Table>
      )}</Gate>
    </DashboardCard>
  );
}

function AlertsPanel({ organizationId, canManage }: { organizationId: string; canManage: boolean }) {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<api.AlertStatus | ''>('OPEN');
  const resource = useResource(() => api.listAlerts(organizationId, status || undefined), [organizationId, status]);
  const { busy, error, act } = useBusy();
  const move = (id: string, next: api.AlertStatus) => void act(id, async () => { await api.setAlertStatus(organizationId, id, next); await resource.reload(); });
  return (
    <DashboardCard title={t('sec.tab.alerts')} actions={<div className="flex items-center gap-2">
      <select aria-label={t('sec.al.filter')} className={cn(selectClass, 'w-36')} value={status} onChange={(event) => setStatus(event.target.value as api.AlertStatus | '')}>
        <option value="">{t('sec.al.all')}</option>{(['OPEN', 'ACKNOWLEDGED', 'RESOLVED'] as const).map((value) => <option key={value} value={value}>{t(`sec.al.status.${value}`)}</option>)}
      </select><Refresh onClick={() => void resource.reload()} /></div>}>
      <Notice error={error} />
      <Gate resource={resource}>{(rows) => rows.length === 0 ? <EmptyState icon={Siren} title={t('sec.empty')} /> : (
        <Table head={[t('sec.col.alert'), t('sec.col.count'), t('sec.col.last'), t('sec.col.email'), t('sec.col.status'), t('sec.col.actions')]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className={td}><Status tone={row.severity === 'critical' ? 'error' : row.severity === 'warning' ? 'pending' : 'info'}>{row.kind}</Status></td><td className={td}>{row.count}</td>
              <td className={td}>{new Date(row.lastSeenAt).toLocaleString(locale)}</td>
              <td className={td} title={row.emailError ?? undefined}>{t(`sec.al.email.${row.emailStatus}`)}</td>
              <td className={td}>{t(`sec.al.status.${row.status}`)}</td>
              <td className={td}>{canManage ? (
                <div className="flex gap-1">
                  {row.status === 'OPEN' ? <Button size="sm" variant="outline" loading={busy === row.id} onClick={() => move(row.id, 'ACKNOWLEDGED')}>{t('sec.al.ack')}</Button> : null}
                  {row.status !== 'RESOLVED' ? <Button size="sm" variant="outline" loading={busy === row.id} onClick={() => move(row.id, 'RESOLVED')}>{t('sec.al.resolve')}</Button> : <Button size="sm" variant="outline" loading={busy === row.id} onClick={() => move(row.id, 'OPEN')}>{t('sec.al.reopen')}</Button>}
                </div>
              ) : null}</td>
            </tr>
          ))}
        </Table>
      )}</Gate>
    </DashboardCard>
  );
}

function AuditPanel({ organizationId }: { organizationId: string }) {
  const { t, locale } = useI18n();
  const first = useResource(() => api.listSecurityAudit(organizationId), [organizationId]);
  const [more, setMore] = useState<api.SecurityAudit[]>([]);
  const [done, setDone] = useState(false);
  const { busy, error, act } = useBusy();
  const rows = [...(first.data ?? []), ...more];
  const last = rows.at(-1);
  return (
    <DashboardCard title={t('sec.tab.audit')} actions={<Refresh onClick={() => { setMore([]); setDone(false); void first.reload(); }} />}>
      <Notice error={error} />
      <Gate resource={first}>{() => rows.length === 0 ? <EmptyState icon={ClockCounterClockwise} title={t('sec.empty')} /> : (
        <>
          <Table head={[t('sec.col.when'), t('sec.col.action'), t('sec.col.target'), t('sec.col.user')]}>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className={td}>{new Date(row.createdAt).toLocaleString(locale)}</td><td className={td}>{row.action}</td>
                <td className={td}>{row.targetType ? `${row.targetType}${row.targetId ? ` · ${row.targetId}` : ''}` : '—'}</td><td className={td}>{row.actorId ?? '—'}</td>
              </tr>
            ))}
          </Table>
          {!done && last ? <Button size="sm" variant="secondary" loading={busy === 'more'} onClick={() => void act('more', async () => { const page = await api.listSecurityAudit(organizationId, last.createdAt); setMore((current) => [...current, ...page]); if (page.length < 50) setDone(true); })}>{t('sec.audit.more')}</Button> : null}
        </>
      )}</Gate>
    </DashboardCard>
  );
}

function PoliciesPanel({ organizationId, canManage, canNotify }: { organizationId: string; canManage: boolean; canNotify: boolean }) {
  const { t } = useI18n();
  const resource = useResource(() => api.getPolicy(organizationId), [organizationId]);
  return (
    <div className="space-y-4">
      <Gate resource={resource}>{(policy) => <PolicyForm key={policy.updatedAt ?? 'new'} organizationId={organizationId} policy={policy} canManage={canManage} onSaved={() => void resource.reload()} />}</Gate>
      {canNotify ? <NotificationsForm organizationId={organizationId} /> : null}
      {!canManage ? <p className="text-xs text-text-muted">{t('sec.pol.readonly')}</p> : null}
    </div>
  );
}

const toLimit = (value: string) => (value.trim() === '' ? null : Math.max(1, Math.min(1000, Number.parseInt(value, 10) || 1)));

function PolicyForm({ organizationId, policy, canManage, onSaved }: { organizationId: string; policy: api.Policy; canManage: boolean; onSaved: () => void }) {
  const { t } = useI18n();
  const [enforcement, setEnforcement] = useState(policy.enforcement);
  const [maxDevices, setMaxDevices] = useState(policy.maxDevices?.toString() ?? '');
  const [maxSessions, setMaxSessions] = useState(policy.maxSessions?.toString() ?? '');
  const [overflow, setOverflow] = useState<api.Overflow>(policy.overflowPolicy);
  const [alertsEnabled, setAlertsEnabled] = useState(policy.alertsEnabled);
  const [retentionDays, setRetentionDays] = useState(String(policy.retentionDays));
  const [until, setUntil] = useState(policy.retentionExemption?.until.slice(0, 10) ?? '');
  const [reason, setReason] = useState(policy.retentionExemption?.reason ?? '');
  const { busy, error, ok, act } = useBusy();
  const save = () => void act('save', async () => {
    await api.savePolicy(organizationId, {
      enforcement, maxDevices: toLimit(maxDevices), maxSessions: toLimit(maxSessions), overflowPolicy: overflow, alertsEnabled,
      retentionDays: Math.max(7, Math.min(3650, Number.parseInt(retentionDays, 10) || 90)),
      retentionExemption: until && reason.trim() ? { until: new Date(`${until}T23:59:59`).toISOString(), reason: reason.trim() } : null,
    });
    onSaved();
  }, t('sec.pol.saved'));
  const check = 'size-3.5 accent-(--color-accent)';
  const field = 'space-y-0.5';
  return (
    <DashboardCard title={t('sec.pol.title')}>
      <fieldset disabled={!canManage} className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm text-text sm:col-span-2"><input type="checkbox" className={check} checked={enforcement} onChange={(event) => setEnforcement(event.target.checked)} />{t('sec.pol.enforcement')}</label>
        <label className={field}><span className="ui-label block">{t('sec.pol.maxDevices')}</span><Input type="number" min={1} max={1000} value={maxDevices} placeholder={t('sec.pol.unlimited')} onChange={(event) => setMaxDevices(event.target.value)} /></label>
        <label className={field}><span className="ui-label block">{t('sec.pol.maxSessions')}</span><Input type="number" min={1} max={1000} value={maxSessions} placeholder={t('sec.pol.unlimited')} onChange={(event) => setMaxSessions(event.target.value)} /></label>
        <label className={cn(field, 'sm:col-span-2')}><span className="ui-label block">{t('sec.pol.overflow')}</span>
          <select className={cn(selectClass, 'w-full')} value={overflow} onChange={(event) => setOverflow(event.target.value as api.Overflow)}>
            {(['BLOCK_NEW', 'REQUIRE_USER_CHOICE', 'REPLACE_OLDEST'] as const).map((value) => <option key={value} value={value}>{t(`sec.pol.overflow.${value}`)}</option>)}
          </select>
          <span className="block text-[11px] text-text-muted">{t('sec.pol.devicesNote')}</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-text sm:col-span-2"><input type="checkbox" className={check} checked={alertsEnabled} onChange={(event) => setAlertsEnabled(event.target.checked)} />{t('sec.pol.alerts')}</label>
        <label className={field}><span className="ui-label block">{t('sec.pol.retentionDays')}</span><Input type="number" min={7} max={3650} value={retentionDays} onChange={(event) => setRetentionDays(event.target.value)} /></label>
        <label className={field}><span className="ui-label block">{t('sec.pol.exemptUntil')}</span><Input type="date" value={until} onChange={(event) => setUntil(event.target.value)} /></label>
        <label className={cn(field, 'sm:col-span-2')}><span className="ui-label block">{t('sec.pol.exemptReason')}</span><Input value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} /></label>
      </fieldset>
      <Notice error={error} ok={ok} />
      {canManage ? <Button variant="accent" size="sm" loading={busy === 'save'} onClick={save}>{t('sec.pol.save')}</Button> : null}
    </DashboardCard>
  );
}

function NotificationsForm({ organizationId }: { organizationId: string }) {
  const resource = useResource(() => api.getNotifications(organizationId), [organizationId]);
  return <Gate resource={resource}>{(data) => <NotificationsFields key={data.alertEmailRecipients.join()} organizationId={organizationId} initial={data} />}</Gate>;
}

function NotificationsFields({ organizationId, initial }: { organizationId: string; initial: api.Notifications }) {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(initial.alertEmailEnabled);
  const [recipients, setRecipients] = useState(initial.alertEmailRecipients.join(', '));
  const { busy, error, ok, act } = useBusy();
  const save = () => void act('save', () => api.saveNotifications(organizationId, { alertEmailEnabled: enabled, alertEmailRecipients: recipients.split(',').map((item) => item.trim()).filter(Boolean) }), t('sec.notif.saved'));
  return (
    <DashboardCard title={t('sec.notif.title')}>
      <label className="flex items-center gap-2 text-sm text-text"><input type="checkbox" className="size-3.5 accent-(--color-accent)" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />{t('sec.notif.enabled')}</label>
      <label className="block space-y-0.5"><span className="ui-label block">{t('sec.notif.recipients')}</span><Input value={recipients} onChange={(event) => setRecipients(event.target.value)} /></label>
      <Notice error={error} ok={ok} />
      <Button variant="accent" size="sm" loading={busy === 'save'} onClick={save}>{t('sec.notif.save')}</Button>
    </DashboardCard>
  );
}
