import { useMemo, useState } from 'react';
import { ArrowsClockwise, FolderSimplePlus, Stack } from '@phosphor-icons/react';
import { DashboardCard } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { Status } from '@/components/ui/status';
import { ApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { listDatasets, type DatasetSummary } from '@/features/admin-center/api';
import { useResource } from '@/features/admin-center/hooks';
import { KeyValue, Loading, Notice, SectionTabs, Unavailable, invalidateOrganization, selectClass, td, th, useBusy } from '@/features/admin-center/ui';
import { PipelinePanel } from './PipelinePanel';
import { QualityPanel } from './QualityPanel';
import { localName } from '@/features/views/workspace/resources';
import {
  assignDataset, createGroup, deleteGroup, formatBytes, groupAudit, groupDependencies, listGroups, readGroup, setGroupStatus, slugOf,
  type DatasetGroup, type GroupDependencies,
} from './groupsApi';

const healthTone = { OK: 'active', ISSUES: 'error', EMPTY: 'neutral' } as const;
const period = (start: string | null, end: string | null, none: string) => (start || end ? `${start ?? '…'} → ${end ?? '…'}` : none);

export function GroupsTab({ organizationId }: { organizationId: string }) {
  const { t, locale } = useI18n();
  const groups = useResource(() => listGroups(organizationId), [organizationId]);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const refresh = () => { invalidateOrganization(organizationId); void groups.reload(); };
  if (groups.status === 'forbidden') return <Unavailable tone="forbidden" title={t('adm2.q.forbidden')} body={t('adm2.q.forbiddenBody')} />;
  return (
    <DashboardCard title={t('dg.title')} description={t('dg.hint')}
      actions={<div className="flex gap-1.5"><Button size="sm" variant="accent" onClick={() => setCreating(true)}><FolderSimplePlus className="size-3.5" />{t('dg.new')}</Button><Button size="sm" variant="ghost" onClick={refresh}><ArrowsClockwise className="size-3.5" />{t('access.refresh')}</Button></div>}>
      {groups.status === 'loading' ? <Loading /> : groups.status === 'error' ? <Notice error={groups.error} /> : (groups.data ?? []).length === 0 ? <EmptyState icon={Stack} title={t('dg.empty')} body={t('dg.emptyBody')} /> : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full border-separate border-spacing-0">
            <thead><tr><th className={th}>{t('dg.col.name')}</th><th className={th}>{t('dg.col.datasets')}</th><th className={th}>{t('dg.col.period')}</th><th className={th}>{t('dg.col.rows')}</th><th className={th}>{t('dg.col.size')}</th><th className={th}>{t('dg.col.health')}</th><th className={th}>{t('dg.col.lastImport')}</th></tr></thead>
            <tbody>
              {(groups.data ?? []).map((group) => (
                <tr key={group.id} tabIndex={0} className="cursor-pointer outline-none transition-colors duration-(--duration-fast) hover:bg-surface-hover/60 focus-visible:bg-surface-hover" onClick={() => setSelected(group.id)} onKeyDown={(event) => { if (event.key === 'Enter') setSelected(group.id); }}>
                  <td className={`${td} font-medium`}>{localName(group.name, locale)}{group.status === 'ARCHIVED' ? <span className="ml-1.5 text-text-muted">· {t('dg.archived')}</span> : null}{group.category ? <span className="block text-text-muted">{group.category}</span> : null}</td>
                  <td className={`${td} tabular-nums`}>{group.summary.datasetCount}</td>
                  <td className={`${td} whitespace-nowrap mono-data`}>{period(group.summary.periodStart, group.summary.periodEnd, t('dg.none'))}</td>
                  <td className={`${td} tabular-nums`}>{group.summary.rowCount.toLocaleString(locale)}</td>
                  <td className={`${td} whitespace-nowrap`}>{formatBytes(group.summary.originalBytes)}</td>
                  <td className={td}><Status tone={healthTone[group.summary.health]}>{t(`dg.health.${group.summary.health}`)}</Status></td>
                  <td className={`${td} whitespace-nowrap`}>{group.summary.lastImportAt ? new Date(group.summary.lastImportAt).toLocaleDateString(locale) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <CreateGroupDialog organizationId={organizationId} open={creating} onClose={() => setCreating(false)} onCreated={(group) => { setCreating(false); refresh(); setSelected(group.id); }} />
      <GroupSheet organizationId={organizationId} groupId={selected} onClose={() => setSelected(null)} onChanged={refresh} />
    </DashboardCard>
  );
}

function CreateGroupDialog({ organizationId, open, onClose, onCreated }: { organizationId: string; open: boolean; onClose: () => void; onCreated: (group: DatasetGroup) => void }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const { busy, error, act } = useBusy();
  const submit = () => void act('create', async () => {
    onCreated(await createGroup(organizationId, { slug: slug || slugOf(name), name: name.trim(), category: category.trim() || undefined, tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean) }));
    setName(''); setSlug(''); setCategory(''); setTags('');
  });
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onClose(); }} title={t('dg.create.title')} size="sm"
      footer={<><Button variant="ghost" disabled={busy !== null} onClick={onClose}>{t('access.cancel')}</Button><Button variant="primary" loading={busy === 'create'} disabled={name.trim().length < 2} onClick={submit}>{t('dg.create.submit')}</Button></>}>
      <div className="space-y-3">
        <label className="block space-y-1 text-xs"><span className="text-text-secondary">{t('dg.create.name')}</span><Input value={name} maxLength={100} onChange={(event) => { setName(event.target.value); }} /></label>
        <label className="block space-y-1 text-xs"><span className="text-text-secondary">{t('dg.create.slug')}</span><Input value={slug || slugOf(name)} maxLength={64} onChange={(event) => setSlug(slugOf(event.target.value))} /></label>
        <label className="block space-y-1 text-xs"><span className="text-text-secondary">{t('dg.create.category')}</span><Input value={category} maxLength={64} onChange={(event) => setCategory(event.target.value)} /></label>
        <label className="block space-y-1 text-xs"><span className="text-text-secondary">{t('dg.create.tags')}</span><Input value={tags} onChange={(event) => setTags(event.target.value)} /></label>
        <Notice error={error} />
      </div>
    </Dialog>
  );
}

function GroupSheet({ organizationId, groupId, onClose, onChanged }: { organizationId: string; groupId: string | null; onClose: () => void; onChanged: () => void }) {
  const { t, locale } = useI18n();
  const id = groupId ?? '';
  const detail = useResource(() => (id ? readGroup(organizationId, id) : Promise.resolve(null)), [organizationId, id]);
  const audit = useResource(() => (id ? groupAudit(organizationId, id).catch(() => []) : Promise.resolve([])), [organizationId, id]);
  const datasets = useResource(() => listDatasets(organizationId), [organizationId]);
  const { busy, error, ok, act, setError } = useBusy();
  const group = detail.data;
  const [pick, setPick] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [label, setLabel] = useState('');
  const [overlap, setOverlap] = useState(false);
  const [tab, setTab] = useState<'overview' | 'datasets' | 'pipeline' | 'quality' | 'audit' | 'settings'>('overview');
  const [deleting, setDeleting] = useState<GroupDependencies | null>(null);
  const free = useMemo(() => (datasets.data ?? []).filter((dataset: DatasetSummary) => dataset.status === 'ACTIVE' && !dataset.groupId), [datasets.data]);
  const reload = async () => { await Promise.all([detail.reload(), audit.reload(), datasets.reload()]); onChanged(); };

  const add = (allowOverlap: boolean) => void act('add', async () => {
    try {
      await assignDataset(organizationId, pick, { groupId: id, periodStart: start || null, periodEnd: end || null, periodLabel: label.trim() || null, allowOverlap });
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === 'PERIOD_OVERLAP') { setOverlap(true); return; }
      throw reason;
    }
    setPick(''); setStart(''); setEnd(''); setLabel(''); setOverlap(false);
    await reload();
  }, t('dg.saved'));

  return (
    <Sheet open={groupId !== null} onOpenChange={(open) => { if (!open) onClose(); }} side="right" title={group ? localName(group.name, locale) : ''} description={group?.slug} className="sm:w-[38rem]">
      {detail.status === 'loading' ? <Loading /> : detail.status !== 'ready' || !group ? <Notice error={detail.error} /> : (
        <div className="space-y-5">
          {tab === 'overview' ? (<>
          <dl>
            <KeyValue label={t('access.col.status')}>{group.status === 'ARCHIVED' ? t('dg.archived') : <Status tone={healthTone[group.summary.health]}>{t(`dg.health.${group.summary.health}`)}</Status>}</KeyValue>
            <KeyValue label={t('dg.col.datasets')}>{group.summary.datasetCount}</KeyValue>
            <KeyValue label={t('dg.col.period')}>{period(group.summary.periodStart, group.summary.periodEnd, t('dg.none'))}</KeyValue>
            <KeyValue label={t('dg.col.rows')}>{group.summary.rowCount.toLocaleString(locale)}</KeyValue>
            <KeyValue label={t('dg.col.size')}>{formatBytes(group.summary.originalBytes)}</KeyValue>
            {group.category ? <KeyValue label={t('dg.create.category')}>{group.category}</KeyValue> : null}
            {group.tags.length ? <KeyValue label={t('dg.create.tags')}>{group.tags.join(', ')}</KeyValue> : null}
          </dl>
          </>) : null}
          <SectionTabs label={group.slug} value={tab} onChange={setTab} tabs={[
            { id: 'overview', label: t('dg.section.overview') }, { id: 'datasets', label: t('dg.section.datasets'), badge: group.datasets.length },
            { id: 'pipeline', label: t('dg.section.pipeline') }, { id: 'quality', label: t('dg.section.quality') },
            { id: 'audit', label: t('dg.section.audit') }, { id: 'settings', label: t('dg.section.settings') },
          ]} />
          <Notice error={error} ok={ok} />
          {tab === 'pipeline' ? <PipelinePanel organizationId={organizationId} groupId={group.id} datasets={group.datasets} /> : null}
          {tab === 'quality' ? <QualityPanel organizationId={organizationId} group={group} /> : null}

          {tab === 'datasets' ? (<>
          <section>
            <h3 className="ui-label mb-1.5">{t('dg.section.datasets')}</h3>
            {group.datasets.length === 0 ? <p className="text-xs text-text-muted">{t('dg.ds.none')}</p> : (
              <ul className="divide-y divide-border/60 rounded-lg border border-border text-xs">
                {group.datasets.map((dataset) => (
                  <li key={dataset.id} className="flex items-center gap-2 px-3 py-1.5">
                    <span className="min-w-0 flex-1 truncate font-medium">{dataset.periodLabel ?? localName(dataset.name, locale)}<span className="block mono-data font-normal text-text-muted">{period(dataset.periodStart, dataset.periodEnd, t('dg.none'))} · {dataset.rowCount.toLocaleString(locale)}</span></span>
                    <Button size="sm" variant="ghost" loading={busy === dataset.id} onClick={() => void act(dataset.id, async () => { await assignDataset(organizationId, dataset.id, { groupId: null }); await reload(); }, t('dg.saved'))}>{t('dg.ds.remove')}</Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-[11px] text-text-muted">{t('dg.ds.removeNote')}</p>
          </section>

          {group.status === 'ACTIVE' ? (
            <section className="space-y-2 rounded-lg border border-border p-3">
              <h3 className="ui-label">{t('dg.ds.add')}</h3>
              {free.length === 0 ? <p className="text-xs text-text-muted">{t('dg.ds.noneFree')}</p> : (
                <>
                  <select className={`${selectClass} w-full`} aria-label={t('dg.ds.pick')} value={pick} onChange={(event) => { setPick(event.target.value); setOverlap(false); setError(null); }}>
                    <option value="">{t('dg.ds.pickNone')}</option>
                    {free.map((dataset) => <option key={dataset.id} value={dataset.id}>{localName(dataset.name, locale)}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1 text-xs"><span className="text-text-secondary">{t('dg.ds.start')}</span><Input type="date" value={start} onChange={(event) => { setStart(event.target.value); setOverlap(false); }} /></label>
                    <label className="space-y-1 text-xs"><span className="text-text-secondary">{t('dg.ds.end')}</span><Input type="date" value={end} min={start || undefined} onChange={(event) => { setEnd(event.target.value); setOverlap(false); }} /></label>
                  </div>
                  <label className="block space-y-1 text-xs"><span className="text-text-secondary">{t('dg.ds.label')}</span><Input value={label} maxLength={60} onChange={(event) => setLabel(event.target.value)} /></label>
                  {overlap ? <p role="alert" className="text-xs text-warning">{t('dg.ds.overlap')}</p> : null}
                  <Button variant={overlap ? 'secondary' : 'accent'} loading={busy === 'add'} disabled={!pick || Boolean(start && end && end < start)} onClick={() => add(overlap)}>{overlap ? t('dg.ds.overlapConfirm') : t('dg.ds.add')}</Button>
                </>
              )}
            </section>
          ) : null}
          </>) : null}

          {tab === 'audit' ? (<>
          <section>
            <h3 className="ui-label mb-1.5">{t('dg.section.audit')}</h3>
            {(audit.data ?? []).length === 0 ? <p className="text-xs text-text-muted">{t('dg.audit.empty')}</p> : (
              <ul className="divide-y divide-border/60 rounded-lg border border-border text-xs">
                {(audit.data ?? []).slice(0, 12).map((entry) => <li key={entry.id} className="flex items-center justify-between gap-2 px-3 py-1.5"><span className="mono-data">{entry.action.replace('NORTH_DATASET_', '')}</span><time className="shrink-0 text-text-muted" dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString(locale)}</time></li>)}
              </ul>
            )}
          </section>
          </>) : null}

          {tab === 'settings' ? (<>
          <section className="flex flex-wrap gap-2 border-t border-border pt-3" aria-label={t('dg.section.settings')}>
            <Button variant="secondary" loading={busy === 'status'} onClick={() => void act('status', async () => { await setGroupStatus(organizationId, group.id, group.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE'); await reload(); }, t('dg.saved'))}>{group.status === 'ACTIVE' ? t('dg.archive') : t('dg.restore')}</Button>
            {group.status === 'ARCHIVED' ? <Button variant="destructive" loading={busy === 'scope'} onClick={() => void act('scope', async () => setDeleting(await groupDependencies(organizationId, group.id)))}>{t('dg.delete')}</Button> : null}
          </section>
          </>) : null}

          <ConfirmDialog open={deleting !== null} destructive busy={busy === 'delete'} title={t('dg.delete.title', { name: localName(group.name, locale) })} confirmLabel={t('dg.delete.confirm')}
            disabled={(deleting?.runningImports ?? 0) > 0} error={error}
            onCancel={() => setDeleting(null)}
            onConfirm={() => void act('delete', async () => { await deleteGroup(organizationId, group.id); setDeleting(null); onChanged(); onClose(); })}>
            {deleting ? (
              <div className="space-y-1.5 text-xs text-text-secondary">
                <p>{t('dg.delete.scope', { datasets: deleting.datasets })}</p>
                {deleting.bindings > 0 ? <p>{t('dg.delete.bindings', { bindings: deleting.bindings, panels: deleting.panels })}</p> : null}
                {deleting.runningImports > 0 ? <p role="alert" className="text-error">{t('dg.delete.running')}</p> : null}
              </div>
            ) : null}
          </ConfirmDialog>
        </div>
      )}
    </Sheet>
  );
}

