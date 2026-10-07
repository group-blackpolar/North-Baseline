import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowsClockwise, EnvelopeSimple, Key, ShieldCheck, Trash, Users, WarningCircle } from '@phosphor-icons/react';
import { DashboardCard } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { ResponsiveList } from '@/components/ui/responsive-list';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { ErrorState } from '@/components/ui/error-state';
import { DelayedSkeleton, SkeletonAdminCard, SkeletonTable } from '@/components/ui/skeleton';
import { useShellMode } from '@/lib/responsive';
import { usePermissions } from '@/context/PermissionContext';
import { ApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { PERM } from '@/lib/permission';
import { cn } from '@/lib/utils';
import {
  INVITABLE_ROLES, REGISTERED_PERMISSIONS, TENANT_ROLES, addGroupMember, changeMemberRole, createGroup, createInvitation, deleteGroup,
  grantGroupPermission, grantMemberPermission, listGroups, listInvitations, listMemberGrants, listMembers, removeGroupMember, removeMember,
  replaceInvitation, revokeGroupPermission, revokeInvitation, revokeMemberPermission,
  type Group, type Invitation, type IssuedInvitation, type Member, type RegisteredPermission, type TenantRole,
} from './api';

export type AccessSection = 'users' | 'invitations' | 'groups' | 'permissions';
export const ACCESS_SECTIONS: AccessSection[] = ['users', 'invitations', 'groups', 'permissions'];

/** Loads a list once per organization and exposes explicit reload. Failures keep the real CORECROW message. */
function useList<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);
  const reload = useCallback(async () => {
    try { setState({ data: await run(), error: null, loading: false }); }
    catch (error) { setState((current) => ({ ...current, loading: false, error: errorText(error) })); }
  }, [run]);
  useEffect(() => { setState({ data: null, error: null, loading: true }); void reload(); }, [reload]);
  return { ...state, reload };
}

function errorText(error: unknown) {
  if (error instanceof ApiError) return `${error.message}${error.requestId ? ` (${error.requestId})` : ''}`;
  return error instanceof Error ? error.message : 'Request failed';
}

function Notice({ error, ok }: { error?: string | null; ok?: string | null }) {
  if (error) return <p role="alert" className="flex items-start gap-1.5 text-xs text-error"><WarningCircle className="mt-px size-3.5 shrink-0" />{error}</p>;
  if (ok) return <p role="status" className="text-xs text-success">{ok}</p>;
  return null;
}

function Shell({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="north-enter mx-auto w-full max-w-[1680px] space-y-4 p-4 lg:p-5">
      <header><h1 className="font-display text-xl font-semibold text-text">{title}</h1><p className="mt-0.5 text-xs text-text-secondary">{hint}</p></header>
      {children}
    </div>
  );
}

/** Delayed, real-shape placeholder: cards on phone, table rows elsewhere; empty box of similar height during the delay. */
function Loading() {
  const phone = useShellMode() === 'phone';
  return <DelayedSkeleton loading minHeight={200} fallback={phone ? <div className="space-y-2">{[0, 1, 2].map((i) => <SkeletonAdminCard key={i} lines={2} />)}</div> : <SkeletonTable rows={4} columns={4} />} />;
}

/** A list that failed to load and has nothing to show: block with Retry. (With data still on screen the Notice above is enough.) */
function LoadError({ list }: { list: { error: string | null; data: unknown; loading: boolean; reload: () => unknown } }) {
  return list.error && !list.data && !list.loading ? <ErrorState message={list.error} onRetry={() => void list.reload()} /> : null;
}

const selectClass = 'h-8 pointer-coarse:h-(--touch-min) rounded-md border border-border bg-surface px-2 text-base md:text-xs text-text outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 disabled:opacity-50';
const th = 'border-b border-border px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-text-muted';
const td = 'border-b border-border/60 px-3 py-2 text-xs text-text';
const memberLabel = (member: Member) => member.name?.trim() || member.email || member.userId;

function useBusy() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const act = async (key: string, work: () => Promise<unknown>, success?: string) => {
    setBusy(key); setError(null); setOk(null);
    try { await work(); if (success) setOk(success); return true; }
    catch (reason) { setError(errorText(reason)); return false; }
    finally { setBusy(null); }
  };
  return { busy, error, ok, act, setError };
}

// ---------------------------------------------------------------------------
// Users and roles
// ---------------------------------------------------------------------------

