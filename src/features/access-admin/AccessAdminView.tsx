import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { listDatasets } from '@/features/admin-center/api';
import { PERMISSION_GROUPS, permissionHintKey, permissionLabelKey } from './permissionCatalog';
import { AccessRequestQueueCard, ExpiryNote, RequestAccessCard } from './AccessRequests';
import { AccessTemplatesCard, ApplyTemplateRow } from './AccessTemplates';
import { ArrowsClockwise, Copy, EnvelopeSimple, Key, MagnifyingGlass, Plus, ShieldCheck, Trash, Users } from '@phosphor-icons/react';
import { DashboardCard } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ResponsiveList } from '@/components/ui/responsive-list';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { useNotifications } from '@/context/NotificationContext';
import { usePermissions } from '@/context/PermissionContext';
import { useI18n } from '@/lib/i18n';
import { PERM } from '@/lib/permission';
import { cn } from '@/lib/utils';
import {
  INVITABLE_ROLES, TENANT_ROLES, addGroupMember, changeMemberRole, createGroup, createInvitation, createInvitationKey, deleteGroup,
  grantGroupPermission, grantMemberPermission, listGroups, listInvitations, listMemberGrants, listMembers, removeGroupMember, removeMember,
  archiveInvitation, deleteInvitation, getAccessSimulation, getOrganizationPolicy, grantRoleDataAccess, listMemberGrantDetails, saveOrganizationPolicy, replaceInvitation, restoreInvitation, revokeGroupPermission, revokeInvitation, revokeMemberPermission,
  type AccessSimulation, type Group, type Invitation, type IssuedInvitation, type Member, type RegisteredPermission, type TenantRole,
} from './api';
import { AddUserDialog } from './AddUserDialog';
import { CreateUserDialog } from './CreateUserDialog';
import { AuditScreen } from './AuditScreen';
import { SettingsScreen } from './SettingsScreen';
import { LoadError, Loading, Notice, Shell, errorText, memberLabel, selectClass, td, th, useBusy, useList } from './ui';

export type AccessSection = 'settings' | 'users' | 'invitations' | 'groups' | 'permissions' | 'audit';
export const ACCESS_SECTIONS: AccessSection[] = ['settings', 'users', 'invitations', 'groups', 'permissions', 'audit'];

const initials = (member: Member) => memberLabel(member).slice(0, 2).toUpperCase();

// ---------------------------------------------------------------------------
// Contextual member panel (read-only view; every change stays in the screens below and is authorized by CORECROW)
// ---------------------------------------------------------------------------

