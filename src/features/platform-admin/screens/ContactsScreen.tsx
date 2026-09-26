import { listContacts, type ContactRequest } from '@/lib/platformAdmin';
import { useI18n } from '@/lib/i18n';
import { ResourceFailure, useResource } from '../resource';
import { PlatformTable, type PlatformColumn } from '../components/PlatformTable';
import { formatDate } from '../format';

/** Contact requests inbox (§16).
 *
 * Consumes the existing `GET /v1/contact` contract and renders only the fields
 * it declares — no status or delivery field is invented client-side. */
export function ContactsScreen() {
  const { t, locale } = useI18n();
  const contacts = useResource(() => listContacts(50), []);

  const columns: PlatformColumn<ContactRequest>[] = [
    {
      key: 'sender',
      header: t('pa.col.sender'),
      render: (row) => (
        <span className="block">
          <span className="block text-text">{row.name}</span>
          <span className="block text-xs text-text-muted">{row.email}</span>
        </span>
      ),
    },
    {
      key: 'organization',
      header: t('pa.col.organization'),
      render: (row) => (
        <span className="block">
          {row.organization}
          <span className="block text-xs text-text-muted">{row.country}</span>
        </span>
      ),
    },
    { key: 'project', header: t('pa.col.project'), render: (row) => <BadgeText>{row.project}</BadgeText> },
    { key: 'locale', header: t('pa.col.locale'), render: (row) => row.locale },
    {
      key: 'message',
      header: t('pa.col.message'),
      render: (row) => <span className="line-clamp-2 max-w-96 whitespace-normal text-xs">{row.message}</span>,
    },
    { key: 'created', header: t('pa.col.created'), render: (row) => formatDate(row.createdAt, locale) },
  ];

  return (
    <PlatformTable
      label={t('pa.contacts.title')}
      columns={columns}
      rows={contacts.data ?? []}
      getRowKey={(row) => row.id}
      loading={contacts.status === 'loading'}
      error={contacts.status === 'failed' && contacts.error ? <ResourceFailure error={contacts.error} onRetry={contacts.reload} /> : undefined}
      emptyTitle={t('pa.contacts.emptyTitle')}
      emptyBody={t('pa.contacts.emptyBody')}
      onLoadMore={undefined}
      hasMore={false}
    />
  );
}

function BadgeText({ children }: { children: string }) {
  return <span className="inline-block rounded bg-surface-hover px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">{children}</span>;
}
