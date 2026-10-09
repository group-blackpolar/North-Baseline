import { useEffect, useMemo, useState } from 'react';
import { ArrowsClockwise, Calculator, Database, FloppyDisk, Graph, Plugs, SquaresFour, TreeStructure, UploadSimple, Warning } from '@phosphor-icons/react';
import { DashboardCard } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Sheet } from '@/components/ui/sheet';
import { Status } from '@/components/ui/status';
import { Skeleton } from '@/components/ui/skeleton';
import { listAuthorizedTaxonomy, getDraft } from '@/lib/northAdmin';
import { useI18n } from '@/lib/i18n';
import { queryDataset } from '@/features/analytics/datasetQuery';
import { listDatasetFields, listDatasetImports, listDatasets, listSchemaVersions, type DatasetField, type DatasetSummary } from '@/features/admin-center/api';
import { mapLimit, useResource } from '@/features/admin-center/hooks';
import { KeyValue, Loading, Notice, SectionTabs, Shell, Unavailable, invalidateOrganization, td, th, toneForStatus } from '@/features/admin-center/ui';
import { flattenTree, localName, type TreeCategory } from '@/features/views/workspace/resources';
import { buildDependencyReport, extractDatasetRefs, type DatasetRef, type DependencyReport } from './dependencies';
import { QueryExplorer } from './QueryExplorer';
import { ImportWizard } from './import/ImportWizard';

type Tab = 'overview' | 'sources' | 'datasets' | 'explorer' | 'saved' | 'calculated' | 'dependencies';

/**
 * Queries: the analytical resources Views can read. Backed today by CORECROW datasets (schema, fields, imports, active
 * revision) and its bounded declarative query endpoint. A data-source registry, saved queries and calculated fields do not
 * exist in CORECROW yet; those tabs say so and state exactly what is missing instead of offering inert forms.
 */
export function QueriesCenter({ organizationId }: { organizationId: string }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('overview');
  const [explorerDataset, setExplorerDataset] = useState<string | null>(null);
  const openInExplorer = (datasetId: string) => { setExplorerDataset(datasetId); setTab('explorer'); };

  return (
    <Shell title={t('adm2.q.title')} hint={t('adm2.q.hint')}>
      <SectionTabs
        label={t('adm.nav.queries')} value={tab} onChange={setTab}
        tabs={[
          { id: 'overview', label: t('adm2.q.tab.overview'), icon: SquaresFour },
          { id: 'sources', label: t('adm2.q.tab.sources'), icon: Plugs },
          { id: 'datasets', label: t('adm2.q.tab.datasets'), icon: Database },
          { id: 'explorer', label: t('adm2.q.tab.explorer'), icon: Graph },
          { id: 'saved', label: t('adm2.q.tab.saved'), icon: FloppyDisk },
          { id: 'calculated', label: t('adm2.q.tab.calculated'), icon: Calculator },
          { id: 'dependencies', label: t('adm2.q.tab.dependencies'), icon: TreeStructure },
        ]}
      />
      {tab === 'overview' ? <OverviewTab organizationId={organizationId} onOpen={setTab} /> : null}
      {tab === 'sources' ? <Unavailable title={t('adm2.q.sources.title')} body={t('adm2.q.sources.body')} needs={t('adm2.q.sources.needs')} /> : null}
      {tab === 'datasets' ? <DatasetsTab organizationId={organizationId} onExplore={openInExplorer} /> : null}
      {tab === 'explorer' ? <QueryExplorer key={explorerDataset ?? 'none'} organizationId={organizationId} initialDatasetId={explorerDataset} /> : null}
      {tab === 'saved' ? <Unavailable title={t('adm2.q.saved.title')} body={t('adm2.q.saved.body')} needs={t('adm2.q.saved.needs')} /> : null}
      {tab === 'calculated' ? <Unavailable title={t('adm2.q.calculated.title')} body={t('adm2.q.calculated.body')} needs={t('adm2.q.calculated.needs')} /> : null}
      {tab === 'dependencies' ? <DependenciesTab organizationId={organizationId} /> : null}
    </Shell>
  );
}

