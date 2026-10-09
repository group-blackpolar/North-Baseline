import { useState } from 'react';
import { ArrowsClockwise, Database, Heartbeat, Plugs, PlugsConnected, WebhooksLogo, ClockCounterClockwise, Key } from '@phosphor-icons/react';
import { DashboardCard } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Status } from '@/components/ui/status';
import { useI18n } from '@/lib/i18n';
import { localName } from '@/features/views/workspace/resources';
import { listDatasetImports, listDatasets, probeApiHealth, type DatasetImport, type DatasetSummary } from './api';
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
  return (
    <DashboardCard title={t('adm2.int.connectors.title')} description={t('adm2.int.connectors.hint')} actions={<Button size="sm" variant="ghost" onClick={() => go('queries')}>{t('adm.nav.queries')}</Button>}>
      {datasets.status === 'loading' ? <Loading /> : datasets.status === 'forbidden' ? <Unavailable tone="forbidden" title={t('adm2.q.forbidden')} body={t('adm2.q.forbiddenBody')} /> : datasets.status === 'error' ? <Notice error={datasets.error} /> : (datasets.data ?? []).length === 0 ? <EmptyState icon={Database} title={t('adm2.q.noDatasets')} body={t('adm2.q.noDatasetsBody')} /> : (
        <ul className="divide-y divide-border/60">
          {(datasets.data ?? []).map((dataset) => (
            <li key={dataset.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0"><p className="truncate text-sm font-medium text-text">{localName(dataset.name, locale)}</p><p className="mono-data truncate text-[11px] text-text-muted">{dataset.slug}</p></div>
              <span className="shrink-0 text-xs text-text-secondary">{t('adm2.int.connectors.manual')}</span>
              <Status tone={toneForStatus(dataset.status)}>{dataset.status}</Status>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

type HistoryRow = { dataset: DatasetSummary; item: DatasetImport };

function HistoryTab({ organizationId }: { organizationId: string }) {
  const { t, locale } = useI18n();
  const history = useResource(async () => {
    const datasets = (await listDatasets(organizationId)).slice(0, 12);
    const batches = await mapLimit(datasets, 4, async (dataset) => ({ dataset, imports: await listDatasetImports(organizationId, dataset.id).catch(() => [] as DatasetImport[]) }));
    return batches.flatMap(({ dataset, imports }) => imports.map((item): HistoryRow => ({ dataset, item }))).sort((a, b) => b.item.createdAt.localeCompare(a.item.createdAt));
  }, [organizationId]);
  return (
    <DashboardCard title={t('adm2.int.history.title')} description={t('adm2.int.history.hint')} actions={<Button size="sm" variant="ghost" onClick={() => { invalidateOrganization(organizationId); void history.reload(); }}><ArrowsClockwise className="size-3.5" />{t('access.refresh')}</Button>}>
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
