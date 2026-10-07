import { useState } from 'react';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { Plus, SealCheck } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Icon } from '@/components/ui/icon';
import { useNotifications } from '@/context/NotificationContext';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AuidPanel } from '../components/AuidPanel';
import { deletePlatformUser, getPlatformUser, listPlatformUsers, setPlatformUserStatus, verifyPlatformUserEmail, type PlatformUser, type PlatformUserDetail } from '@/lib/platformAdmin';
import { useI18n } from '@/lib/i18n';
import { CreateAccountDialog } from '../components/CreateAccountDialog';
import { ResourceFailure, useCursorList, useResource } from '../resource';
import { PlatformTable, type PlatformColumn } from '../components/PlatformTable';
import { formatDate } from '../format';

/** Global identity table with server-side search and cursor pagination (§13).
 *
 * Superadmins (`canManage`) can create verified accounts with an assigned
 * password and verify pending ones; CORECROW authorizes both calls. */
export function UsersScreen({ canManage = false }: { canManage?: boolean }) {
  const { t, locale } = useI18n();
  const { push } = useNotifications();
  const [createOpen, setCreateOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<PlatformUserDetail | null>(null);
  const [reason, setReason] = useState('');
  const [changing, setChanging] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PlatformUserDetail | null>(null);
  const [typedEmail, setTypedEmail] = useState('');
  const [deleting, setDeleting] = useState(false);

  const users = useCursorList<PlatformUser>(
    (cursor) => listPlatformUsers({ q: query || undefined, cursor: cursor ?? undefined }),
    [query]
  );
  const detail = useResource<PlatformUserDetail | null>(
    async () => (selectedId ? getPlatformUser(selectedId) : null),
    [selectedId]
  );

  const verify = async (id: string) => {
    setVerifying(true);
    try {
      const user = await verifyPlatformUserEmail(id);
      push({ type: 'success', title: t('pa.users.verified'), body: user.email });
      detail.reload();
      users.reload();
    } catch (reason) {
      push({ type: 'error', title: t('pa.users.verifyFailed'), body: reason instanceof Error ? reason.message : undefined });
    } finally {
      setVerifying(false);
    }
  };

  const changeStatus = async () => {
    if (!statusTarget) return;
    const suspending = statusTarget.status === 'ACTIVE';
    setChanging(true);
    try {
      await setPlatformUserStatus(statusTarget.id, suspending ? 'SUSPENDED' : 'ACTIVE', reason.trim() || undefined);
      push({ type: 'success', title: t(suspending ? 'adm.pa.banned' : 'adm.pa.unbanned'), body: statusTarget.email });
      setStatusTarget(null); setReason('');
      detail.reload(); users.reload();
    } catch (failure) {
      push({ type: 'error', title: failure instanceof Error ? failure.message : 'Request failed' });
    } finally { setChanging(false); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePlatformUser(deleteTarget.id);
      push({ type: 'success', title: t('adm.pa.deleted'), body: deleteTarget.email });
      setDeleteTarget(null); setTypedEmail(''); setSelectedId(null);
      users.reload();
    } catch (failure) {
      push({ type: 'error', title: failure instanceof Error ? failure.message : 'Request failed' });
    } finally { setDeleting(false); }
  };

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
    { key: 'orgs', header: t('adm.col.orgs'), render: (row) => (row.organizationCount ?? 0).toLocaleString(locale) },
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
        {canManage && (
          <IconButton label={t('pa.create.open')} variant="accent" icon={<Plus size={18} weight="bold" />} className="md:ml-auto" onClick={() => setCreateOpen(true)} />
        )}
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
            <div className="flex shrink-0 items-center gap-2">
            {canManage && !detail.data.emailVerified && (
              <Button size="sm" variant="outline" loading={verifying} onClick={() => void verify(detail.data!.id)}>
                <Icon icon={SealCheck} size="sm" />{t('pa.users.verify')}
              </Button>
            )}
            {canManage && detail.data.role !== 'SUPERADMIN' && (
              <Button size="sm" variant={detail.data.status === 'ACTIVE' ? 'destructive' : 'outline'} onClick={() => { setReason(''); setStatusTarget(detail.data); }}>
                {detail.data.status === 'ACTIVE' ? t('adm.pa.ban') : t('adm.pa.unban')}
              </Button>
            )}
            {canManage && detail.data.role !== 'SUPERADMIN' && (
              <Button size="sm" variant="outline" onClick={() => { setTypedEmail(''); setDeleteTarget(detail.data); }}>{t('adm.pa.delete')}</Button>
            )}
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="rounded-md border border-border px-2 py-1 text-xs pointer-coarse:min-h-(--touch-min) text-text-secondary hover:bg-surface-hover"
            >
              {t('pa.close')}
            </button>
            </div>
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
          {(detail.data.role === 'ADMIN' || detail.data.role === 'SUPERADMIN') && <AuidPanel userId={detail.data.id} canManage={canManage} />}
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

      <ConfirmDialog open={Boolean(statusTarget)} destructive={statusTarget?.status === 'ACTIVE'} busy={changing}
        title={statusTarget?.status === 'ACTIVE' ? t('adm.pa.banTitle') : t('adm.pa.unbanTitle')}
        description={statusTarget?.status === 'ACTIVE' ? `${statusTarget.email} — ${t('adm.pa.banBody')}` : statusTarget?.email}
        confirmLabel={statusTarget?.status === 'ACTIVE' ? t('adm.pa.ban') : t('adm.pa.unban')}
        onCancel={() => setStatusTarget(null)} onConfirm={() => void changeStatus()}>
        {statusTarget?.status === 'ACTIVE' && <label className="block space-y-1"><span className="ui-label">{t('adm.pa.banReason')}</span><input value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:border-accent" /></label>}
      </ConfirmDialog>
      <ConfirmDialog open={Boolean(deleteTarget)} destructive busy={deleting} disabled={typedEmail.trim().toLowerCase() !== deleteTarget?.email.toLowerCase()}
        title={t('adm.pa.deleteTitle')} description={t('adm.pa.deleteBody')} confirmLabel={t('adm.pa.delete')}
        onCancel={() => setDeleteTarget(null)} onConfirm={() => void remove()}>
        <label className="block space-y-1"><span className="ui-label">{t('adm.pa.deleteType')}</span><input autoComplete="off" value={typedEmail} placeholder={deleteTarget?.email} onChange={(event) => setTypedEmail(event.target.value)} className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:border-accent" /></label>
      </ConfirmDialog>
      <CreateAccountDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => users.reload()} />

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
