import { useEffect, useState } from 'react';
import { ArrowsClockwise, Database, Heartbeat, Plugs, PlugsConnected, WebhooksLogo, ClockCounterClockwise, Key } from '@phosphor-icons/react';
import { DashboardCard } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Status } from '@/components/ui/status';
import { useI18n } from '@/lib/i18n';
import { localName } from '@/features/views/workspace/resources';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { eraseDataset, getDatasetDependencies, listDatasetImports, listDatasets, probeApiHealth, purgeDatasetImports, setDatasetStatus, type DatasetDependencies, type DatasetImport, type DatasetSummary } from './api';
import { mapLimit, useResource } from './hooks';
import { useAdminNavigation } from './navigation';
import { Loading, Notice, SectionTabs, Shell, Unavailable, invalidateOrganization, td, th, toneForStatus } from './ui';

type Tab = 'status' | 'connectors' | 'history' | 'external' | 'api' | 'webhooks';

/**
 * Integrations. CORECROW has no connector, credential, API-key or webhook registry yet, so those capabilities are shown as
 * blocked — never as inert controls. What is real and verifiable today is shown for real: the API's own health, the
 * datasets that data is imported into, and the import history per dataset.
 */
export function IntegrationsScreen({ organizationId }: { organizationId: string }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('status');
  return (
    <Shell title={t('adm2.int.title')} hint={t('adm2.int.hint')}>
      <SectionTabs
        label={t('adm.nav.integrations')} value={tab} onChange={setTab}
        tabs={[
          { id: 'status', label: t('adm2.int.tab.status'), icon: Heartbeat },
          { id: 'connectors', label: t('adm2.int.tab.connectors'), icon: Database },
          { id: 'history', label: t('adm2.int.tab.history'), icon: ClockCounterClockwise },
          { id: 'external', label: t('adm2.int.tab.external'), icon: Plugs },
          { id: 'api', label: t('adm2.int.tab.api'), icon: Key },
          { id: 'webhooks', label: t('adm2.int.tab.webhooks'), icon: WebhooksLogo },
        ]}
      />
      {tab === 'status' ? <StatusTab /> : null}
      {tab === 'connectors' ? <ConnectorsTab organizationId={organizationId} /> : null}
      {tab === 'history' ? <HistoryTab organizationId={organizationId} /> : null}
      {tab === 'external' ? <Unavailable title={t('adm2.int.tab.external')} body={t('adm2.int.external.body')} needs={t('adm2.int.external.needs')} /> : null}
      {tab === 'api' ? <Unavailable title={t('adm2.int.tab.api')} body={t('adm2.int.api.body')} needs={t('adm2.int.api.needs')} /> : null}
      {tab === 'webhooks' ? <Unavailable title={t('adm2.int.tab.webhooks')} body={t('adm2.int.webhooks.body')} needs={t('adm2.int.webhooks.needs')} /> : null}
    </Shell>
  );
}

function StatusTab() {
  const { t } = useI18n();
  const health = useResource(() => probeApiHealth(), []);
  const data = health.data;
  return (
    <DashboardCard title={t('adm2.int.status.title')} description={t('adm2.int.status.hint')} actions={<Button size="sm" variant="ghost" onClick={() => void health.reload()}><ArrowsClockwise className="size-3.5" />{t('access.refresh')}</Button>}>
      {health.status === 'loading' ? <Loading /> : (
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid size-10 place-items-center rounded-xl bg-surface-active text-text-secondary"><PlugsConnected className="size-5" /></div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text">CORECROW API</p>
            <p className="mono-data text-xs text-text-secondary">{data?.status ? `HTTP ${data.status}` : t('adm2.int.status.unreachable')} · {data?.latencyMs ?? '—'} ms</p>
          </div>
          <Status tone={data?.ok ? 'active' : 'error'}>{data?.ok ? t('adm2.int.status.up') : t('adm2.int.status.down')}</Status>
        </div>
      )}
    </DashboardCard>
  );
}

