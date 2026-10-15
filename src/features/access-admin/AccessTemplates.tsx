import { useState } from 'react';
import { DashboardCard } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { listDatasets } from '@/features/admin-center/api';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { applyAccessTemplate, createAccessTemplate, deleteAccessTemplate, listAccessTemplates, listGroups, updateAccessTemplate, type AccessTemplate, type AccessTemplateInput, type RegisteredPermission } from './api';
import { PERMISSION_GROUPS, permissionLabelKey } from './permissionCatalog';
import { Loading, Notice, selectClass, useBusy, useList } from './ui';

const ROLES = ['VIEWER', 'MEMBER', 'BILLING_ADMIN', 'ADMIN'] as const;
const EMPTY: AccessTemplateInput = { name: '', description: null, role: 'VIEWER', permissions: [], datasetIds: [], groupIds: [] };

/** Starting points only: they pre-fill the form, nothing is created until the administrator saves. */
const PRESETS: Array<{ key: 'reports' | 'analyst' | 'billing'; value: Partial<AccessTemplateInput> }> = [
  { key: 'reports', value: { role: 'VIEWER', permissions: ['organization.read', 'documents.read'] } },
  { key: 'analyst', value: { role: 'MEMBER', permissions: ['organization.read', 'documents.read', 'documents.download'] } },
  { key: 'billing', value: { role: 'BILLING_ADMIN', permissions: ['organization.read', 'billing.read', 'commerce.read'] } },
];

function TemplateForm({ organizationId, initial, onClose, onSaved }: { organizationId: string; initial: AccessTemplate | null; onClose: () => void; onSaved: () => void }) {
  const { t, locale } = useI18n();
  const datasets = useList(() => listDatasets(organizationId), [organizationId]);
  const groups = useList(() => listGroups(organizationId), [organizationId]);
  const { busy, error, act } = useBusy();
  const [draft, setDraft] = useState<AccessTemplateInput>(initial ? { name: initial.name, description: initial.description, role: initial.role, permissions: initial.permissions, datasetIds: initial.datasetIds, groupIds: initial.groupIds } : EMPTY);
  const toggle = <K extends 'permissions' | 'datasetIds' | 'groupIds'>(key: K, value: AccessTemplateInput[K][number]) =>
    setDraft((current) => ({ ...current, [key]: (current[key] as string[]).includes(value as string) ? (current[key] as string[]).filter((item) => item !== value) : [...(current[key] as string[]), value as string] }));
  const save = () => void act('save', async () => {
    if (initial) await updateAccessTemplate(organizationId, initial.id, draft); else await createAccessTemplate(organizationId, draft);
    onSaved();
  });
  const label = (names: Record<string, string>, fallback: string) => names[locale] ?? names.es ?? names.en ?? Object.values(names)[0] ?? fallback;
  const active = (datasets.data ?? []).filter((dataset) => dataset.status === 'ACTIVE');
  return (
    <Dialog open onOpenChange={(next) => { if (!next && busy === null) onClose(); }} title={initial ? t('tpl.edit') : t('tpl.new')} size="md"
      footer={<><Button variant="ghost" disabled={busy !== null} onClick={onClose}>{t('access.cancel')}</Button><Button variant="accent" loading={busy === 'save'} disabled={draft.name.trim().length < 2} onClick={save}>{t('tpl.save')}</Button></>}>
      <div className="space-y-3">
        {!initial ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-secondary"><span>{t('tpl.quick')}:</span>
            {PRESETS.map((preset) => <Button key={preset.key} size="sm" variant="outline" onClick={() => setDraft((current) => ({ ...current, ...preset.value, name: current.name || t(`tpl.preset.${preset.key}` as never) } as AccessTemplateInput))}>{t(`tpl.preset.${preset.key}` as never)}</Button>)}
          </div>
        ) : null}
        <label className="block space-y-1"><span className="ui-label">{t('tpl.name')}</span><Input value={draft.name} maxLength={80} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label className="block space-y-1"><span className="ui-label">{t('tpl.description')}</span><Input value={draft.description ?? ''} maxLength={300} onChange={(event) => setDraft({ ...draft, description: event.target.value || null })} /></label>
        <label className="block space-y-1"><span className="ui-label">{t('tpl.role')}</span>
          <select className={cn(selectClass, 'w-full')} value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as AccessTemplateInput['role'] })}>{ROLES.map((role) => <option key={role} value={role}>{role}</option>)}</select>
        </label>
        <fieldset className="space-y-1"><legend className="ui-label">{t('tpl.datasets')}</legend>
          {datasets.loading && !datasets.data ? <Loading /> : active.length === 0 ? <p className="text-xs text-text-muted">{t('tpl.noDatasets')}</p> : active.map((dataset) => (
            <label key={dataset.id} className="flex items-center gap-2 text-xs text-text-secondary"><input type="checkbox" checked={draft.datasetIds.includes(dataset.id)} onChange={() => toggle('datasetIds', dataset.id)} /><span className="truncate">{label(dataset.name, dataset.slug)}</span></label>
          ))}
        </fieldset>
        <fieldset className="space-y-1"><legend className="ui-label">{t('tpl.groups')}</legend>
          {(groups.data ?? []).length === 0 ? <p className="text-xs text-text-muted">{t('tpl.noGroups')}</p> : (groups.data ?? []).map((group) => (
            <label key={group.id} className="flex items-center gap-2 text-xs text-text-secondary"><input type="checkbox" checked={draft.groupIds.includes(group.id)} onChange={() => toggle('groupIds', group.id)} /><span className="truncate">{group.name}</span></label>
          ))}
        </fieldset>
        <fieldset className="space-y-2"><legend className="ui-label">{t('tpl.permissions')}</legend>
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.id}><p className="text-[11px] text-text-muted">{t(group.labelKey as never)}</p>
              <div className="grid gap-0.5 sm:grid-cols-2">{group.permissions.map((permission: RegisteredPermission) => (
                <label key={permission} className="flex items-center gap-2 text-xs text-text-secondary"><input type="checkbox" checked={draft.permissions.includes(permission)} onChange={() => toggle('permissions', permission)} />{t(permissionLabelKey(permission) as never)}</label>
              ))}</div>
            </div>
          ))}
        </fieldset>
        <Notice error={error ?? datasets.error ?? groups.error} ok={null} />
      </div>
    </Dialog>
  );
}

