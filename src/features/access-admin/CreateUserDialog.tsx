import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Plus } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useOrganization } from '@/context/OrganizationContext';
import { useNotifications } from '@/context/NotificationContext';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { INVITABLE_ROLES, createMemberAccount, listAccessTemplates, type AccessTemplate, type Group } from './api';
import { errorText, selectClass } from './ui';
import { generatePassword, previewAddress } from './credentials';

/**
 * An organization administrator creates a member account: name, an address `name@<org>.bp` assigned automatically and a password
 * they type or generate with "+" (`ORG-PASS-xxxxxxxxxx`). The credentials are shown once, right after creation, to hand over.
 */
export function CreateUserDialog({ open, organizationId, groups, canAssignGroups, onClose, onDone }: {
  open: boolean; organizationId: string; groups: Group[]; canAssignGroups: boolean; onClose: () => void; onDone: () => void;
}) {
  const { t } = useI18n();
  const { push } = useNotifications();
  const { activeOrganization } = useOrganization();
  const slug = activeOrganization?.slug ?? 'org';
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<(typeof INVITABLE_ROLES)[number]>('MEMBER');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [templates, setTemplates] = useState<AccessTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [primaryGroupId, setPrimaryGroupId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const template = templates.find((item) => item.id === templateId) ?? null;
  const primaryGroup = groups.find((group) => group.id === primaryGroupId && groupIds.includes(group.id));
  const address = useMemo(() => previewAddress(name, slug, primaryGroup?.name), [name, slug, primaryGroup?.name]);

  // Templates are optional: an account can still be set up by hand, and a failed load must not block the dialog.
  useEffect(() => {
    if (!open) return;
    let live = true;
    listAccessTemplates(organizationId).then((value) => { if (live) setTemplates(value); }).catch(() => { if (live) setTemplates([]); });
    return () => { live = false; };
  }, [open, organizationId]);
  const pickTemplate = (id: string) => {
    setTemplateId(id);
    const next = templates.find((item) => item.id === id);
    if (next) { setRole(next.role === 'ADMIN' || next.role === 'BILLING_ADMIN' || next.role === 'MEMBER' || next.role === 'VIEWER' ? next.role : 'MEMBER'); if (canAssignGroups) setGroupIds(next.groupIds.filter((gid) => groups.some((group) => group.id === gid))); }
    setPrimaryGroupId('');
  };

  const close = () => { setName(''); setPassword(''); setRole('MEMBER'); setGroupIds([]); setTemplateId(''); setPrimaryGroupId(''); setError(null); setCreated(null); setCopied(false); onClose(); };
  const submit = async () => {
    if (name.trim().length < 2) { setError(t('inv.nameRequired')); return; }
    const chosen = password || generatePassword(slug);
    if (chosen.length < 12) { setError(t('inv.passwordShort', { n: 12 })); return; }
    setBusy(true); setError(null);
    try {
      const result = await createMemberAccount(organizationId, { name: name.trim(), password: chosen, role, groupIds, ...(templateId ? { templateId } : {}), ...(primaryGroup ? { primaryGroupId: primaryGroup.id } : {}) });
      setCreated({ email: result.user.email, password: chosen });
      push({ type: 'success', title: t('adm.create.done'), body: result.user.email });
      onDone();
    } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); }
  };
  const copy = async () => {
    if (!created) return;
    try { await navigator.clipboard.writeText(`${created.email}\n${created.password}`); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable */ }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }} title={t('adm.create.title')} description={created ? t('adm.create.doneHint') : t('adm.create.hint')}
      footer={created
        ? <Button variant="accent" onClick={close}>{t('adm.create.finish')}</Button>
        : <Button variant="accent" loading={busy} disabled={!name.trim()} onClick={() => void submit()}>{t('adm.create.action')}</Button>}>
      {created ? (
        <div className="space-y-3">
          <dl className="space-y-2 rounded-lg border border-border bg-surface-hover p-3 text-sm">
            <div><dt className="ui-label">{t('adm.create.address')}</dt><dd className="mt-0.5 break-all font-mono text-text">{created.email}</dd></div>
            <div><dt className="ui-label">{t('inv.password')}</dt><dd className="mt-0.5 break-all font-mono text-text">{created.password}</dd></div>
          </dl>
          <Button variant="secondary" onClick={() => void copy()}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? t('adm.create.copied') : t('adm.create.copy')}</Button>
          <p className="text-xs text-text-secondary">{t('adm.create.onceNote')}</p>
        </div>
      ) : (
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <label className="block space-y-1"><span className="ui-label">{t('inv.name')}</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" autoFocus maxLength={120} />
          </label>
          <div className="space-y-1"><span className="ui-label">{t('adm.create.address')}</span>
            <p className="rounded-md border border-border bg-surface-hover px-3 py-2 font-mono text-sm text-text-secondary" data-testid="assigned-address">{address}</p>
            <p className="text-[0.7rem] text-text-muted">{t('adm.create.addressHint')} {primaryGroup ? t('tpl.dialog.aliasNote') : ''}</p>
          </div>
          <label className="block space-y-1"><span className="ui-label">{t('inv.password')}</span>
            <span className="flex gap-2">
              <Input value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" maxLength={128} placeholder={`${slug.toUpperCase()}-PASS-…`} className="font-mono" />
              <Button type="button" variant="secondary" aria-label={t('adm.create.generate')} title={t('adm.create.generate')} onClick={() => setPassword(generatePassword(slug))}><Plus className="size-4" /></Button>
            </span>
            <span className="block text-[0.7rem] text-text-muted">{t('adm.create.passwordHint')}</span>
          </label>
          {templates.length > 0 ? (
            <label className="block space-y-1"><span className="ui-label">{t('tpl.dialog.pick')}</span>
              <select className={cn(selectClass, 'w-full')} value={templateId} onChange={(event) => pickTemplate(event.target.value)}>
                <option value="">{t('tpl.dialog.none')}</option>
                {templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          ) : null}
          <label className="block space-y-1"><span className="ui-label">{t('access.col.role')}</span>
            <select className={cn(selectClass, 'w-full')} value={role} onChange={(event) => setRole(event.target.value as typeof role)}>{INVITABLE_ROLES.map((item) => <option key={item}>{item}</option>)}</select>
          </label>
          {canAssignGroups && groups.length > 0 ? (
            <fieldset className="space-y-1"><legend className="ui-label">{t('access.nav.groups')}</legend>
              <div className="flex flex-wrap gap-2">{groups.map((group) => (
                <label key={group.id} className="flex items-center gap-1.5 text-xs text-text-secondary"><input type="checkbox" checked={groupIds.includes(group.id)} onChange={(event) => setGroupIds((current) => event.target.checked ? [...current, group.id] : current.filter((id) => id !== group.id))} />{group.name}</label>
              ))}</div>
            </fieldset>
          ) : null}
          {canAssignGroups && groupIds.length > 0 ? (
            <label className="block space-y-1"><span className="ui-label">{t('tpl.dialog.primary')}</span>
              <select className={cn(selectClass, 'w-full')} value={primaryGroup?.id ?? ''} onChange={(event) => setPrimaryGroupId(event.target.value)}>
                <option value="">{t('tpl.dialog.noPrimary')}</option>
                {groups.filter((group) => groupIds.includes(group.id)).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
              <span className="block text-[0.7rem] text-text-muted">{t('tpl.dialog.primaryHint')}</span>
            </label>
          ) : null}
          <div className="rounded-lg border border-border bg-surface-hover p-3 text-xs text-text-secondary" aria-live="polite">
            <p className="ui-label mb-1">{t('tpl.dialog.gives')}</p>
            <ul className="list-disc space-y-0.5 pl-4">
              {template && template.datasetIds.length > 0 ? <li>{t('tpl.dialog.data', { n: template.datasetIds.length })}</li> : null}
              {template && template.permissions.length > 0 ? <li>{t('tpl.dialog.perms', { n: template.permissions.length })}</li> : null}
              {role === 'ADMIN' ? <li className="text-warning">{t('tpl.dialog.admin')}</li> : null}
              {!template || template.datasetIds.length === 0 ? <li className="text-text-muted">{t('tpl.dialog.noData')}</li> : null}
            </ul>
          </div>
          {error ? <p role="alert" className="text-xs text-error">{error}</p> : null}
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      )}
    </Dialog>
  );
}