function UsersScreen({ organizationId, currentUserId }: { organizationId: string; currentUserId: string }) {
  const { t } = useI18n();
  const { can } = usePermissions();
  const manage = can(PERM.membersManage);
  const members = useList(() => listMembers(organizationId), [organizationId]);
  const { busy, error, ok, act } = useBusy();
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const roleSelect = (member: Member) => (
    <select aria-label={t('access.col.role')} className={selectClass} value={member.role} disabled={!manage || busy === member.userId}
      onChange={(event) => void act(member.userId, () => changeMemberRole(organizationId, member.userId, event.target.value as TenantRole), t('access.users.roleChanged')).then(() => members.reload())}>
      {TENANT_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
    </select>
  );
  const removeControl = (member: Member) => confirmRemove === member.userId ? (
    <span className="inline-flex gap-1">
      <Button size="sm" variant="destructive" disabled={busy === member.userId} onClick={() => void act(member.userId, () => removeMember(organizationId, member.userId), t('access.users.removed')).then(() => { setConfirmRemove(null); return members.reload(); })}>{t('access.confirm')}</Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(null)}>{t('access.cancel')}</Button>
    </span>
  ) : <Button size="icon-sm" variant="ghost" aria-label={t('access.users.remove')} title={t('access.users.remove')} disabled={!manage} onClick={() => setConfirmRemove(member.userId)}><Trash className="size-3.5" /></Button>;
  const you = (member: Member) => member.userId === currentUserId && <span className="ml-1.5 text-text-muted">({t('access.you')})</span>;

  return (
    <Shell title={t('access.users.title')} hint={t('access.users.hint')}>
      <DashboardCard title={t('access.users.members')} description={manage ? undefined : t('access.readOnly')} actions={<Button size="sm" variant="ghost" onClick={() => void members.reload()}><ArrowsClockwise className="size-3.5" />{t('access.refresh')}</Button>}>
        <Notice error={error ?? (members.data ? members.error : null)} ok={ok} />
        <LoadError list={members} />
        {members.loading && !members.data ? <Loading /> : members.data && members.data.length === 0 ? <EmptyState icon={Users} title={t('access.users.empty')} /> : members.data && (
          <ResponsiveList items={members.data} getKey={(member) => member.id}
            renderCard={(member, index) => (
              <div className="np-card np-stagger space-y-2 p-3" style={{ '--i': index } as React.CSSProperties}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-text">{memberLabel(member)}{you(member)}</p><p className="truncate text-xs text-text-secondary">{member.email ?? '—'}</p></div>
                  <span className="text-xs text-text-muted">{member.status ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">{roleSelect(member)}{removeControl(member)}</div>
              </div>
            )}
            table={(
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead><tr><th className={th}>{t('access.col.user')}</th><th className={th}>{t('access.col.email')}</th><th className={th}>{t('access.col.status')}</th><th className={th}>{t('access.col.role')}</th><th className={th} /></tr></thead>
                  <tbody>
                    {members.data.map((member) => (
                      <tr key={member.id} className="hover:bg-surface-hover/50">
                        <td className={td}>{memberLabel(member)}{you(member)}</td>
                        <td className={td}>{member.email ?? '—'}</td>
                        <td className={td}>{member.status ?? '—'}</td>
                        <td className={td}>{roleSelect(member)}</td>
                        <td className={cn(td, 'text-right')}>{removeControl(member)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )} />
        )}
        <p className="text-[11px] text-text-muted">{t('access.users.rolesNote')}</p>
      </DashboardCard>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

function InvitationsScreen({ organizationId }: { organizationId: string }) {
  const { t } = useI18n();
  const { can } = usePermissions();
  const manage = can(PERM.invitationsManage);
  const invitations = useList(() => listInvitations(organizationId), [organizationId]);
  const groups = useList(() => listGroups(organizationId), [organizationId]);
  const { busy, error, ok, act } = useBusy();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<(typeof INVITABLE_ROLES)[number]>('VIEWER');
  const [hours, setHours] = useState(72);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [issued, setIssued] = useState<IssuedInvitation | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const done = await act('create', async () => { setIssued(await createInvitation(organizationId, { email: email.trim(), role, expiresInHours: hours, groupIds, permissions: [] })); }, t('access.inv.created'));
    if (done) { setEmail(''); setGroupIds([]); await invitations.reload(); }
  };
  const invitationActions = (invitation: Invitation) => (
    <>
      <Button size="sm" variant="ghost" disabled={!manage || busy === invitation.id} onClick={() => void act(invitation.id, async () => { setIssued(await replaceInvitation(organizationId, invitation.id)); }, t('access.inv.replaced')).then(() => invitations.reload())}>{t('access.inv.replace')}</Button>
      <Button size="sm" variant="ghost" disabled={!manage || busy === invitation.id} onClick={() => void act(invitation.id, () => revokeInvitation(organizationId, invitation.id), t('access.inv.revoked')).then(() => invitations.reload())}>{t('access.inv.revoke')}</Button>
    </>
  );
  const statusClass = (status: Invitation['status']) => status === 'PENDING' ? 'text-accent' : status === 'ACCEPTED' ? 'text-success' : 'text-text-muted';

  return (
    <Shell title={t('access.inv.title')} hint={t('access.inv.hint')}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <DashboardCard title={t('access.inv.new')} description={manage ? t('access.inv.verifiedNote') : t('access.readOnly')}>
          <form onSubmit={(event) => void submit(event)} className="space-y-3">
            <label className="block space-y-1"><span className="ui-label">{t('access.col.email')}</span><Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={!manage} autoComplete="off" /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1"><span className="ui-label">{t('access.col.role')}</span><select className={cn(selectClass, 'w-full')} value={role} disabled={!manage} onChange={(event) => setRole(event.target.value as typeof role)}>{INVITABLE_ROLES.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="block space-y-1"><span className="ui-label">{t('access.inv.expires')}</span><Input type="number" min={1} max={720} value={hours} disabled={!manage} onChange={(event) => setHours(Math.min(720, Math.max(1, Number(event.target.value) || 1)))} /></label>
            </div>
            {groups.data && groups.data.length > 0 && (
              <fieldset className="space-y-1"><legend className="ui-label">{t('access.nav.groups')}</legend>
                <div className="flex flex-wrap gap-2">{groups.data.map((group) => (
                  <label key={group.id} className="flex items-center gap-1.5 text-xs text-text-secondary pointer-coarse:min-h-(--touch-min)"><input type="checkbox" disabled={!manage} checked={groupIds.includes(group.id)} onChange={(event) => setGroupIds((current) => event.target.checked ? [...current, group.id] : current.filter((id) => id !== group.id))} />{group.name}</label>
                ))}</div>
              </fieldset>
            )}
            <Button type="submit" variant="accent" disabled={!manage || busy === 'create'}><EnvelopeSimple className="size-4" />{t('access.inv.send')}</Button>
            <Notice error={error} ok={ok} />
            {issued && <p role="status" className="text-xs text-text-secondary">{issued.delivery === 'sent' ? t('access.inv.sent') : t('access.inv.notSent')}</p>}
          </form>
        </DashboardCard>

        <DashboardCard title={t('access.inv.list')} actions={<Button size="sm" variant="ghost" onClick={() => void invitations.reload()}><ArrowsClockwise className="size-3.5" />{t('access.refresh')}</Button>}>
          {invitations.error && invitations.data && <Notice error={invitations.error} />}
          <LoadError list={invitations} />
          {invitations.loading && !invitations.data ? <Loading /> : invitations.data && invitations.data.length === 0 ? <EmptyState icon={EnvelopeSimple} title={t('access.inv.empty')} /> : invitations.data && (
            <ResponsiveList items={invitations.data} getKey={(invitation) => invitation.id}
              renderCard={(invitation, index) => (
                <div className="np-card np-stagger space-y-2 p-3" style={{ '--i': index } as React.CSSProperties}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium text-text">{invitation.email ?? t('access.inv.code')}</p>
                    <span className={cn('text-xs', statusClass(invitation.status))}>{invitation.status}</span>
                  </div>
                  <p className="text-xs text-text-secondary">{invitation.role} · {t('access.inv.expires')}: {new Date(invitation.expiresAt).toLocaleString()}</p>
                  {invitation.status === 'PENDING' && <div className="flex gap-1">{invitationActions(invitation)}</div>}
                </div>
              )}
              table={(
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead><tr><th className={th}>{t('access.col.email')}</th><th className={th}>{t('access.col.role')}</th><th className={th}>{t('access.col.status')}</th><th className={th}>{t('access.inv.expires')}</th><th className={th} /></tr></thead>
                    <tbody>{invitations.data.map((invitation) => (
                      <tr key={invitation.id} className="hover:bg-surface-hover/50">
                        <td className={td}>{invitation.email ?? t('access.inv.code')}</td>
                        <td className={td}>{invitation.role}</td>
                        <td className={cn(td, statusClass(invitation.status))}>{invitation.status}</td>
                        <td className={td}>{new Date(invitation.expiresAt).toLocaleString()}</td>
                        <td className={cn(td, 'text-right')}>{invitation.status === 'PENDING' && <span className="inline-flex gap-1">{invitationActions(invitation)}</span>}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )} />
          )}
        </DashboardCard>
      </div>
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
  const group: Group | undefined = groups.data?.find((item) => item.id === selected) ?? groups.data?.[0];
  const byId = new Map((members.data ?? []).map((member) => [member.userId, member]));
  const candidates = (members.data ?? []).filter((member) => !group?.memberUserIds.includes(member.userId));
  const [candidate, setCandidate] = useState('');

  const mutate = (key: string, work: () => Promise<unknown>, success?: string) => act(key, work, success).then(async (done) => { if (done) await groups.reload(); });

  return (
    <Shell title={t('access.groups.title')} hint={t('access.groups.hint')}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <DashboardCard title={t('access.nav.groups')} description={manage ? undefined : t('access.readOnly')}>
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void mutate('create', async () => { await createGroup(organizationId, { name: name.trim() }); setName(''); }, t('access.groups.created')); }}>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t('access.groups.name')} minLength={2} maxLength={100} required disabled={!manage} />
            <Button type="submit" variant="accent" disabled={!manage || busy === 'create'}>{t('access.groups.create')}</Button>
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
          <DashboardCard title={group.name} description={group.description ?? undefined} actions={<Button size="sm" variant="ghost" disabled={!manage || busy === group.id} onClick={() => { if (window.confirm(t('access.groups.confirmDelete'))) void mutate(group.id, () => deleteGroup(organizationId, group.id), t('access.groups.deleted')); }}><Trash className="size-3.5" />{t('access.groups.delete')}</Button>}>
            <section className="space-y-2">
              <h3 className="ui-label">{t('access.groups.members')}</h3>
              <div className="flex flex-wrap gap-1.5">
                {group.memberUserIds.length === 0 && <span className="text-xs text-text-muted">{t('access.groups.noMembers')}</span>}
                {group.memberUserIds.map((userId) => (
                  <span key={userId} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-hover px-2 py-0.5 text-xs">
                    {byId.get(userId) ? memberLabel(byId.get(userId)!) : userId}
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
          </DashboardCard>
        )}
      </div>
    </Shell>
  );
}

function PermissionChecklist({ granted, disabled, onToggle }: { granted: RegisteredPermission[]; disabled: boolean; onToggle: (permission: RegisteredPermission, grant: boolean) => void }) {
  return (
    <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
      {REGISTERED_PERMISSIONS.map((permission) => {
        const on = granted.includes(permission);
        return <label key={permission} className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-surface-hover pointer-coarse:min-h-(--touch-min)"><input type="checkbox" checked={on} disabled={disabled} onChange={() => onToggle(permission, !on)} /><span className="mono-data">{permission}</span></label>;
      })}
    </div>
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
  const { busy, error, ok, act } = useBusy();

  return (
    <Shell title={t('access.perm.title')} hint={t('access.perm.hint')}>
      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardCard title={t('access.perm.mine')} description={t('access.perm.mineHint')}>
          {permissions.length === 0 ? <EmptyState icon={ShieldCheck} title={t('access.perm.none')} /> : <ul className="flex flex-wrap gap-1.5">{permissions.map((permission) => <li key={permission} className="mono-data rounded-md border border-border bg-surface-hover px-2 py-0.5">{permission}</li>)}</ul>}
        </DashboardCard>
        <DashboardCard title={t('access.perm.direct')} description={manage ? t('access.perm.directHint') : t('access.readOnly')}>
          <select className={cn(selectClass, 'w-full')} aria-label={t('access.col.user')} value={userId} onChange={(event) => setUserId(event.target.value)}>
            <option value="">{t('access.perm.pick')}</option>{(members.data ?? []).map((member) => <option key={member.userId} value={member.userId}>{memberLabel(member)} · {member.role}</option>)}
          </select>
          <Notice error={error ?? members.error ?? grants.error} ok={ok} />
          {userId && (grants.loading && !grants.data ? <Loading /> : (
            <PermissionChecklist granted={grants.data ?? []} disabled={!manage || busy !== null}
              onToggle={(permission, grant) => void act(permission, () => (grant ? grantMemberPermission : revokeMemberPermission)(organizationId, userId, permission)).then(async (done) => { if (done) await grants.reload(); })} />
          ))}
          <p className="flex items-center gap-1.5 text-[11px] text-text-muted"><Key className="size-3" />{t('access.perm.note')}</p>
        </DashboardCard>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------

export function AccessAdminView({ section, organizationId, currentUserId }: { section: AccessSection; organizationId: string; currentUserId: string }) {
  // Remount per organization so no list or draft survives a tenant switch.
  const key = `${organizationId}:${section}`;
  if (section === 'users') return <UsersScreen key={key} organizationId={organizationId} currentUserId={currentUserId} />;
  if (section === 'invitations') return <InvitationsScreen key={key} organizationId={organizationId} />;
  if (section === 'groups') return <GroupsScreen key={key} organizationId={organizationId} />;
  return <PermissionsScreen key={key} organizationId={organizationId} />;
}