function OverviewTab({ organizationId, onOpen }: { organizationId: string; onOpen: (tab: Tab) => void }) {
  const { t, locale } = useI18n();
  const datasets = useResource(() => listDatasets(organizationId), [organizationId]);
  const imports = useResource(async () => {
    const list = (await listDatasets(organizationId)).slice(0, 12);
    const rows = await mapLimit(list, 4, async (dataset) => (await listDatasetImports(organizationId, dataset.id).catch(() => [])).map((item) => ({ ...item, dataset })));
    return rows.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [organizationId]);

  if (datasets.status === 'forbidden') return <Unavailable tone="forbidden" title={t('adm2.q.forbidden')} body={t('adm2.q.forbiddenBody')} />;
  const total = datasets.data?.length ?? null;
  const active = datasets.data?.filter((dataset) => dataset.status === 'ACTIVE').length ?? null;
  const cards: Array<{ id: string; label: string; value: string | number | null; note?: string; tab?: Tab }> = [
    { id: 'sources', label: t('adm2.q.kpi.sources'), value: t('adm2.q.na'), note: t('adm2.q.kpi.sourcesNote'), tab: 'sources' },
    { id: 'datasets', label: t('adm2.q.kpi.datasets'), value: active, note: total !== null && total !== active ? t('adm2.q.kpi.archived', { count: (total ?? 0) - (active ?? 0) }) : undefined, tab: 'datasets' },
    { id: 'saved', label: t('adm2.q.kpi.saved'), value: t('adm2.q.na'), note: t('adm2.q.kpi.savedNote'), tab: 'saved' },
    { id: 'calc', label: t('adm2.q.kpi.calculated'), value: t('adm2.q.na'), note: t('adm2.q.kpi.calculatedNote'), tab: 'calculated' },
    { id: 'err', label: t('adm2.q.kpi.errors'), value: imports.data ? imports.data.filter((item) => toneForStatus(item.status) === 'error').length : null, note: t('adm2.q.kpi.errorsNote') },
    { id: 'exec', label: t('adm2.q.kpi.recent'), value: t('adm2.q.na'), note: t('adm2.q.kpi.recentNote'), tab: 'explorer' },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <button key={card.id} type="button" disabled={!card.tab} onClick={() => card.tab && onOpen(card.tab)} className="np-card np-press-flat min-w-0 p-3.5 text-left transition-colors duration-(--duration-fast) enabled:hover:border-border-hover">
            <p className="ui-label pb-1">{card.label}</p>
            {datasets.status === 'loading' && typeof card.value !== 'string' ? <Skeleton className="h-7 w-12" /> : <p className={`font-display font-semibold tabular-nums text-text ${card.value === t('adm2.q.na') ? 'text-sm text-text-muted' : 'text-2xl'}`}>{card.value ?? '—'}</p>}
            {card.note ? <p className="mt-0.5 text-[11px] text-text-muted">{card.note}</p> : null}
          </button>
        ))}
      </div>
      <DashboardCard title={t('adm2.q.recentImports')} description={t('adm2.q.recentImportsHint')}>
        {imports.status === 'loading' ? <Loading /> : (imports.data ?? []).length === 0 ? <EmptyState icon={Database} title={t('adm2.int.history.empty')} /> : (
          <ul className="divide-y divide-border/60">
            {(imports.data ?? []).slice(0, 6).map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-1.5 text-xs">
                <span className="min-w-0 flex-1 truncate font-medium">{localName(item.dataset.name, locale)}</span>
                <time className="shrink-0 text-text-muted" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString(locale)}</time>
                <Status tone={toneForStatus(item.status)}>{item.status}</Status>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>
    </div>
  );
}

