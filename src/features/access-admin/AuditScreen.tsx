import { useState } from 'react';
import { ClockCounterClockwise } from '@phosphor-icons/react';
import { DashboardCard } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useI18n } from '@/lib/i18n';
import { listAudit, type AuditEvent } from './api';
import { LoadError, Loading, Notice, Shell, errorText, td, th, useList } from './ui';

/** Organization audit trail (audit.read). Newest first, paged by timestamp. */
export function AuditScreen({ organizationId }: { organizationId: string }) {
  const { t, locale } = useI18n();
  const first = useList(() => listAudit(organizationId), [organizationId]);
  const [more, setMore] = useState<AuditEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const events = [...(first.data ?? []), ...more];
  const last = events.at(-1);

  const loadMore = async () => {
    if (!last) return;
    setBusy(true); setError(null);
    try { const page = await listAudit(organizationId, last.createdAt); setMore((current) => [...current, ...page]); }
    catch (reason) { setError(errorText(reason)); } finally { setBusy(false); }
  };
  const when = (value: string) => new Date(value).toLocaleString(locale);

  return (
    <Shell title={t('adm.audit.title')} hint={t('adm.audit.hint')}>
      <DashboardCard title={t('adm.audit.title')}>
        <LoadError list={first} />
        {first.loading && !first.data ? <Loading /> : first.data && events.length === 0 ? <EmptyState icon={ClockCounterClockwise} title={t('adm.audit.empty')} /> : first.data && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full border-separate border-spacing-0">
              <thead><tr><th className={th}>{t('adm.col.when')}</th><th className={th}>{t('adm.col.action')}</th><th className={th}>{t('adm.col.actor')}</th><th className={th}>{t('adm.col.target')}</th></tr></thead>
              <tbody>{events.map((event) => (
                <tr key={event.id} className="hover:bg-surface-hover/50">
                  <td className={`${td} whitespace-nowrap`}>{when(event.createdAt)}</td>
                  <td className={`${td} font-medium`}>{event.action}</td>
                  <td className={`${td} max-w-48 truncate mono-data`}>{event.actorId ?? '—'}</td>
                  <td className={`${td} max-w-64 truncate mono-data`}>{event.targetType ? `${event.targetType}${event.targetId ? ` · ${event.targetId}` : ''}` : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <Notice error={error} />
        {first.data && first.data.length >= 50 && <Button size="sm" variant="ghost" loading={busy} onClick={() => void loadMore()}>{t('adm.audit.more')}</Button>}
      </DashboardCard>
    </Shell>
  );
}