/** Manage the organization's access templates (needs permissions.manage on the server). */
export function AccessTemplatesCard({ organizationId, manage }: { organizationId: string; manage: boolean }) {
  const { t } = useI18n();
  const templates = useList(() => listAccessTemplates(organizationId), [organizationId]);
  const { busy, error, ok, act } = useBusy();
  const [editing, setEditing] = useState<AccessTemplate | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AccessTemplate | null>(null);
  return (
    <DashboardCard title={t('tpl.title')} description={manage ? t('tpl.hint') : t('access.readOnly')} actions={manage ? <Button size="sm" onClick={() => setEditing('new')}>{t('tpl.new')}</Button> : undefined}>
      <Notice error={error ?? templates.error} ok={ok} />
      {templates.loading && !templates.data ? <Loading /> : (templates.data ?? []).length === 0 ? <p className="text-xs text-text-muted">{t('tpl.empty')}</p> : (
        <ul className="divide-y divide-border/60">
          {(templates.data ?? []).map((template) => (
            <li key={template.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
              <div className="min-w-0"><p className="truncate font-medium text-text">{template.name}</p><p className="text-text-muted">{t('tpl.summary', { role: template.role, permissions: template.permissions.length, datasets: template.datasetIds.length, groups: template.groupIds.length })}</p></div>
              {manage ? <span className="inline-flex gap-1"><Button size="sm" variant="ghost" onClick={() => setEditing(template)}>{t('tpl.edit')}</Button><Button size="sm" variant="ghost" onClick={() => setDeleting(template)}>{t('tpl.delete')}</Button></span> : null}
            </li>
          ))}
        </ul>
      )}
      {editing ? <TemplateForm organizationId={organizationId} initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void templates.reload(); }} /> : null}
      <ConfirmDialog open={Boolean(deleting)} destructive busy={busy === deleting?.id} title={t('tpl.deleteTitle', { name: deleting?.name ?? '' })} description={t('tpl.deleteBody')} confirmLabel={t('tpl.delete')}
        onCancel={() => setDeleting(null)}
        onConfirm={() => { const target = deleting; if (target) void act(target.id, () => deleteAccessTemplate(organizationId, target.id), t('tpl.deleted')).then(() => { setDeleting(null); return templates.reload(); }); }} />
    </DashboardCard>
  );
}

/** "Apply template" for the member selected in the direct-permissions card. */
export function ApplyTemplateRow({ organizationId, userId, onApplied }: { organizationId: string; userId: string; onApplied: () => void }) {
  const { t } = useI18n();
  const templates = useList(() => listAccessTemplates(organizationId), [organizationId]);
  const { busy, error, ok, act } = useBusy();
  const [templateId, setTemplateId] = useState('');
  if ((templates.data ?? []).length === 0) return null;
  return (
    <div className="mb-3 space-y-1.5 rounded-lg border border-border p-2">
      <div className="flex flex-wrap items-center gap-2">
        <select className={cn(selectClass, 'min-w-0 flex-1')} aria-label={t('tpl.apply')} value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
          <option value="">{t('tpl.applyPick')}</option>
          {(templates.data ?? []).map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
        </select>
        <Button size="sm" variant="secondary" disabled={!templateId || busy !== null} loading={busy === 'apply'} onClick={() => void act('apply', async () => { await applyAccessTemplate(organizationId, userId, templateId); onApplied(); }, t('tpl.applied'))}>{t('tpl.apply')}</Button>
      </div>
      <Notice error={error} ok={ok} />
    </div>
  );
}