function ConnectorsTab({ organizationId }: { organizationId: string }) {
  const { t, locale } = useI18n();
  const go = useAdminNavigation();
  const datasets = useResource(() => listDatasets(organizationId), [organizationId]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [erasing, setErasing] = useState<DatasetSummary | null>(null);
  const toggleArchive = async (dataset: DatasetSummary) => {
    setBusyId(dataset.id); setMessage(null);
    try { await setDatasetStatus(organizationId, dataset.id, dataset.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED'); invalidateOrganization(organizationId); await datasets.reload(); }
    catch (error) { setMessage(error instanceof ApiError ? `${error.message}${error.requestId ? ` (${error.requestId})` : ''}` : t('adm2.ds.failed')); }
    finally { setBusyId(null); }
  };
  return (
    <>
    <DashboardCard title={t('adm2.int.connectors.title')} description={t('adm2.int.connectors.hint')} actions={<Button size="sm" variant="ghost" onClick={() => go('queries')}>{t('adm.nav.queries')}</Button>}>
      {datasets.status === 'loading' ? <Loading /> : datasets.status === 'forbidden' ? <Unavailable tone="forbidden" title={t('adm2.q.forbidden')} body={t('adm2.q.forbiddenBody')} /> : datasets.status === 'error' ? <Notice error={datasets.error} /> : (datasets.data ?? []).length === 0 ? <EmptyState icon={Database} title={t('adm2.q.noDatasets')} body={t('adm2.q.noDatasetsBody')} /> : (
        <ul className="divide-y divide-border/60">
          {(datasets.data ?? []).map((dataset) => (
            <li key={dataset.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0"><p className="truncate text-sm font-medium text-text">{localName(dataset.name, locale)}</p><p className="mono-data truncate text-[11px] text-text-muted">{dataset.slug}</p></div>
              <span className="shrink-0 text-xs text-text-secondary max-sm:hidden">{t('adm2.int.connectors.manual')}</span>
              <Status tone={toneForStatus(dataset.status)}>{dataset.status}</Status>
              <span className="inline-flex shrink-0 gap-1">
                <Button size="sm" variant="ghost" disabled={busyId === dataset.id} onClick={() => void toggleArchive(dataset)}>{dataset.status === 'ARCHIVED' ? t('adm2.ds.restore') : t('adm2.ds.archive')}</Button>
                {dataset.status === 'ARCHIVED' ? <Button size="sm" variant="ghost" onClick={() => setErasing(dataset)}>{t('adm2.ds.erase')}</Button> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      {message ? <p role="alert" className="mt-2 text-xs text-error">{message}</p> : null}
    </DashboardCard>
    <EraseDatasetDialog organizationId={organizationId} dataset={erasing} onClose={() => setErasing(null)} onDone={() => { invalidateOrganization(organizationId); void datasets.reload(); }} />
    </>
  );
}

/** Permanent erase: shows what still depends on the dataset and asks for its exact slug. */
function EraseDatasetDialog({ organizationId, dataset, onClose, onDone }: { organizationId: string; dataset: DatasetSummary | null; onClose: () => void; onDone: () => void }) {
  const { t, locale } = useI18n();
  const [deps, setDeps] = useState<DatasetDependencies | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = dataset?.id;
  useEffect(() => {
    setDeps(null); setTyped(''); setError(null);
    if (!id) return;
    let live = true;
    getDatasetDependencies(organizationId, id).then((value) => { if (live) setDeps(value); }).catch((reason) => { if (live) setError(reason instanceof ApiError ? reason.message : t('adm2.ds.failed')); });
    return () => { live = false; };
  }, [id, organizationId, t]);
  const blocked = Boolean(deps && (deps.bindings > 0 || deps.runningImports > 0));
  const confirm = async () => {
    if (!dataset) return;
    setBusy(true); setError(null);
    try { await eraseDataset(organizationId, dataset.id); onDone(); onClose(); }
    catch (reason) { setError(reason instanceof ApiError ? `${reason.message}${reason.requestId ? ` (${reason.requestId})` : ''}` : t('adm2.ds.failed')); }
    finally { setBusy(false); }
  };
  return (
    <ConfirmDialog open={Boolean(dataset)} destructive busy={busy} disabled={!deps || blocked || typed !== dataset?.slug} error={error}
      title={t('adm2.ds.eraseTitle', { name: dataset ? localName(dataset.name, locale) : '' })} description={t('adm2.ds.eraseBody')} confirmLabel={t('adm2.ds.erase')} onCancel={onClose} onConfirm={() => void confirm()}>
      {deps ? <p className="text-sm text-text-secondary" role="status">{blocked ? t('adm2.ds.blocked', { bindings: deps.bindings, panels: deps.panels, imports: deps.runningImports }) : t('adm2.ds.free')}</p> : <Loading />}
      <label className="mt-3 block text-xs text-text-secondary">{t('adm2.ds.typeSlug', { slug: dataset?.slug ?? '' })}
        <Input className="mt-1" value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" spellCheck={false} />
      </label>
    </ConfirmDialog>
  );
}

type HistoryRow = { dataset: DatasetSummary; item: DatasetImport };

function HistoryTab({ organizationId }: { organizationId: string }) {
  const { t, locale } = useI18n();
  const [days, setDays] = useState(30);
  const [purgeNote, setPurgeNote] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);
  const [preview, setPreview] = useState<{ total: number } | null>(null);
  const history = useResource(async () => {
    const datasets = (await listDatasets(organizationId)).slice(0, 12);
    const batches = await mapLimit(datasets, 4, async (dataset) => ({ dataset, imports: await listDatasetImports(organizationId, dataset.id).catch(() => [] as DatasetImport[]) }));
    return batches.flatMap(({ dataset, imports }) => imports.map((item): HistoryRow => ({ dataset, item }))).sort((a, b) => b.item.createdAt.localeCompare(a.item.createdAt));
  }, [organizationId]);
  // Operational housekeeping across the datasets in view: preview first, then purge. Imports that produced data are never touched.
  const runPurge = async (dryRun: boolean) => {
    setPurging(true); setPurgeNote(null);
    try {
      const datasets = await listDatasets(organizationId);
      const results = await mapLimit(datasets, 4, (dataset) => purgeDatasetImports(organizationId, dataset.id, { olderThanDays: days, dryRun }).catch(() => ({ matched: 0, purged: 0, dryRun })));
      const total = results.reduce((sum, result) => sum + (dryRun ? result.matched : result.purged), 0);
      if (dryRun) setPreview({ total }); else { setPreview(null); setPurgeNote(t('adm2.hist.purged', { n: total })); invalidateOrganization(organizationId); void history.reload(); }
    } catch (error) { setPurgeNote(error instanceof ApiError ? error.message : t('adm2.ds.failed')); }
    finally { setPurging(false); }
  };
  return (
    <DashboardCard title={t('adm2.int.history.title')} description={t('adm2.int.history.hint')} actions={<Button size="sm" variant="ghost" onClick={() => { invalidateOrganization(organizationId); void history.reload(); }}><ArrowsClockwise className="size-3.5" />{t('access.refresh')}</Button>}>
      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface-hover/40 p-2">
        <label className="text-xs text-text-secondary">{t('adm2.hist.olderThan')}
          <Input className="mt-1 w-24" type="number" min={0} max={3650} value={days} onChange={(event) => { setDays(Math.max(0, Math.min(3650, Number(event.target.value) || 0))); setPreview(null); }} />
        </label>
        <Button size="sm" variant="secondary" loading={purging} onClick={() => void runPurge(true)}>{t('adm2.hist.preview')}</Button>
        {preview ? <Button size="sm" variant="destructive" disabled={purging || preview.total === 0} onClick={() => void runPurge(false)}>{t('adm2.hist.purge', { n: preview.total })}</Button> : null}
        <p className="min-w-0 flex-1 text-xs text-text-muted" role="status">{purgeNote ?? t('adm2.hist.note')}</p>
      </div>
      {history.status === 'loading' ? <Loading /> : history.status === 'forbidden' ? <Unavailable tone="forbidden" title={t('adm2.q.forbidden')} body={t('adm2.q.forbiddenBody')} /> : history.status === 'error' ? <Notice error={history.error} /> : (history.data ?? []).length === 0 ? <EmptyState icon={ClockCounterClockwise} title={t('adm2.int.history.empty')} /> : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full border-separate border-spacing-0">
            <thead><tr><th className={th}>{t('adm.col.when')}</th><th className={th}>{t('adm2.q.dataset')}</th><th className={th}>{t('adm2.int.history.import')}</th><th className={th}>{t('access.col.status')}</th></tr></thead>
            <tbody>{(history.data ?? []).map(({ dataset, item }) => (
              <tr key={item.id}>
                <td className={`${td} whitespace-nowrap`}>{new Date(item.createdAt).toLocaleString(locale)}</td>
                <td className={td}>{localName(dataset.name, locale)}</td>
                <td className={`${td} mono-data`}>{typeof item.filename === 'string' ? item.filename : item.id.slice(0, 8)}</td>
                <td className={td}><Status tone={toneForStatus(item.status)}>{item.status}</Status></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </DashboardCard>
  );
}
