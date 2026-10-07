import { useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useNotifications } from '@/context/NotificationContext';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { INVITABLE_ROLES, addMember, createInvitation, lookupUser, type Group, type UserLookup } from './api';
import { errorText, selectClass } from './ui';

/** Email -> CORECROW decides: existing verified account is added directly, unknown email goes through an invitation. */
export function AddUserDialog({ open, organizationId, groups, canAssignGroups, onClose, onDone }: {
  open: boolean;
  organizationId: string;
  groups: Group[];
  canAssignGroups: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const { push } = useNotifications();
  const [email, setEmail] = useState('');
  const [lookup, setLookup] = useState<UserLookup | null>(null);
  const [role, setRole] = useState<(typeof INVITABLE_ROLES)[number]>('VIEWER');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setEmail(''); setLookup(null); setRole('VIEWER'); setGroupIds([]); setError(null); };
  const close = () => { reset(); onClose(); };
  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await work(); } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); }
  };

  const search = () => run(async () => setLookup(await lookupUser(organizationId, email.trim())));
  const add = () => run(async () => {
    await addMember(organizationId, { email: email.trim(), role, groupIds });
    push({ type: 'success', title: t('adm.users.added'), body: email.trim() });
    onDone(); close();
  });
  const invite = () => run(async () => {
    await createInvitation(organizationId, { email: email.trim(), role, expiresInHours: 72, groupIds, permissions: [] });
    push({ type: 'success', title: t('access.inv.created'), body: email.trim() });
    onDone(); close();
  });

  const canAct = lookup && !lookup.alreadyMember;
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }} title={t('adm.users.addTitle')} description={t('adm.users.addHint')}
      footer={canAct ? (lookup.exists
        ? <Button variant="accent" loading={busy} onClick={() => void add()}>{t('adm.users.addAction')}</Button>
        : <Button variant="accent" loading={busy} onClick={() => void invite()}>{t('adm.users.inviteInstead')}</Button>) : undefined}>
      <div className="space-y-3">
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); if (email.trim()) void search(); }}>
          <Input type="email" required autoComplete="off" value={email} onChange={(event) => { setEmail(event.target.value); setLookup(null); }} placeholder="name@company.com" />
          <Button type="submit" variant="secondary" loading={busy && !lookup} disabled={!email.trim()}><MagnifyingGlass className="size-4" />{t('adm.users.lookup')}</Button>
        </form>
        {lookup?.alreadyMember && <p className="text-xs text-text-secondary">{t('adm.users.alreadyMember')}</p>}
        {lookup && !lookup.exists && <p className="text-xs text-text-secondary">{t('adm.users.notFound')}</p>}
        {lookup?.exists && lookup.user && !lookup.alreadyMember && (
          <div className="rounded-lg border border-border bg-surface-hover p-2.5">
            <p className="ui-label">{t('adm.users.found')}</p>
            <p className="mt-1 truncate text-sm font-medium text-text">{lookup.user.name ?? lookup.user.email}</p>
            <p className="truncate text-xs text-text-secondary">{lookup.user.email}</p>
          </div>
        )}
        {canAct && (
          <>
            <label className="block space-y-1"><span className="ui-label">{t('access.col.role')}</span>
              <select className={cn(selectClass, 'w-full')} value={role} onChange={(event) => setRole(event.target.value as typeof role)}>{INVITABLE_ROLES.map((item) => <option key={item}>{item}</option>)}</select>
            </label>
            {canAssignGroups && groups.length > 0 && (
              <fieldset className="space-y-1"><legend className="ui-label">{t('access.nav.groups')}</legend>
                <div className="flex flex-wrap gap-2">{groups.map((group) => (
                  <label key={group.id} className="flex items-center gap-1.5 text-xs text-text-secondary"><input type="checkbox" checked={groupIds.includes(group.id)} onChange={(event) => setGroupIds((current) => event.target.checked ? [...current, group.id] : current.filter((id) => id !== group.id))} />{group.name}</label>
                ))}</div>
              </fieldset>
            )}
          </>
        )}
        {error && <p role="alert" className="text-xs text-error">{error}</p>}
      </div>
    </Dialog>
  );
}
