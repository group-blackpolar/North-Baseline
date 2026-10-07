import { useState } from 'react';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { getPlatformUser, listPlatformUsers, type PlatformUser, type PlatformUserDetail } from '@/lib/platformAdmin';
import { useI18n } from '@/lib/i18n';
import { ResourceFailure, useCursorList, useResource } from '../resource';
import { PlatformTable, type PlatformColumn } from '../components/PlatformTable';
import { formatDate } from '../format';

/** Global identity table with server-side search and cursor pagination (§13).
 *
 * Read-only: suspension and pre-provisioning are 11P-C actions and are not
 * reachable from this screen. */
export function UsersScreen() {
  const { t, locale } = useI18n();
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const users = useCursorList<PlatformUser>(
    (cursor) => listPlatformUsers({ q: query || undefined, cursor: cursor ?? undefined }),
    [query]
  );
  const detail = useResource<PlatformUserDetail | null>(
    async () => (selectedId ? getPlatformUser(selectedId) : null),
    [selectedId]
  );

  const columns: PlatformColumn<PlatformUser>[] = [
    {
      key: 'name',
      header: t('pa.col.name'),
      render: (row) => (
        <button
          type="button"
          onClick={() => setSelectedId(row.id)}
          className="text-left font-medium text-accent hover:underline pointer-coarse:min-h-(--touch-min)"
        >
          {row.name ?? '—'}
        </button>
      ),
    },
    { key: 'email', header: t('pa.col.email') },
    { key: 'role', header: t('pa.col.role'), render: (row) => <Badge>{row.role}</Badge> },
    {
      key: 'status',
      header: t('pa.col.status'),
      render: (row) => (
        <span className={row.status === 'ACTIVE' ? 'text-success' : 'text-error'}>{row.status}</span>
      ),
    },
    { key: 'verified', header: t('pa.col.verified'), render: (row) => (row.emailVerified ? t('pa.yes') : t('pa.no')) },
    { key: 'created', header: t('pa.col.created'), render: (row) => formatDate(row.createdAt, locale) },
    {
      key: 'terms',
      header: t('pa.col.terms'),
      render: (row) =>
        row.termsAcceptedAt ? `${row.termsVersion ?? '—'} · ${formatDate(row.termsAcceptedAt, locale)}` : t('pa.no'),
    },
  ];

  return (
    <div className="space-y-4">
      <form
        className="np-card px-3 py-2 flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(draft.trim());
          setSelectedId(null);
        }}
      >
        <MagnifyingGlass className="h-4 w-4 text-text-muted" />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t('pa.users.searchPlaceholder')}
          aria-label={t('pa.users.search')}
          className="h-8 pointer-coarse:h-(--touch-min) min-w-52 flex-1 rounded-md border border-border bg-background px-2 text-base md:text-sm text-text outline-none focus-visible:border-accent"
        />
        <button type="submit" className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover pointer-coarse:min-h-(--touch-min)">
          {t('pa.users.search')}
        </button>
        {query && (
          <button
            type="button"
            onClick={() => {
              setDraft('');
              setQuery('');
              setSelectedId(null);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs text-text-secondary hover:bg-surface-hover"
          >
            <X className="h-3.5 w-3.5" />
            {t('pa.users.clear')}
          </button>
        )}
      </form>

      {detail.status === 'ready' && detail.data && (
        <section className="np-card space-y-3">
          <header className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-display font-semibold text-text">{detail.data.name ?? detail.data.email}</p>
              <p className="text-xs text-text-secondary">{detail.data.email}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="rounded-md border border-border px-2 py-1 text-xs pointer-coarse:min-h-(--touch-min) text-text-secondary hover:bg-surface-hover"
            >
              {t('pa.close')}
            </button>
          </header>
          <div className="grid gap-2 text-xs sm:grid-cols-3">
            <p className="text-text-secondary">
              {t('pa.col.role')}: <span className="text-text">{detail.data.role}</span>
            </p>
            <p className="text-text-secondary">
              {t('pa.col.status')}: <span className="text-text">{detail.data.status}</span>
            </p>
            <p className="text-text-secondary">
              {t('pa.col.created')}: <span className="text-text">{formatDate(detail.data.createdAt, locale)}</span>
            </p>
          </div>
          <div>
            <p className="ui-label pb-2">{t('pa.users.memberships')}</p>
            {detail.data.memberships.length === 0 ? (
              <p className="text-xs text-text-muted">{t('pa.users.noMemberships')}</p>
            ) : (
              <ul className="space-y-1">
                {detail.data.memberships.map((membership) => (
                  <li
                    key={membership.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs"
                  >
                    <span className="font-medium text-text">{membership.organization.name}</span>
                    <span className="text-text-secondary">/{membership.organization.slug}</span>
                    <Badge>{membership.role}</Badge>
                    <span className="text-text-muted">{formatDate(membership.createdAt, locale)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
      {detail.status === 'failed' && detail.error && <ResourceFailure error={detail.error} onRetry={detail.reload} />}

      <PlatformTable
        label={t('pa.users.title')}
        columns={columns}
        rows={users.items}
        getRowKey={(row) => row.id}
        loading={users.loading}
        error={users.error ? <ResourceFailure error={users.error} onRetry={users.reload} /> : undefined}
        emptyTitle={t('pa.users.emptyTitle')}
        emptyBody={t('pa.users.emptyBody')}
        hasMore={users.hasMore}
        loadingMore={users.loadingMore}
        onLoadMore={users.loadMore}
      />
    </div>
  );
}
