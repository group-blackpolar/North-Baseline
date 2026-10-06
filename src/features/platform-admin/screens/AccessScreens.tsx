import { useState } from 'react';
import { Key, MagnifyingGlass, ShieldCheck } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { listPlatformTemplates, listPlatformUsers, listUserNorthCapabilities, type PlatformTemplate, type PlatformUser } from '@/lib/platformAdmin';
import { useI18n } from '@/lib/i18n';
import { ResourceFailure, useCursorList, useResource } from '../resource';
import { PlatformTable, type PlatformColumn } from '../components/PlatformTable';
import { formatDate } from '../format';

/** Global NORTH capabilities (§18). Read-only in 11P-B: granting and revoking
 * are 11P-C actions. CORECROW stays the only authority on RBAC. */
export function PermissionsScreen() {
  const { t, locale } = useI18n();
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<PlatformUser | null>(null);

  const candidates = useCursorList<PlatformUser>(
    (cursor) => listPlatformUsers({ q: query || undefined, cursor: cursor ?? undefined }),
    [query]
  );
  const capabilities = useResource(() => (selected ? listUserNorthCapabilities(selected.id) : Promise.resolve([])), [selected?.id]);

  return (
    <div className="space-y-4">
      <form
        className="np-card px-3 py-2 flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(draft.trim());
        }}
      >
        <MagnifyingGlass className="h-4 w-4 text-text-muted" />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t('pa.permissions.searchPlaceholder')}
          aria-label={t('pa.permissions.search')}
          className="h-8 min-w-52 flex-1 rounded-md border border-border bg-background px-2 text-sm text-text outline-none focus-visible:border-accent"
        />
        <button type="submit" className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover">
          {t('pa.permissions.search')}
        </button>
      </form>

      {query && (
        <PlatformTable
          label={t('pa.permissions.title')}
          columns={[
            {
              key: 'user',
              header: t('pa.col.name'),
              render: (row: PlatformUser) => (
                <button
                  type="button"
                  onClick={() => setSelected(row)}
                  className={`text-left font-medium hover:underline ${selected?.id === row.id ? 'text-accent' : 'text-text'}`}
                >
                  {row.name ?? row.email}
                  <span className="block text-xs font-normal text-text-muted">{row.email}</span>
                </button>
              ),
            },
            { key: 'role', header: t('pa.col.role'), render: (row: PlatformUser) => <Badge>{row.role}</Badge> },
            { key: 'status', header: t('pa.col.status'), render: (row: PlatformUser) => row.status },
          ]}
          rows={candidates.items}
          getRowKey={(row) => row.id}
          loading={candidates.loading}
          error={candidates.error ? <ResourceFailure error={candidates.error} onRetry={candidates.reload} /> : undefined}
          emptyTitle={t('pa.permissions.emptyTitle')}
          emptyBody={t('pa.permissions.emptyBody')}
          hasMore={candidates.hasMore}
          loadingMore={candidates.loadingMore}
          onLoadMore={candidates.loadMore}
        />
      )}

      {selected && (
        <section className="np-card space-y-3">
          <header className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-display font-semibold text-text">
                <Key className="mr-1.5 inline h-4 w-4 text-accent" />
                {selected.name ?? selected.email}
              </p>
              <p className="text-xs text-text-secondary">{t('pa.permissions.note')}</p>
            </div>
            <button type="button" onClick={() => setSelected(null)} className="rounded-md border border-border px-2 py-1 text-xs text-text-secondary hover:bg-surface-hover">
              {t('pa.close')}
            </button>
          </header>
          {capabilities.status === 'loading' && <div className="h-16 animate-pulse rounded-lg bg-surface-hover" />}
          {capabilities.status === 'failed' && capabilities.error && <ResourceFailure error={capabilities.error} onRetry={capabilities.reload} />}
          {capabilities.status === 'ready' && (
            <ul className="flex flex-wrap gap-2">
              {(capabilities.data ?? []).map((grant) => (
                <li key={grant.capability} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs">
                  <ShieldCheck className="h-3.5 w-3.5 text-success" />
                  <span className="mono-data">{grant.capability}</span>
                  <span className="text-text-muted">{formatDate(grant.createdAt, locale)}</span>
                </li>
              ))}
              {(capabilities.data ?? []).length === 0 && <li className="text-xs text-text-muted">{t('pa.permissions.none')}</li>}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

/** Global template catalog (§19). Read-only in 11P-B: creating and versioning
 * templates remain 11P-C actions. */
export function TemplatesScreen() {
  const { t, locale } = useI18n();
  const templates = useResource(() => listPlatformTemplates(), []);

  const columns: PlatformColumn<PlatformTemplate>[] = [
    {
      key: 'name',
      header: t('pa.col.name'),
      render: (row) => row.name[locale] ?? row.name.en ?? Object.values(row.name)[0] ?? row.slug,
    },
    { key: 'slug', header: t('pa.col.slug'), render: (row) => <span className="mono-data text-xs">{row.slug}</span> },
    { key: 'version', header: t('pa.col.version'), render: (row) => `v${row.currentVersion}` },
    { key: 'status', header: t('pa.col.status'), render: (row) => <Badge>{row.status}</Badge> },
    { key: 'created', header: t('pa.col.created'), render: (row) => formatDate(row.createdAt, locale) },
    { key: 'updated', header: t('pa.col.updated'), render: (row) => formatDate(row.updatedAt, locale) },
  ];

  return (
    <PlatformTable
      label={t('pa.templates.title')}
      columns={columns}
      rows={templates.data ?? []}
      getRowKey={(row) => row.id}
      loading={templates.status === 'loading'}
      error={templates.status === 'failed' && templates.error ? <ResourceFailure error={templates.error} onRetry={templates.reload} /> : undefined}
      emptyTitle={t('pa.templates.emptyTitle')}
      emptyBody={t('pa.templates.emptyBody')}
      hasMore={false}
    />
  );
}