function DatasetsTab({ organizationId, onExplore }: { organizationId: string; onExplore: (id: string) => void }) {
  const { t, locale } = useI18n();
  const datasets = useResource(() => listDatasets(organizationId), [organizationId]);
  const [selected, setSelected] = useState<DatasetSummary | null>(null);
  const [importing, setImporting] = useState<{ datasetId: string | null } | null>(null);
  if (datasets.status === 'forbidden') return <Unavailable tone="forbidden" title={t('adm2.q.forbidden')} body={t('adm2.q.forbiddenBody')} />;
  return (
    <DashboardCard title={t('adm2.q.tab.datasets')} description={t('adm2.q.datasets.hint')} actions={<div className="flex gap-1.5"><Button size="sm" variant="accent" onClick={() => setImporting({ datasetId: null })}><UploadSimple className="size-3.5" />{t('imp.open')}</Button><Button size="sm" variant="ghost" onClick={() => { invalidateOrganization(organizationId); void datasets.reload(); }}><ArrowsClockwise className="size-3.5" />{t('access.refresh')}</Button></div>}>
      {datasets.status === 'loading' ? <Loading /> : datasets.status === 'error' ? <Notice error={datasets.error} /> : (datasets.data ?? []).length === 0 ? <EmptyState icon={Database} title={t('adm2.q.noDatasets')} body={t('adm2.q.noDatasetsBody')} /> : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full border-separate border-spacing-0">
            <thead><tr><th className={th}>{t('adm.settings.name')}</th><th className={th}>{t('adm2.q.slug')}</th><th className={th}>{t('access.col.status')}</th><th className={th}>{t('adm2.q.updated')}</th><th className={th} /></tr></thead>
            <tbody>
              {(datasets.data ?? []).map((dataset) => (
                <tr key={dataset.id} tabIndex={0} className="cursor-pointer outline-none transition-colors duration-(--duration-fast) hover:bg-surface-hover/60 focus-visible:bg-surface-hover" onClick={() => setSelected(dataset)} onKeyDown={(event) => { if (event.key === 'Enter') setSelected(dataset); }}>
                  <td className={`${td} font-medium`}>{localName(dataset.name, locale)}{dataset.description ? <span className="block max-w-80 truncate text-text-muted">{localName(dataset.description, locale)}</span> : null}</td>
                  <td className={`${td} mono-data`}>{dataset.slug}</td>
                  <td className={td}><Status tone={toneForStatus(dataset.status)}>{dataset.status}</Status></td>
                  <td className={`${td} whitespace-nowrap`}>{new Date(dataset.updatedAt).toLocaleDateString(locale)}</td>
                  <td className={`${td} text-right`}><Button size="sm" variant="ghost" disabled={dataset.status !== 'ACTIVE'} onClick={(event) => { event.stopPropagation(); onExplore(dataset.id); }}>{t('adm2.q.explore')}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <DatasetSheet organizationId={organizationId} dataset={selected} onClose={() => setSelected(null)} onExplore={onExplore} onImport={(datasetId) => { setSelected(null); setImporting({ datasetId }); }} />
      <ImportWizard key={importing?.datasetId ?? 'new'} organizationId={organizationId} open={importing !== null} onOpenChange={(open) => { if (!open) setImporting(null); }} initialDatasetId={importing?.datasetId ?? null} onDone={() => { invalidateOrganization(organizationId); void datasets.reload(); }} />
    </DashboardCard>
  );
}

function DatasetSheet({ organizationId, dataset, onClose, onExplore, onImport }: { organizationId: string; dataset: DatasetSummary | null; onClose: () => void; onExplore: (id: string) => void; onImport?: (id: string) => void }) {
  const { t, locale } = useI18n();
  const id = dataset?.id ?? '';
  const fields = useResource<DatasetField[]>(() => (id ? listDatasetFields(organizationId, id) : Promise.resolve([])), [organizationId, id]);
  const imports = useResource(() => (id ? listDatasetImports(organizationId, id) : Promise.resolve([])), [organizationId, id]);
  const versions = useResource(() => (id ? listSchemaVersions(organizationId, id) : Promise.resolve([])), [organizationId, id]);
  // Record count: a real COUNT through the same authorized query endpoint (null while loading / when not queryable).
  const [count, setCount] = useState<number | 'unavailable' | null>(null);
  useEffect(() => {
    setCount(null);
    if (!id || dataset?.status !== 'ACTIVE') return;
    const controller = new AbortController();
    queryDataset(organizationId, id, { mode: 'AGGREGATE', measures: [{ operation: 'COUNT', alias: 'records' }] }, controller.signal)
      .then((response) => { const value = response.rows[0]?.records; setCount(typeof value === 'number' ? value : Number(value) || 0); })
      .catch(() => { if (!controller.signal.aborted) setCount('unavailable'); });
    return () => controller.abort();
  }, [dataset?.status, id, organizationId]);

  return (
    <Sheet open={Boolean(dataset)} onOpenChange={(open) => { if (!open) onClose(); }} side="right" title={dataset ? localName(dataset.name, locale) : ''} description={dataset?.slug} className="sm:w-[28rem]">
      {dataset ? (
        <div className="space-y-5">
          <dl>
            <KeyValue label={t('access.col.status')}><Status tone={toneForStatus(dataset.status)}>{dataset.status}</Status></KeyValue>
            <KeyValue label={t('adm2.q.records')}>{count === null ? '…' : count === 'unavailable' ? t('adm2.q.na') : count.toLocaleString(locale)}</KeyValue>
            <KeyValue label={t('adm2.q.fields')}>{fields.data ? fields.data.length : '…'}</KeyValue>
            <KeyValue label={t('adm2.q.schemaVersions')}>{versions.data ? versions.data.length : '…'}</KeyValue>
            <KeyValue label={t('adm2.q.updated')}>{new Date(dataset.updatedAt).toLocaleString(locale)}</KeyValue>
            <KeyValue label={t('adm2.q.created')}>{new Date(dataset.createdAt).toLocaleString(locale)}</KeyValue>
            <KeyValue label="ID" mono>{dataset.id}</KeyValue>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button variant="accent" disabled={dataset.status !== 'ACTIVE'} onClick={() => { onClose(); onExplore(dataset.id); }}><Graph />{t('adm2.q.explore')}</Button>
            {onImport && dataset.status === 'ACTIVE' ? <Button variant="secondary" onClick={() => onImport(dataset.id)}><UploadSimple />{t('imp.openFile')}</Button> : null}
          </div>

          <section>
            <h3 className="ui-label mb-1.5">{t('adm2.q.fields')}</h3>
            {fields.status === 'loading' ? <Skeleton className="h-24 w-full" /> : fields.status !== 'ready' ? <Notice error={fields.error} /> : (
              <ul className="divide-y divide-border/60 rounded-lg border border-border text-xs">
                {(fields.data ?? []).map((field) => (
                  <li key={field.id} className="flex items-center gap-2 px-3 py-1.5">
                    <span className="min-w-0 flex-1 truncate font-medium">{localName(field.displayName, locale) || field.key}<span className="ml-1.5 mono-data text-text-muted">{field.key}</span></span>
                    <span className="shrink-0 rounded bg-surface-active px-1 text-[10px] uppercase text-text-muted">{field.canonicalType}</span>
                    {field.nullable ? <span className="shrink-0 text-[10px] text-text-muted">null</span> : null}
                    {field.status === 'DEPRECATED' ? <Status tone="pending">{t('adm2.q.deprecated')}</Status> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="ui-label mb-1.5">{t('adm2.int.history.title')}</h3>
            {imports.status === 'loading' ? <Skeleton className="h-16 w-full" /> : (imports.data ?? []).length === 0 ? <p className="text-xs text-text-muted">{t('adm2.int.history.empty')}</p> : (
              <ul className="divide-y divide-border/60 rounded-lg border border-border text-xs">
                {(imports.data ?? []).slice(0, 8).map((item) => <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-1.5"><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString(locale)}</time><Status tone={toneForStatus(item.status)}>{item.status}</Status></li>)}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </Sheet>
  );
}

function DependenciesTab({ organizationId }: { organizationId: string }) {
  const { t, locale } = useI18n();
  const datasets = useResource(() => listDatasets(organizationId), [organizationId]);
  const tree = useResource(() => listAuthorizedTaxonomy(organizationId), [organizationId]);
  const [scan, setScan] = useState<{ status: 'idle' | 'running' | 'done' | 'error'; done: number; total: number; report?: DependencyReport; failed: number; message?: string }>({ status: 'idle', done: 0, total: 0, failed: 0 });

  const panels = useMemo(() => flattenTree((tree.data ?? []) as unknown as TreeCategory[]).filter((resource) => resource.kind === 'PANEL' && resource.resourceKind === 'CONTENT' && (resource.draftRevisionId || resource.publishedRevisionId)), [tree.data]);

  const run = async () => {
    if (!datasets.data) return;
    setScan({ status: 'running', done: 0, total: panels.length, failed: 0 });
    let done = 0; let failed = 0;
    const refs = new Map<string, DatasetRef[]>();
    try {
      await mapLimit(panels, 4, async (panel) => {
        try { refs.set(panel.id, extractDatasetRefs((await getDraft(organizationId, panel.id)).document)); } catch { failed += 1; }
        done += 1;
        setScan((current) => ({ ...current, done, failed }));
      });
      const report = buildDependencyReport(
        panels.map((panel) => ({ id: panel.id, name: panel.name, status: panel.status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED', categoryName: panel.categoryName })),
        refs, datasets.data.map((dataset) => ({ id: dataset.id, name: dataset.name, status: dataset.status })),
      );
      setScan({ status: 'done', done, total: panels.length, failed, report });
    } catch (reason) { setScan({ status: 'error', done, total: panels.length, failed, message: reason instanceof Error ? reason.message : undefined }); }
  };

  if (datasets.status === 'forbidden') return <Unavailable tone="forbidden" title={t('adm2.q.forbidden')} body={t('adm2.q.forbiddenBody')} />;
  const report = scan.report;
  return (
    <div className="space-y-4">
      <DashboardCard title={t('adm2.q.deps.title')} description={t('adm2.q.deps.hint', { count: panels.length })}
        actions={<Button size="sm" variant="accent" loading={scan.status === 'running'} disabled={datasets.status !== 'ready' || tree.status !== 'ready'} onClick={() => void run()}>{scan.status === 'done' ? t('adm2.q.deps.rescan') : t('adm2.q.deps.scan')}</Button>}>
        {scan.status === 'running' ? <p role="status" className="text-xs text-text-secondary">{t('adm2.q.deps.progress', { done: scan.done, total: scan.total })}</p> : null}
        {scan.status === 'error' ? <Notice error={scan.message} /> : null}
        {scan.status === 'idle' ? <p className="text-xs text-text-secondary">{t('adm2.q.deps.idle')}</p> : null}
        {report ? (
          <div className="space-y-4">
            {scan.failed > 0 ? <p role="status" className="text-xs text-warning">{t('adm2.q.deps.partial', { count: scan.failed })}</p> : null}
            {report.broken.length > 0 ? (
              <section aria-label={t('adm2.q.deps.broken')} className="space-y-1.5">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-error"><Warning className="size-3.5" />{t('adm2.q.deps.broken')} ({report.broken.length})</h3>
                <ul className="space-y-1">{report.broken.map((item) => <li key={`${item.panel.id}:${item.ref.datasetId}`} className="rounded-lg border border-error/30 bg-error/5 px-3 py-1.5 text-xs"><span className="font-medium">{localName(item.panel.name, locale)}</span> → <span className="mono-data">{item.ref.datasetId}</span> <Status tone="error">{item.reason === 'MISSING' ? t('adm2.q.deps.missing') : t('adm2.q.deps.archivedDataset')}</Status></li>)}</ul>
              </section>
            ) : <p className="text-xs text-success">{t('adm2.q.deps.noBroken')}</p>}

            <section aria-label={t('adm2.q.deps.map')} className="space-y-1.5">
              <h3 className="ui-label">{t('adm2.q.deps.map')}</h3>
              {(datasets.data ?? []).length === 0 ? <p className="text-xs text-text-muted">{t('adm2.q.noDatasets')}</p> : (
                <ul className="space-y-1.5">
                  {(datasets.data ?? []).map((dataset) => {
                    const users = report.byDataset.get(dataset.id) ?? [];
                    return (
                      <li key={dataset.id} className="rounded-lg border border-border p-2.5">
                        <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium text-text">{localName(dataset.name, locale)}</span><span className="text-[11px] text-text-muted">{t('adm2.q.deps.usedBy', { count: users.length })}</span></div>
                        {users.length > 0 ? <ul className="mt-1.5 flex flex-wrap gap-1.5">{users.map((entry) => <li key={entry.panel.id} className="rounded-full border border-border bg-surface-hover px-2 py-0.5 text-[11px]">{localName(entry.panel.categoryName, locale)} / {localName(entry.panel.name, locale)} · {entry.refs.map((ref) => ref.componentType).join(', ')}</li>)}</ul> : <p className="mt-1 text-[11px] text-text-muted">{t('adm2.q.deps.unused')}</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            {report.archivedViewsWithRefs.length > 0 ? <p className="text-[11px] text-text-muted">{t('adm2.q.deps.archivedViews', { count: report.archivedViewsWithRefs.length })}</p> : null}
          </div>
        ) : null}
      </DashboardCard>
    </div>
  );
}