function MemberSheet({ organizationId, member, groups, currentUserId, onClose }: { organizationId: string; member: Member | null; groups: Group[]; currentUserId: string; onClose: () => void }) {
  const { t, locale } = useI18n();
  const grants = useList(() => (member ? listMemberGrants(organizationId, member.userId) : Promise.resolve([] as RegisteredPermission[])), [organizationId, member?.userId]);
  const memberGroups = member ? groups.filter((group) => group.memberUserIds.includes(member.userId)) : [];
  const inherited = [...new Set(memberGroups.flatMap((group) => group.permissions))];
  const chips = (items: string[]) => <ul className="flex flex-wrap gap-1">{items.map((item) => <li key={item} className="mono-data rounded-md border border-border bg-surface-hover px-1.5 py-0.5">{item}</li>)}</ul>;
  return (
    <Sheet open={Boolean(member)} onOpenChange={(open) => { if (!open) onClose(); }} side="right" title={member ? memberLabel(member) : ''} description={member?.email}>
      {member ? (
        <div className="space-y-4 text-xs">
          <dl className="space-y-1.5">
            <div className="flex justify-between gap-3"><dt className="text-text-secondary">{t('access.col.role')}</dt><dd className="font-medium text-text">{member.role}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-text-secondary">{t('access.col.status')}</dt><dd className="text-text">{member.status ?? '—'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-text-secondary">{t('adm.col.joined')}</dt><dd className="text-text">{new Date(member.createdAt).toLocaleDateString(locale)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-text-secondary">ID</dt><dd className="mono-data max-w-48 truncate text-text">{member.userId}</dd></div>
            {member.userId === currentUserId ? <p className="text-text-muted">{t('access.you')}</p> : null}
          </dl>
          <section className="space-y-1.5"><h3 className="ui-label">{t('adm.col.groups')}</h3>{memberGroups.length === 0 ? <p className="text-text-muted">—</p> : chips(memberGroups.map((group) => group.name))}</section>
          <section className="space-y-1.5"><h3 className="ui-label">{t('adm2.members.direct')}</h3>{grants.loading && !grants.data ? <Loading /> : (grants.data ?? []).length === 0 ? <p className="text-text-muted">{grants.error ?? t('access.perm.none')}</p> : chips(grants.data ?? [])}</section>
          <section className="space-y-1.5"><h3 className="ui-label">{t('adm2.members.viaGroups')}</h3>{inherited.length === 0 ? <p className="text-text-muted">—</p> : chips(inherited)}</section>
          <p className="text-text-muted">{t('adm2.members.sheetNote')}</p>
        </div>
      ) : null}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Users and roles
// ---------------------------------------------------------------------------

function UsersScreen({ organizationId, currentUserId }: { organizationId: string; currentUserId: string }) {
  const { t, locale } = useI18n();
  const { can } = usePermissions();
  const manage = can(PERM.membersManage);
  const members = useList(() => listMembers(organizationId), [organizationId]);
  const groups = useList(() => (can(PERM.groupsRead) ? listGroups(organizationId) : Promise.resolve([] as Group[])), [organizationId]);
  const { busy, error, ok, act } = useBusy();
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'' | TenantRole>('');
  const [statusFilter, setStatusFilter] = useState<'' | 'ACTIVE' | 'SUSPENDED'>('');
  const [selected, setSelected] = useState<Member | null>(null);

  const groupNames = (member: Member) => (groups.data ?? []).filter((group) => group.memberUserIds.includes(member.userId)).map((group) => group.name);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (members.data ?? []).filter((member) => (!roleFilter || member.role === roleFilter)
      && (!statusFilter || (member.status ?? 'ACTIVE') === statusFilter)
      && (!needle || `${member.name ?? ''} ${member.email ?? ''}`.toLowerCase().includes(needle)));
  }, [members.data, query, roleFilter, statusFilter]);

  const roleSelect = (member: Member) => (
    <select aria-label={t('access.col.role')} className={selectClass} value={member.role} disabled={!manage || busy === member.userId}
      onChange={(event) => void act(member.userId, () => changeMemberRole(organizationId, member.userId, event.target.value as TenantRole), t('access.users.roleChanged')).then(() => members.reload())}>
      {TENANT_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
    </select>
  );
  const removeButton = (member: Member) => (
    <Button size="icon-sm" variant="ghost" aria-label={t('access.users.remove')} title={t('access.users.remove')} disabled={!manage || member.userId === currentUserId} onClick={() => setConfirmRemove(member)}><Trash className="size-3.5" /></Button>
  );
  const you = (member: Member) => member.userId === currentUserId && <span className="ml-1.5 text-text-muted">({t('access.you')})</span>;
  const avatar = (member: Member) => <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-active text-[11px] font-semibold text-text">{initials(member)}</span>;
  const chips = (member: Member) => groupNames(member).map((name) => <span key={name} className="rounded-full border border-border bg-surface-hover px-1.5 py-px text-[11px] text-text-secondary">{name}</span>);

  return (
    <Shell title={t('access.users.title')} hint={t('access.users.hint')}>
      <DashboardCard title={t('access.users.members')} description={manage ? undefined : t('access.readOnly')}
        actions={<div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => { void members.reload(); void groups.reload(); }}><ArrowsClockwise className="size-3.5" />{t('access.refresh')}</Button>{manage && <Button size="sm" variant="secondary" onClick={() => setCreating(true)}><Plus className="size-3.5" />{t('adm.create.open')}</Button>}{manage && <Button size="sm" variant="accent" onClick={() => setAdding(true)}><Plus className="size-3.5" />{t('adm.users.add')}</Button>}</div>}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1 sm:max-w-xs"><MagnifyingGlass className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" /><Input className="pl-7" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('adm.users.search')} aria-label={t('adm.users.search')} /></div>
          <select aria-label={t('access.col.role')} className={selectClass} value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}><option value="">{t('adm.users.allRoles')}</option>{TENANT_ROLES.map((role) => <option key={role}>{role}</option>)}</select>
          <select aria-label={t('access.col.status')} className={selectClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="">{t('adm2.members.allStatus')}</option><option value="ACTIVE">ACTIVE</option><option value="SUSPENDED">SUSPENDED</option></select>
          <span className="text-xs text-text-muted" role="status">{t('adm2.members.count', { shown: visible.length, total: members.data?.length ?? 0 })}</span>
        </div>
        <Notice error={error ?? (members.data ? members.error : null)} ok={ok} />
        <LoadError list={members} />
        {members.loading && !members.data ? <Loading /> : members.data && members.data.length === 0 ? <EmptyState icon={Users} title={t('access.users.empty')} /> : members.data && visible.length === 0 ? <EmptyState icon={MagnifyingGlass} title={t('adm.users.noResults')} /> : members.data && (
          <ResponsiveList items={visible} getKey={(member) => member.id}
            renderCard={(member, index) => (
              <div className="np-card np-stagger space-y-2 p-3" style={{ '--i': index } as React.CSSProperties}>
                <div className="flex items-start gap-2">
                  {avatar(member)}
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-text">{memberLabel(member)}{you(member)}</p><p className="truncate text-xs text-text-secondary">{member.email ?? '—'}</p></div>
                  <span className="text-xs text-text-muted">{member.status ?? '—'}</span>
                </div>
                <div className="flex flex-wrap gap-1">{chips(member)}</div>
                <div className="flex items-center justify-between gap-2">{roleSelect(member)}{removeButton(member)}</div>
              </div>
            )}
            table={(
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead><tr><th className={th}>{t('access.col.user')}</th><th className={th}>{t('access.col.role')}</th><th className={th}>{t('adm.col.groups')}</th><th className={th}>{t('access.col.status')}</th><th className={th}>{t('adm.col.joined')}</th><th className={th} /></tr></thead>
                  <tbody>
                    {visible.map((member) => (
                      <tr key={member.id} tabIndex={0} onClick={(event) => { if (!(event.target as HTMLElement).closest('select,button')) setSelected(member); }} onKeyDown={(event) => { if (event.key === 'Enter' && event.target === event.currentTarget) setSelected(member); }} className="cursor-pointer outline-none hover:bg-surface-hover/50 focus-visible:bg-surface-hover">
                        <td className={cn(td, 'max-w-72')}><div className="flex items-center gap-2">{avatar(member)}<div className="min-w-0"><p className="truncate font-medium">{memberLabel(member)}{you(member)}</p><p className="truncate text-text-secondary">{member.email ?? '—'}</p></div></div></td>
                        <td className={td}>{roleSelect(member)}</td>
                        <td className={cn(td, 'max-w-56')}><div className="flex flex-wrap gap-1">{chips(member)}</div></td>
                        <td className={td}>{member.status ?? '—'}</td>
                        <td className={cn(td, 'whitespace-nowrap')}>{new Date(member.createdAt).toLocaleDateString(locale)}</td>
                        <td className={cn(td, 'text-right')}>{removeButton(member)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )} />
        )}
        <p className="text-[11px] text-text-muted">{t('access.users.rolesNote')}</p>
      </DashboardCard>
      <MemberSheet organizationId={organizationId} member={selected} groups={groups.data ?? []} currentUserId={currentUserId} onClose={() => setSelected(null)} />
      <CreateUserDialog open={creating} organizationId={organizationId} groups={groups.data ?? []} canAssignGroups={can(PERM.permissionsManage)} onClose={() => setCreating(false)} onDone={() => { void members.reload(); void groups.reload(); }} />
      <AddUserDialog open={adding} organizationId={organizationId} groups={groups.data ?? []} canAssignGroups={can(PERM.permissionsManage)} onClose={() => setAdding(false)} onDone={() => { void members.reload(); void groups.reload(); }} />
      <ConfirmDialog open={Boolean(confirmRemove)} destructive busy={busy === confirmRemove?.userId} title={t('adm.users.removeTitle')} description={confirmRemove ? `${memberLabel(confirmRemove)} — ${t('adm.users.removeBody')}` : undefined} confirmLabel={t('access.users.remove')}
        onCancel={() => setConfirmRemove(null)}
        onConfirm={() => { const target = confirmRemove; if (target) void act(target.userId, () => removeMember(organizationId, target.userId), t('access.users.removed')).then(() => { setConfirmRemove(null); return members.reload(); }); }} />
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Invitations: by email, and short organization keys
// ---------------------------------------------------------------------------

function InvitationsScreen({ organizationId }: { organizationId: string }) {
  const { t, locale } = useI18n();
  const { can } = usePermissions();
  const { push } = useNotifications();
  const manage = can(PERM.invitationsManage);
  const [showArchived, setShowArchived] = useState(false);
  const invitations = useList(() => listInvitations(organizationId, showArchived), [organizationId, showArchived]);
  const groups = useList(() => listGroups(organizationId), [organizationId]);
  const { busy, error, ok, act } = useBusy();
  const [tab, setTab] = useState<'EMAIL' | 'CODE'>('EMAIL');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<(typeof INVITABLE_ROLES)[number]>('VIEWER');
  const [hours, setHours] = useState(72);
  const [maxUses, setMaxUses] = useState(1);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [issued, setIssued] = useState<IssuedInvitation | null>(null);
  const [revoking, setRevoking] = useState<Invitation | null>(null);
  const [deleting, setDeleting] = useState<Invitation | null>(null);

  const isKey = tab === 'CODE';
  const rows = (invitations.data ?? []).filter((invitation) => invitation.kind === tab);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const done = await act('create', async () => {
      setIssued(isKey
        ? await createInvitationKey(organizationId, { role, expiresInHours: hours, maxUses, groupIds })
        : await createInvitation(organizationId, { email: email.trim(), role, expiresInHours: hours, groupIds, permissions: [] }));
    }, isKey ? t('adm.keys.created') : t('access.inv.created'));
    if (done) { setEmail(''); setGroupIds([]); await invitations.reload(); }
  };
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); push({ type: 'success', title: t('adm.keys.copied') }); }
    catch (reason) { push({ type: 'error', title: errorText(reason) }); }
  };
  const statusClass = (status: Invitation['status']) => status === 'PENDING' ? 'text-accent' : status === 'ACCEPTED' ? 'text-success' : 'text-text-muted';
  const label = (invitation: Invitation) => invitation.email ?? `${t('adm.col.key')} …${invitation.keyHint ?? '????'}`;
  const finishedActions = (invitation: Invitation) => (
    <span className="inline-flex gap-1">
      <Button size="sm" variant="ghost" disabled={!manage || busy === invitation.id} onClick={() => void act(invitation.id, () => (showArchived ? restoreInvitation : archiveInvitation)(organizationId, invitation.id), showArchived ? t('access.inv.restored') : t('access.inv.archived')).then(() => invitations.reload())}>{showArchived ? t('access.inv.restore') : t('access.inv.archive')}</Button>
      {invitation.status !== 'ACCEPTED' && <Button size="sm" variant="ghost" disabled={!manage || busy === invitation.id} onClick={() => setDeleting(invitation)}>{t('access.inv.delete')}</Button>}
    </span>
  );
  const actions = (invitation: Invitation) => invitation.status !== 'PENDING' ? finishedActions(invitation) : (
    <span className="inline-flex gap-1">
      {invitation.kind === 'EMAIL' && <Button size="sm" variant="ghost" disabled={!manage || busy === invitation.id} onClick={() => void act(invitation.id, async () => { setIssued(await replaceInvitation(organizationId, invitation.id)); }, t('access.inv.replaced')).then(() => invitations.reload())}>{t('access.inv.replace')}</Button>}
      <Button size="sm" variant="ghost" disabled={!manage || busy === invitation.id} onClick={() => setRevoking(invitation)}>{t('access.inv.revoke')}</Button>
    </span>
  );
  const uses = (invitation: Invitation) => invitation.kind === 'CODE' ? `${invitation.useCount}/${invitation.maxUses}` : '—';

  return (
    <Shell title={t('access.inv.title')} hint={t('access.inv.hint')}>
      <div role="tablist" className="inline-flex gap-1 rounded-lg bg-surface-hover p-1">
        {(['EMAIL', 'CODE'] as const).map((kind) => <button key={kind} role="tab" aria-selected={tab === kind} type="button" onClick={() => { setTab(kind); setIssued(null); }} className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium', tab === kind ? 'bg-surface text-text shadow-soft' : 'text-text-muted hover:text-text')}>{kind === 'EMAIL' ? <EnvelopeSimple className="size-3.5" /> : <Key className="size-3.5" />}{kind === 'EMAIL' ? t('adm.inv.tabEmail') : t('adm.inv.tabKeys')}</button>)}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <DashboardCard title={isKey ? t('adm.keys.new') : t('access.inv.new')} description={manage ? (isKey ? t('adm.keys.hint') : t('access.inv.verifiedNote')) : t('access.readOnly')}>
          <form onSubmit={(event) => void submit(event)} className="space-y-3">
            {!isKey && <label className="block space-y-1"><span className="ui-label">{t('access.col.email')}</span><Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={!manage} autoComplete="off" /></label>}
            <div className={cn('grid gap-2', isKey ? 'grid-cols-3' : 'grid-cols-2')}>
              <label className="block min-w-0 space-y-1"><span className="ui-label">{t('access.col.role')}</span><select className={cn(selectClass, 'w-full')} value={role} disabled={!manage} onChange={(event) => setRole(event.target.value as typeof role)}>{INVITABLE_ROLES.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="block min-w-0 space-y-1"><span className="ui-label">{t('access.inv.expires')}</span><Input type="number" min={1} max={720} value={hours} disabled={!manage} onChange={(event) => setHours(Math.min(720, Math.max(1, Number(event.target.value) || 1)))} /></label>
              {isKey && <label className="block min-w-0 space-y-1"><span className="ui-label">{t('adm.keys.maxUses')}</span><Input type="number" min={1} max={1000} value={maxUses} disabled={!manage} onChange={(event) => setMaxUses(Math.min(1000, Math.max(1, Number(event.target.value) || 1)))} /></label>}
            </div>
            {groups.data && groups.data.length > 0 && can(PERM.permissionsManage) && (
              <fieldset className="space-y-1"><legend className="ui-label">{t('access.nav.groups')}</legend>
                <div className="flex flex-wrap gap-2">{groups.data.map((group) => (
                  <label key={group.id} className="flex items-center gap-1.5 text-xs text-text-secondary pointer-coarse:min-h-(--touch-min)"><input type="checkbox" disabled={!manage} checked={groupIds.includes(group.id)} onChange={(event) => setGroupIds((current) => event.target.checked ? [...current, group.id] : current.filter((id) => id !== group.id))} />{group.name}</label>
                ))}</div>
              </fieldset>
            )}
            <Button type="submit" variant="accent" disabled={!manage} loading={busy === 'create'}>{isKey ? <Key className="size-4" /> : <EnvelopeSimple className="size-4" />}{isKey ? t('adm.keys.create') : t('access.inv.send')}</Button>
            <Notice error={error} ok={ok} />
            {issued?.token && (
              <div className="space-y-1 rounded-lg border border-accent/40 bg-accent-soft p-2.5">
                <p className="text-xs text-text-secondary">{t('adm.keys.created')}</p>
                <div className="flex items-center gap-2"><code className="min-w-0 flex-1 break-all font-mono text-sm font-semibold text-text">{issued.token}</code><Button size="icon-sm" variant="secondary" aria-label={t('adm.keys.copy')} title={t('adm.keys.copy')} onClick={() => void copy(issued.token!)}><Copy className="size-4" /></Button></div>
              </div>
            )}
            {issued && !issued.token && <p role="status" className="text-xs text-text-secondary">{issued.delivery === 'sent' ? t('access.inv.sent') : t('access.inv.notSent')}</p>}
          </form>
        </DashboardCard>

        <DashboardCard title={isKey ? t('adm.keys.list') : t('access.inv.list')} actions={<span className="inline-flex gap-1"><Button size="sm" variant="ghost" aria-pressed={showArchived} onClick={() => setShowArchived((value) => !value)}>{showArchived ? t('access.inv.showActive') : t('access.inv.showArchived')}</Button><Button size="sm" variant="ghost" onClick={() => void invitations.reload()}><ArrowsClockwise className="size-3.5" />{t('access.refresh')}</Button></span>}>
          {invitations.error && invitations.data && <Notice error={invitations.error} />}
          <LoadError list={invitations} />
          {invitations.loading && !invitations.data ? <Loading /> : invitations.data && rows.length === 0 ? <EmptyState icon={isKey ? Key : EnvelopeSimple} title={isKey ? t('adm.keys.empty') : t('access.inv.empty')} /> : invitations.data && (
            <ResponsiveList items={rows} getKey={(invitation) => invitation.id}
              renderCard={(invitation, index) => (
                <div className="np-card np-stagger space-y-2 p-3" style={{ '--i': index } as React.CSSProperties}>
                  <div className="flex items-start justify-between gap-2"><p className="min-w-0 truncate text-sm font-medium text-text">{label(invitation)}</p><span className={cn('text-xs', statusClass(invitation.status))}>{invitation.status}</span></div>
                  <p className="text-xs text-text-secondary">{invitation.role}{isKey ? ` · ${t('adm.col.uses')}: ${uses(invitation)}` : ''} · {new Date(invitation.expiresAt).toLocaleString(locale)}</p>
                  <div className="flex gap-1">{actions(invitation)}</div>
                </div>
              )}
              table={(
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead><tr><th className={th}>{isKey ? t('adm.col.key') : t('access.col.email')}</th><th className={th}>{t('access.col.role')}</th>{isKey && <th className={th}>{t('adm.col.uses')}</th>}<th className={th}>{t('access.col.status')}</th><th className={th}>{t('adm.col.created')}</th><th className={th}>{t('access.inv.expires')}</th><th className={th} /></tr></thead>
                    <tbody>{rows.map((invitation) => (
                      <tr key={invitation.id} className="hover:bg-surface-hover/50">
                        <td className={cn(td, 'max-w-64 truncate', isKey && 'font-mono')}>{label(invitation)}</td>
                        <td className={td}>{invitation.role}</td>
                        {isKey && <td className={td}>{uses(invitation)}</td>}
                        <td className={cn(td, statusClass(invitation.status))}>{invitation.status}</td>
                        <td className={cn(td, 'whitespace-nowrap')}>{new Date(invitation.createdAt).toLocaleDateString(locale)}</td>
                        <td className={cn(td, 'whitespace-nowrap')}>{new Date(invitation.expiresAt).toLocaleString(locale)}</td>
                        <td className={cn(td, 'text-right')}>{actions(invitation)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )} />
          )}
        </DashboardCard>
      </div>
      <ConfirmDialog open={Boolean(revoking)} destructive busy={busy === revoking?.id} title={revoking?.kind === 'CODE' ? t('adm.keys.revokeTitle') : t('adm.inv.revokeTitle')} description={revoking?.kind === 'CODE' ? t('adm.keys.revokeBody') : t('adm.inv.revokeBody')} confirmLabel={t('access.inv.revoke')}
        onCancel={() => setRevoking(null)}
        onConfirm={() => { const target = revoking; if (target) void act(target.id, () => revokeInvitation(organizationId, target.id), t('access.inv.revoked')).then(() => { setRevoking(null); return invitations.reload(); }); }} />
      <ConfirmDialog open={Boolean(deleting)} destructive busy={busy === deleting?.id} title={t('access.inv.deleteTitle')} description={t('access.inv.deleteBody', { name: deleting ? label(deleting) : '' })} confirmLabel={t('access.inv.delete')}
        onCancel={() => setDeleting(null)}
        onConfirm={() => { const target = deleting; if (target) void act(target.id, () => deleteInvitation(organizationId, target.id), t('access.inv.deleted')).then(() => { setDeleting(null); return invitations.reload(); }); }} />
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

function GroupsScreen({ organizationId }: { organizationId: string }) {
  const { t } = useI18n();
  const { can } = usePermissions();
  const manage = can(PERM.groupsManage);
  const groups = useList(() => listGroups(organizationId), [organizationId]);
  const members = useList(() => listMembers(organizationId), [organizationId]);
  const { busy, error, ok, act } = useBusy();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const group: Group | undefined = groups.data?.find((item) => item.id === selected) ?? groups.data?.[0];
  const byId = new Map((members.data ?? []).map((member) => [member.userId, member]));
  const candidates = (members.data ?? []).filter((member) => !group?.memberUserIds.includes(member.userId));
  const [candidate, setCandidate] = useState('');

  const mutate = (key: string, work: () => Promise<unknown>, success?: string) => act(key, work, success).then(async (done) => { if (done) await groups.reload(); return done; });

  return (
    <Shell title={t('access.groups.title')} hint={t('access.groups.hint')}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <DashboardCard title={t('access.nav.groups')} description={manage ? undefined : t('access.readOnly')}>
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void mutate('create', async () => { await createGroup(organizationId, { name: name.trim() }); setName(''); }, t('access.groups.created')); }}>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t('access.groups.name')} minLength={2} maxLength={100} required disabled={!manage} />
            <Button type="submit" variant="accent" disabled={!manage} loading={busy === 'create'}>{t('access.groups.create')}</Button>
          </form>
          <Notice error={error ?? (groups.data ? groups.error : null)} ok={ok} />
          <LoadError list={groups} />
          {groups.loading && !groups.data ? <Loading /> : groups.data && groups.data.length === 0 ? <EmptyState icon={Users} title={t('access.groups.empty')} /> : (
            <ul className="space-y-1" role="listbox" aria-label={t('access.nav.groups')}>
              {groups.data?.map((item) => (
                <li key={item.id}><button type="button" role="option" aria-selected={item.id === group?.id} onClick={() => setSelected(item.id)} className={cn('np-press-flat flex w-full items-center justify-between rounded-md pointer-coarse:min-h-(--touch-min) px-2.5 py-2 text-left text-xs transition-colors duration-(--duration-fast)', item.id === group?.id ? 'bg-surface-active text-text' : 'text-text-secondary hover:bg-surface-hover')}>
                  <span className="truncate font-medium">{item.name}</span><span className="text-text-muted">{item.memberUserIds.length}</span></button></li>
              ))}
            </ul>
          )}
        </DashboardCard>

        {group && (
          <DashboardCard title={group.name} description={group.description ?? undefined} actions={<Button size="sm" variant="ghost" disabled={!manage || busy === group.id} onClick={() => setDeleting(true)}><Trash className="size-3.5" />{t('access.groups.delete')}</Button>}>
            <section className="space-y-2">
              <h3 className="ui-label">{t('access.groups.members')}</h3>
              <div className="flex flex-wrap gap-1.5">
                {group.memberUserIds.length === 0 && <span className="text-xs text-text-muted">{t('access.groups.noMembers')}</span>}
                {group.memberUserIds.map((userId) => (
                  <span key={userId} className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-surface-hover px-2 py-0.5 text-xs">
                    <span className="truncate">{byId.get(userId) ? memberLabel(byId.get(userId)!) : userId}</span>
                    <button type="button" aria-label={t('access.groups.removeMember')} disabled={!manage} className="text-text-muted hover:text-error disabled:opacity-40 pointer-coarse:grid pointer-coarse:size-(--touch-min) pointer-coarse:place-items-center" onClick={() => void mutate(userId, () => removeGroupMember(organizationId, group.id, userId))}>×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <select className={cn(selectClass, 'min-w-0 flex-1')} aria-label={t('access.groups.addMember')} value={candidate} disabled={!manage || candidates.length === 0} onChange={(event) => setCandidate(event.target.value)}>
                  <option value="">{t('access.groups.addMember')}</option>{candidates.map((member) => <option key={member.userId} value={member.userId}>{memberLabel(member)}</option>)}
                </select>
                <Button size="sm" variant="secondary" disabled={!manage || !candidate} onClick={() => void mutate('add', () => addGroupMember(organizationId, group.id, candidate), t('access.groups.memberAdded')).then(() => setCandidate(''))}>{t('access.groups.add')}</Button>
              </div>
            </section>
            <section className="space-y-2">
              <h3 className="ui-label">{t('access.nav.permissions')}</h3>
              <PermissionChecklist granted={group.permissions} disabled={!manage || busy !== null}
                onToggle={(permission, grant) => void mutate(permission, () => (grant ? grantGroupPermission : revokeGroupPermission)(organizationId, group.id, permission))} />
            </section>
            <ConfirmDialog open={deleting} destructive busy={busy === group.id} title={t('adm.groups.deleteTitle')} description={`${group.name} — ${t('adm.groups.deleteBody')}`} confirmLabel={t('access.groups.delete')}
              onCancel={() => setDeleting(false)}
              onConfirm={() => void mutate(group.id, () => deleteGroup(organizationId, group.id), t('access.groups.deleted')).then(() => setDeleting(false))} />
          </DashboardCard>
        )}
      </div>
    </Shell>
  );
}

function PermissionChecklist({ granted, disabled, onToggle, expiry }: { granted: RegisteredPermission[]; disabled: boolean; onToggle: (permission: RegisteredPermission, grant: boolean) => void; expiry?: Record<string, string | null> }) {
  const { t } = useI18n();
  const [advanced, setAdvanced] = useState(false);
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const matches = (permission: RegisteredPermission) => !needle || permission.includes(needle) || t(permissionLabelKey(permission) as never).toLowerCase().includes(needle);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label={t('perm.search')} placeholder={t('perm.search')} className={cn(selectClass, 'min-w-0 flex-1')} />
        <label className="flex items-center gap-1.5 text-xs text-text-secondary"><input type="checkbox" checked={advanced} onChange={() => setAdvanced((value) => !value)} />{t('perm.advanced')}</label>
      </div>
      {PERMISSION_GROUPS.map((group) => {
        const visible = group.permissions.filter(matches);
        if (visible.length === 0) return null;
        return (
          <fieldset key={group.id} className="space-y-1">
            <legend className="ui-label mb-1">{t(group.labelKey as never)}</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {visible.map((permission) => {
                const on = granted.includes(permission);
                return (
                  <label key={permission} title={t(permissionHintKey(permission) as never)} className="flex min-w-0 items-start gap-2 rounded-md px-2 py-1.5 text-xs text-text-secondary hover:bg-surface-hover pointer-coarse:min-h-(--touch-min)">
                    <input type="checkbox" className="mt-0.5" checked={on} disabled={disabled} onChange={() => onToggle(permission, !on)} />
                    <span className="min-w-0">
                      <span className="block font-medium text-text">{t(permissionLabelKey(permission) as never)}</span>
                      <span className="block text-[11px] leading-4 text-text-muted">{t(permissionHintKey(permission) as never)}</span>
                      {on ? <ExpiryNote expiresAt={expiry?.[permission]} /> : null}
                      {advanced ? <span className="mono-data block truncate text-[11px] text-text-muted">{permission}</span> : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

/** "View as this user": the server simulates the member's access; nothing here signs in as them or reads their data. */
function AccessSimulationCard({ organizationId, userId }: { organizationId: string; userId: string }) {
  const { t, locale } = useI18n();
  const [result, setResult] = useState<AccessSimulation | null>(null);
  const { busy, error, act } = useBusy();
  useEffect(() => { setResult(null); }, [userId]);
  const run = () => void act('sim', async () => { setResult(await getAccessSimulation(organizationId, userId)); });
  const label = (names: Record<string, string>, fallback: string) => names[locale] ?? names.es ?? names.en ?? Object.values(names)[0] ?? fallback;
  const origin = (entry: AccessSimulation['permissions'][number]['origins'][number]) => t(`sim.origin.${entry.type}` as never, { name: entry.name ?? '' });
  return (
    <DashboardCard title={t('sim.title')} description={t('sim.hint')}>
      {!userId ? <p className="text-xs text-text-muted">{t('sim.pick')}</p> : (
        <div className="space-y-3">
          <Button size="sm" variant="secondary" loading={busy === 'sim'} onClick={run}>{t('sim.run')}</Button>
          <Notice error={error} ok={null} />
          {result ? (
            <div className="space-y-4" aria-live="polite">
              <p className="text-xs text-text-secondary"><span className="font-medium text-text">{result.user.name ?? result.user.email}</span> · {t('sim.role')}: {result.role} · {t('sim.groups')}: {result.groups.length ? result.groups.map((group) => group.name).join(', ') : t('sim.none')}</p>
              {result.notes.platformPrivileges ? <p className="text-[11px] text-warning">{result.notes.platformPrivileges}</p> : null}
              <section><h4 className="ui-label mb-1">{t('sim.permissions')}</h4>
                <ul className="space-y-1">{result.permissions.map((entry) => (
                  <li key={entry.permission} className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs"><span className="text-text">{t(permissionLabelKey(entry.permission) as never)}</span><span className="text-text-muted">{entry.origins.map(origin).join(' · ')}</span></li>
                ))}</ul>
              </section>
              <section><h4 className="ui-label mb-1">{t('sim.datasets')}</h4>
                {result.data.datasets.length === 0 ? <p className="text-xs text-text-muted">{t('sim.noDatasets')}</p> : <ul className="space-y-1">{result.data.datasets.map((dataset) => (
                  <li key={dataset.id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs"><span className="text-text">{label(dataset.name, dataset.slug)}</span><span className={dataset.canQuery ? 'text-success' : 'text-text-muted'}>{dataset.canQuery ? t('sim.ok') : t('sim.no')} · {t(`sim.reason.${dataset.reason}` as never)}</span></li>
                ))}</ul>}
                {result.data.truncated ? <p className="text-[11px] text-text-muted">{t('sim.truncated')}</p> : null}
              </section>
              <section><h4 className="ui-label mb-1">{t('sim.views')}</h4>
                {result.views.panels.length === 0 ? <p className="text-xs text-text-muted">{t('sim.noViews')}</p> : <ul className="space-y-1">{result.views.panels.map((panel) => (
                  <li key={panel.id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs"><span className="text-text">{label(panel.name, panel.slug)}</span><span className={panel.visible ? 'text-success' : 'text-text-muted'}>{panel.visible ? t('sim.ok') : t('sim.no')} · {t(`sim.reason.${panel.reason}` as never)}</span></li>
                ))}</ul>}
                {result.views.truncated ? <p className="text-[11px] text-text-muted">{t('sim.truncated')}</p> : null}
              </section>
            </div>
          ) : null}
        </div>
      )}
    </DashboardCard>
  );
}

/** Defaults for new accounts (role, groups) and import-history retention; saved in one audited call. */
function PolicyCard({ organizationId, manage }: { organizationId: string; manage: boolean }) {
  const { t } = useI18n();
  const policy = useList(() => getOrganizationPolicy(organizationId), [organizationId]);
  const groups = useList(() => listGroups(organizationId), [organizationId]);
  const { busy, error, ok, act } = useBusy();
  const [draft, setDraft] = useState<{ role: 'VIEWER' | 'MEMBER' | 'BILLING_ADMIN'; groupIds: string[]; days: string } | null>(null);
  const current = draft ?? (policy.data ? { role: policy.data.defaultMemberRole, groupIds: policy.data.defaultGroupIds, days: policy.data.importRetentionDays === null ? '' : String(policy.data.importRetentionDays) } : null);
  const days = current?.days.trim() === '' ? null : Number(current?.days);
  const daysValid = days === null || (Number.isInteger(days) && days >= 1 && days <= 3650);
  const toggle = (id: string) => current && setDraft({ ...current, groupIds: current.groupIds.includes(id) ? current.groupIds.filter((value) => value !== id) : [...current.groupIds, id] });
  const save = () => current && void act('policy', async () => { await saveOrganizationPolicy(organizationId, { defaultMemberRole: current.role, defaultGroupIds: current.groupIds, importRetentionDays: days }); setDraft(null); await policy.reload(); }, t('pol.saved'));
  return (
    <DashboardCard title={t('pol.title')} description={manage ? t('pol.hint') : t('access.readOnly')}>
      {!current ? <Loading /> : (
        <div className="space-y-3">
          <label className="block text-xs text-text-secondary">{t('pol.role')}
            <select className={cn(selectClass, 'mt-1 w-full')} value={current.role} disabled={!manage} onChange={(event) => setDraft({ ...current, role: event.target.value as typeof current.role })}>
              {(['VIEWER', 'MEMBER', 'BILLING_ADMIN'] as const).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <fieldset className="space-y-1"><legend className="ui-label mb-1">{t('pol.groups')}</legend>
            {(groups.data ?? []).length === 0 ? <p className="text-xs text-text-muted">{t('pol.noGroups')}</p> : (groups.data ?? []).map((group) => (
              <label key={group.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-surface-hover pointer-coarse:min-h-(--touch-min)">
                <input type="checkbox" checked={current.groupIds.includes(group.id)} disabled={!manage} onChange={() => toggle(group.id)} /><span className="truncate">{group.name}</span>
              </label>
            ))}
          </fieldset>
          <label className="block text-xs text-text-secondary">{t('pol.retention')}
            <input type="number" min={1} max={3650} className={cn(selectClass, 'mt-1 w-32')} value={current.days} disabled={!manage} aria-invalid={!daysValid} onChange={(event) => setDraft({ ...current, days: event.target.value })} />
            <span className="mt-1 block text-[11px] text-text-muted">{t('pol.retentionHint')}</span>
          </label>
          <Notice error={error ?? policy.error ?? groups.error} ok={ok} />
          <Button size="sm" disabled={!manage || !daysValid || busy !== null || draft === null} loading={busy === 'policy'} onClick={save}>{t('pol.save')}</Button>
          <p className="text-[11px] text-text-muted">{t('pol.note')}</p>
        </div>
      )}
    </DashboardCard>
  );
}

/** Lets a role render the dashboards backed by chosen datasets (north.data.query + dataset ACL) in one audited step. */
function RoleDataAccessCard({ organizationId, manage }: { organizationId: string; manage: boolean }) {
  const { t, locale } = useI18n();
  const datasets = useList(() => listDatasets(organizationId), [organizationId]);
  const [role, setRole] = useState<'VIEWER' | 'MEMBER' | 'BILLING_ADMIN'>('VIEWER');
  const [chosen, setChosen] = useState<string[]>([]);
  const { busy, error, ok, act } = useBusy();
  const rows = (datasets.data ?? []).filter((dataset) => dataset.status === 'ACTIVE');
  const toggle = (id: string) => setChosen((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  const apply = () => void act('rda', async () => { await grantRoleDataAccess(organizationId, { role, datasetIds: chosen }); }, t('rda.done', { n: chosen.length }));
  return (
    <DashboardCard title={t('rda.title')} description={manage ? t('rda.hint') : t('access.readOnly')}>
      <div className="space-y-3">
        <label className="block text-xs text-text-secondary">{t('rda.role')}
          <select className={cn(selectClass, 'mt-1 w-full')} value={role} disabled={!manage} onChange={(event) => setRole(event.target.value as typeof role)}>
            {(['VIEWER', 'MEMBER', 'BILLING_ADMIN'] as const).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <fieldset className="space-y-1"><legend className="ui-label mb-1">{t('rda.datasets')}</legend>
          {datasets.loading && !datasets.data ? <Loading /> : rows.length === 0 ? <p className="text-xs text-text-muted">{t('rda.none')}</p> : rows.map((dataset) => (
            <label key={dataset.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-surface-hover pointer-coarse:min-h-(--touch-min)">
              <input type="checkbox" checked={chosen.includes(dataset.id)} disabled={!manage} onChange={() => toggle(dataset.id)} />
              <span className="truncate">{dataset.name[locale] ?? dataset.name.es ?? dataset.name.en ?? dataset.slug}</span>
            </label>
          ))}
        </fieldset>
        <Notice error={error ?? datasets.error} ok={ok} />
        <Button size="sm" disabled={!manage || chosen.length === 0 || busy !== null} loading={busy === 'rda'} onClick={apply}>{t('rda.apply')}</Button>
        <p className="text-[11px] text-text-muted">{t('rda.note')}</p>
      </div>
    </DashboardCard>
  );
}

// ---------------------------------------------------------------------------
// Effective permissions and direct member grants
// ---------------------------------------------------------------------------

function PermissionsScreen({ organizationId }: { organizationId: string }) {
  const { t } = useI18n();
  const { can, permissions } = usePermissions();
  const manage = can(PERM.permissionsManage);
  const members = useList(() => listMembers(organizationId), [organizationId]);
  const [userId, setUserId] = useState('');
  const grants = useList(() => (userId ? listMemberGrants(organizationId, userId) : Promise.resolve([] as RegisteredPermission[])), [organizationId, userId]);
  const details = useList(() => (userId && manage ? listMemberGrantDetails(organizationId, userId) : Promise.resolve([])), [organizationId, userId, manage]);
  const [grantDays, setGrantDays] = useState('');
  const grantDaysValid = grantDays.trim() === '' || (Number.isInteger(Number(grantDays)) && Number(grantDays) >= 1 && Number(grantDays) <= 365);
  const expiry = Object.fromEntries((details.data ?? []).map((entry) => [entry.permission, entry.expiresAt]));
  const { busy, error, ok, act } = useBusy();

  return (
    <Shell title={t('access.perm.title')} hint={t('access.perm.hint')}>
      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardCard title={t('access.perm.mine')} description={t('access.perm.mineHint')}>
          {permissions.length === 0 ? <EmptyState icon={ShieldCheck} title={t('access.perm.none')} /> : <ul className="flex flex-wrap gap-1.5">{permissions.map((permission) => <li key={permission} title={permission} className="rounded-md border border-border bg-surface-hover px-2 py-0.5 text-xs">{t(permissionLabelKey(permission) as never)}</li>)}</ul>}
        </DashboardCard>
        <DashboardCard title={t('access.perm.direct')} description={manage ? t('access.perm.directHint') : t('access.readOnly')}>
          <select className={cn(selectClass, 'w-full')} aria-label={t('access.col.user')} value={userId} onChange={(event) => setUserId(event.target.value)}>
            <option value="">{t('access.perm.pick')}</option>{(members.data ?? []).map((member) => <option key={member.userId} value={member.userId}>{memberLabel(member)} · {member.role}</option>)}
          </select>
          <Notice error={error ?? members.error ?? grants.error} ok={ok} />
          {userId && (grants.loading && !grants.data ? <Loading /> : (
            <>
              {manage ? <ApplyTemplateRow organizationId={organizationId} userId={userId} onApplied={() => { void grants.reload(); void details.reload(); }} /> : null}
              {manage ? <label className="mb-2 block text-xs text-text-secondary">{t('ar.grantDays')}<Input className="mt-1 w-28" type="number" min={1} max={365} value={grantDays} aria-invalid={!grantDaysValid} onChange={(event) => setGrantDays(event.target.value)} /></label> : null}
              <PermissionChecklist granted={grants.data ?? []} expiry={expiry} disabled={!manage || busy !== null || (!grantDaysValid)}
                onToggle={(permission, grant) => void act(permission, () => (grant ? grantMemberPermission(organizationId, userId, permission, grantDays.trim() ? Number(grantDays) : undefined) : revokeMemberPermission(organizationId, userId, permission))).then(async (done) => { if (done) { await grants.reload(); await details.reload(); } })} />
            </>
          ))}
          <p className="flex items-center gap-1.5 text-[11px] text-text-muted"><Key className="size-3" />{t('access.perm.note')}</p>
        </DashboardCard>
        <AccessTemplatesCard organizationId={organizationId} manage={manage} />
        <RequestAccessCard organizationId={organizationId} onChanged={() => void grants.reload()} />
        {manage ? <AccessRequestQueueCard organizationId={organizationId} onChanged={() => { void grants.reload(); void details.reload(); }} /> : null}
        <RoleDataAccessCard organizationId={organizationId} manage={manage} />
        <AccessSimulationCard organizationId={organizationId} userId={userId} />
        <PolicyCard organizationId={organizationId} manage={manage} />
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------

export function AccessAdminView({ section, organizationId, currentUserId }: { section: AccessSection; organizationId: string; currentUserId: string }) {
  // Remount per organization so no list or draft survives a tenant switch.
  const key = `${organizationId}:${section}`;
  if (section === 'settings') return <SettingsScreen key={key} organizationId={organizationId} />;
  if (section === 'users') return <UsersScreen key={key} organizationId={organizationId} currentUserId={currentUserId} />;
  if (section === 'invitations') return <InvitationsScreen key={key} organizationId={organizationId} />;
  if (section === 'groups') return <GroupsScreen key={key} organizationId={organizationId} />;
  if (section === 'audit') return <AuditScreen key={key} organizationId={organizationId} />;
  return <PermissionsScreen key={key} organizationId={organizationId} />;
}
