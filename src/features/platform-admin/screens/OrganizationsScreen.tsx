import { useState } from 'react';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getPlatformOrganization, listPlatformOrganizations, type PlatformOrganization, type PlatformOrganizationDetail } from '@/lib/platformAdmin';
import { useI18n } from '@/lib/i18n';
import { ResourceFailure, useCursorList, useResource } from '../resource';
import { PlatformTable, type PlatformColumn } from '../components/PlatformTable';
import { formatDate, formatMoney } from '../format';

/** Global organization table (§14). The `owner` column comes from CORECROW;
 * the client never derives ownership by walking memberships. */
export function OrganizationsScreen() {
  const { t, locale } = useI18n();
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const organizations = useCursorList<PlatformOrganization>(
    (cursor) => listPlatformOrganizations({ q: query || undefined, cursor: cursor ?? undefined }),
    [query]
  );
  const detail = useResource<PlatformOrganizationDetail | null>(
    async () => (selectedId ? getPlatformOrganization(selectedId) : null),
    [selectedId]
  );

  const columns: PlatformColumn<PlatformOrganization>[] = [
    {
      key: 'organization',
      header: t('pa.col.organization'),
      render: (row) => (
        <button type="button" onClick={() => setSelectedId(row.id)} className="text-left font-medium text-accent hover:underline">
          {row.name}
          <span className="block text-xs font-normal text-text-muted">/{row.slug}</span>
        </button>
      ),
    },
    {
      key: 'owner',
      header: t('pa.col.owner'),
      render: (row) =>
        row.owner ? (
          <span className="block">
            <span className="block text-text">{row.owner.name ?? '—'}</span>
            <span className="block text-xs text-text-muted">{row.owner.email}</span>
          </span>
        ) : (
          <span className="text-text-muted">{t('pa.noOwner')}</span>
        ),
    },
    { key: 'status', header: t('pa.col.status'), render: (row) => <span className={row.status === 'ACTIVE' ? 'text-success' : 'text-error'}>{row.status}</span> },
    { key: 'members', header: t('pa.col.members'), render: (row) => row.memberCount.toLocaleString(locale) },
    { key: 'groups', header: t('pa.col.groups'), render: (row) => row.groupCount.toLocaleString(locale) },
    {
      key: 'billing',
      header: t('pa.col.billing'),
      render: (row) => (row.billingStatus ? <Badge>{row.billingStatus}</Badge> : <span className="text-text-muted">—</span>),
    },
    { key: 'created', header: t('pa.col.created'), render: (row) => formatDate(row.createdAt, locale) },
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
        <Search className="h-4 w-4 text-text-muted" />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t('pa.orgs.searchPlaceholder')}
          aria-label={t('pa.orgs.search')}
          className="h-8 min-w-52 flex-1 rounded-md border border-border bg-background px-2 text-sm text-text outline-none focus-visible:border-accent"
        />
        <button type="submit" className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover">
          {t('pa.orgs.search')}
        </button>
      </form>

      {detail.status === 'ready' && detail.data && (
        <section className="np-card space-y-3">
          <header className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-display font-semibold text-text">{detail.data.name}</p>
              <p className="text-xs text-text-secondary">
                {t('pa.orgs.invitations')}: {detail.data.invitationCount} · {t('pa.orgs.groups')}: {detail.data.groups.length}
              </p>
            </div>
            <button type="button" onClick={() => setSelectedId(null)} className="rounded-md border border-border px-2 py-1 text-xs text-text-secondary hover:bg-surface-hover">
              {t('pa.close')}
            </button>
          </header>
          {detail.data.billingProfile && (
            <p className="text-xs text-text-secondary">
              {t('pa.col.billing')}: {detail.data.billingProfile.status} ·{' '}
              {formatMoney(detail.data.billingProfile.memberPriceMinor, detail.data.billingProfile.currency, locale)}
              {detail.data.billingProfile.billingEmail ? ` · ${detail.data.billingProfile.billingEmail}` : ''}
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {detail.data.groups.map((group) => (
              <div key={group.id} className="rounded-md border border-border px-3 py-2 text-xs">
                <p className="font-medium text-text">{group.name}</p>
                <p className="text-text-muted">
                  {group.memberCount} · {group.permissionCount}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
      {detail.status === 'failed' && detail.error && <ResourceFailure error={detail.error} onRetry={detail.reload} />}

      <PlatformTable
        label={t('pa.orgs.title')}
        columns={columns}
        rows={organizations.items}
        getRowKey={(row) => row.id}
        loading={organizations.loading}
        error={organizations.error ? <ResourceFailure error={organizations.error} onRetry={organizations.reload} /> : undefined}
        emptyTitle={t('pa.orgs.emptyTitle')}
        emptyBody={t('pa.orgs.emptyBody')}
        hasMore={organizations.hasMore}
        loadingMore={organizations.loadingMore}
        onLoadMore={organizations.loadMore}
      />
    </div>
  );
}
