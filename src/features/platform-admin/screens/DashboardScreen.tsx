import { Buildings, Clock, CreditCard, HardDrive, SealCheck, Stack, UserCheck, UserMinus, Users } from '@phosphor-icons/react';
import { MetricCard } from '@/components/dashboard/primitives';
import { DelayedSkeleton, SkeletonMetricCard } from '@/components/ui/skeleton';
import { getPlatformSummary } from '@/lib/platformAdmin';
import { useI18n } from '@/lib/i18n';
import { ResourceFailure, useResource } from '../resource';
import { formatBytes, formatMoney } from '../format';

/** Platform overview. It deliberately consumes only `GET /v1/platform/summary`
 * (§12): the dashboard must never enumerate full collections to count rows. */
export function DashboardScreen() {
  const { t, locale } = useI18n();
  const summary = useResource(() => getPlatformSummary(), []);

  // First load only (a refresh keeps the current numbers on screen): real-shape cards, shown only if it lasts.
  if (summary.status === 'loading' && !summary.data) {
    return (
      <DelayedSkeleton loading minHeight={200} fallback={<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <SkeletonMetricCard key={index} />)}</div>} />
    );
  }
  if (summary.status === 'failed' && summary.error) return <ResourceFailure error={summary.error} onRetry={summary.reload} />;
  const value = summary.data;
  if (!value) return null;

  return (
    <div className={`np-fade-in space-y-6 transition-opacity duration-(--duration-fast) ${summary.status === 'loading' ? 'opacity-60' : ''}`} aria-busy={summary.status === 'loading' || undefined}>
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-display font-semibold text-text">{t('pa.dashboard.users')}</h2>
          <button
            type="button"
            onClick={summary.reload}
            className="text-xs font-medium text-accent hover:underline pointer-coarse:min-h-(--touch-min)"
          >
            {t('pa.dashboard.refresh')}
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label={t('pa.kpi.usersTotal')} value={value.users.total.toLocaleString(locale)} icon={Users} />
          <MetricCard label={t('pa.kpi.usersActive')} value={value.users.active.toLocaleString(locale)} icon={UserCheck} />
          <MetricCard label={t('pa.kpi.usersSuspended')} value={value.users.suspended.toLocaleString(locale)} icon={UserMinus} />
          <MetricCard label={t('pa.kpi.usersVerified')} value={value.users.verified.toLocaleString(locale)} icon={SealCheck} />
          <MetricCard
            label={t('pa.kpi.usersNew')}
            value={value.users.createdLast7Days.toLocaleString(locale)}
            delta={`${t('pa.kpi.usersNew30')}: ${value.users.createdLast30Days.toLocaleString(locale)}`}
            icon={Clock}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-display font-semibold text-text">{t('pa.dashboard.organizations')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label={t('pa.kpi.orgsTotal')} value={value.organizations.total.toLocaleString(locale)} icon={Buildings} />
          <MetricCard label={t('pa.kpi.orgsActive')} value={value.organizations.active.toLocaleString(locale)} icon={UserCheck} />
          <MetricCard label={t('pa.kpi.orgsSuspended')} value={value.organizations.suspended.toLocaleString(locale)} icon={UserMinus} />
          <MetricCard
            label={t('pa.kpi.orgsNew30')}
            value={value.organizations.createdLast30Days.toLocaleString(locale)}
            icon={Clock}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-display font-semibold text-text">{t('pa.dashboard.activity')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label={t('pa.kpi.sessions')} value={value.sessions.active.toLocaleString(locale)} icon={Clock} />
          <MetricCard label={t('pa.kpi.memberships')} value={value.memberships.total.toLocaleString(locale)} icon={Stack} />
          <MetricCard
            label={t('pa.kpi.mrr')}
            value={formatMoney(value.billing.estimatedMonthlyMinor, value.billing.currency, locale)}
            icon={CreditCard}
          />
          <MetricCard
            label={t('pa.kpi.storageUsed')}
            value={formatBytes(value.storage.usedBytes, locale)}
            delta={`${t('pa.kpi.storageLimit')}: ${formatBytes(value.storage.limitBytes, locale)}`}
            icon={HardDrive}
          />
        </div>
      </section>

      <p className="text-xs text-text-muted">
        {t('pa.dashboard.generatedAt')}: {new Date(value.generatedAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'medium' })}
      </p>
    </div>
  );
}
