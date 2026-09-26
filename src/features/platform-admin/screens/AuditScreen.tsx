import { useState } from 'react';
import { Filter } from 'lucide-react';
import { listPlatformAudit, type PlatformAuditEvent, type PlatformAuditQuery } from '@/lib/platformAdmin';
import { useI18n } from '@/lib/i18n';
import { ResourceFailure, useCursorList } from '../resource';
import { PlatformTable, type PlatformColumn } from '../components/PlatformTable';
import { formatDateTime } from '../format';

const EMPTY: PlatformAuditQuery = { action: '', actorId: '', targetType: '', from: '', to: '' };

/** Global audit trail (§17). SUPERADMIN-only on the server; the screen keeps
 * server-side filtering and cursor pagination so large histories never load
 * into memory. */
export function AuditScreen() {
  const { t, locale } = useI18n();
  const [draft, setDraft] = useState<PlatformAuditQuery>(EMPTY);
  const [filters, setFilters] = useState<PlatformAuditQuery>(EMPTY);

  const audit = useCursorList<PlatformAuditEvent>(
    (cursor) =>
      listPlatformAudit({
        limit: 50,
        cursor: cursor ?? undefined,
        action: filters.action || undefined,
        actorId: filters.actorId || undefined,
        targetType: filters.targetType || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      }),
    [filters]
  );

  const field = (key: keyof PlatformAuditQuery, label: string, type: 'text' | 'date' = 'text') => (
    <label key={key} className="flex flex-col gap-1">
      <span className="ui-label">{label}</span>
      <input
        type={type}
        value={draft[key] ?? ''}
        onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
        className="h-8 rounded-md border border-border bg-background px-2 text-xs text-text outline-none focus-visible:border-accent"
      />
    </label>
  );

  const columns: PlatformColumn<PlatformAuditEvent>[] = [
    { key: 'timestamp', header: t('pa.col.timestamp'), render: (row) => formatDateTime(row.createdAt, locale) },
    { key: 'actor', header: t('pa.col.actor'), render: (row) => <span className="mono-data text-xs">{row.actorId ?? '—'}</span> },
    { key: 'action', header: t('pa.col.action'), render: (row) => <span className="font-medium text-text">{row.action}</span> },
    {
      key: 'target',
      header: t('pa.col.target'),
      render: (row) => (
        <span className="mono-data text-xs">{row.targetType ? `${row.targetType}${row.targetId ? ` · ${row.targetId}` : ''}` : '—'}</span>
      ),
    },
    { key: 'organization', header: t('pa.col.organization'), render: (row) => <span className="mono-data text-xs">{row.organizationId ?? '—'}</span> },
    {
      key: 'metadata',
      header: t('pa.col.metadata'),
      render: (row) =>
        row.metadata === null || row.metadata === undefined ? (
          <span className="text-text-muted">—</span>
        ) : (
          <span className="line-clamp-2 max-w-72 whitespace-normal font-mono text-[10px] text-text-secondary" title={JSON.stringify(row.metadata)}>
            {JSON.stringify(row.metadata)}
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <form
        className="np-card space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setFilters({ ...draft });
        }}
      >
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-text-muted" />
          <span className="text-sm font-medium text-text">{t('pa.audit.filters')}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {field('action', t('pa.audit.filterAction'))}
          {field('actorId', t('pa.audit.filterActor'))}
          {field('targetType', t('pa.audit.filterTarget'))}
          {field('from', t('pa.audit.filterFrom'), 'date')}
          {field('to', t('pa.audit.filterTo'), 'date')}
        </div>
        <div className="flex gap-2">
          <button type="submit" className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover">
            {t('pa.audit.apply')}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(EMPTY);
              setFilters(EMPTY);
            }}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover"
          >
            {t('pa.audit.clear')}
          </button>
        </div>
      </form>

      <PlatformTable
        label={t('pa.audit.title')}
        columns={columns}
        rows={audit.items}
        getRowKey={(row) => row.id}
        loading={audit.loading}
        error={audit.error ? <ResourceFailure error={audit.error} onRetry={audit.reload} /> : undefined}
        emptyTitle={t('pa.audit.emptyTitle')}
        emptyBody={t('pa.audit.emptyBody')}
        hasMore={audit.hasMore}
        loadingMore={audit.loadingMore}
        onLoadMore={audit.loadMore}
      />
    </div>
  );
}
