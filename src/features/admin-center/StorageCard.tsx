import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { intlTag } from '@/lib/intlTag';
import { formatBytes } from '@/features/platform-admin/format';
import { getStorage } from './api';
import { useResource } from './hooks';
import { Loading, Notice } from './ui';

/** Storage of the organization against its limit (assets and dataset import files), straight from CORECROW. */
export function StorageCard({ organizationId, reloadKey = 0 }: { organizationId: string; reloadKey?: number }) {
  const { t, locale } = useI18n();
  const tag = intlTag(locale);
  const storage = useResource(() => getStorage(organizationId), [organizationId, reloadKey]);
  const data = storage.data;
  if (storage.status === 'loading' && !data) return <Loading />;
  if (!data) return <Notice error={storage.error} />;
  const limit = Number(data.limitBytes);
  const used = Number(data.usedBytes);
  const ratio = limit > 0 ? Math.min(1, used / limit) : 0;
  const percent = new Intl.NumberFormat(tag, { maximumFractionDigits: 1 }).format(ratio * 100);
  const tone = ratio >= 0.95 ? 'bg-error' : ratio >= 0.8 ? 'bg-warning' : 'bg-accent';
  const rows: Array<[string, string]> = [
    [t('adm.storage.assets'), data.assetBytes],
    [t('adm.storage.imports'), data.importBytes],
    ...(Number(data.reservedBytes) > 0 ? [[t('adm.storage.reserved'), data.reservedBytes] as [string, string]] : []),
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-2xl font-semibold tabular-nums text-text">{formatBytes(data.usedBytes, tag)}</p>
        <p className="text-xs text-text-secondary">{t('adm.storage.of', { limit: formatBytes(data.limitBytes, tag) })}</p>
      </div>
      <div role="progressbar" aria-label={t('adm.storage.title')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)} className="h-2.5 overflow-hidden rounded-full bg-surface-active">
        <div className={cn('h-full rounded-full transition-[width] duration-(--duration-slow) motion-reduce:transition-none', tone)} style={{ width: `${Math.max(ratio > 0 ? 1.5 : 0, ratio * 100)}%` }} />
      </div>
      <p className="text-xs text-text-secondary">{t('adm.storage.percent', { percent, free: formatBytes(String(Math.max(0, limit - used)), tag) })}</p>
      <dl className="divide-y divide-border/60 text-xs">
        {rows.map(([label, bytes]) => <div key={label} className="flex items-center justify-between py-1.5"><dt className="text-text-secondary">{label}</dt><dd className="tabular-nums text-text">{formatBytes(bytes, tag)}</dd></div>)}
        {data.byCategory.map((row) => <div key={row.category} className="flex items-center justify-between py-1.5 pl-3"><dt className="text-text-muted">{t(`adm.storage.cat.${row.category}` as 'adm.storage.cat.image')} · {row.count}</dt><dd className="tabular-nums text-text-secondary">{formatBytes(row.bytes, tag)}</dd></div>)}
      </dl>
      {ratio >= 0.9 ? <p role="alert" className="text-xs text-error">{t('adm.storage.nearLimit')}</p> : null}
    </div>
  );
}
