import { CreditCard } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/primitives';
import { Badge } from '@/components/ui/badge';
import { getPlatformBillingSummary } from '@/lib/platformAdmin';
import { useI18n } from '@/lib/i18n';
import { ResourceFailure, useResource } from '../resource';
import { formatMoney } from '../format';

/** Billing overview (§15): reuses `GET /v1/platform/billing/summary` and the
 * provider-neutral policy already served by CORECROW. Read-only in 11P-B. */
export function BillingScreen() {
  const { t, locale } = useI18n();
  const billing = useResource(() => getPlatformBillingSummary(), []);

  if (billing.status === 'loading') {
    return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="np-card h-[92px] animate-pulse" />)}</div>;
  }
  if (billing.status === 'failed' && billing.error) return <ResourceFailure error={billing.error} onRetry={billing.reload} />;
  const value = billing.data;
  if (!value) return null;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={t('pa.billing.mrr')} value={formatMoney(value.estimatedMonthlyMinor, value.currency, locale)} icon={CreditCard} />
        <MetricCard label={t('pa.billing.organizations')} value={value.organizationCount.toLocaleString(locale)} icon={CreditCard} />
        <MetricCard label={t('pa.billing.members')} value={value.billableMemberCount.toLocaleString(locale)} icon={CreditCard} />
        <MetricCard label={t('pa.billing.memberPrice')} value={formatMoney(value.memberPriceMinor, value.currency, locale)} icon={CreditCard} />
      </div>

      <section className="np-card space-y-3">
        <header>
          <h2 className="text-sm font-display font-semibold text-text">{t('pa.billing.policy')}</h2>
          <p className="text-xs text-text-secondary">
            {t('pa.billing.basePrice')}: {formatMoney(value.basePriceMinor, value.currency, locale)} ·{' '}
            {t('pa.billing.memberPrice')}: {formatMoney(value.memberPriceMinor, value.currency, locale)}
          </p>
        </header>
        <ul className="flex flex-wrap gap-2">
          {value.byStatus.map((entry) => (
            <li key={entry.status} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs">
              <Badge>{entry.status}</Badge>
              <span className="text-text-secondary">{entry.count.toLocaleString(locale)}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-text-muted">{t('pa.billing.scope')}: {value.byStatusScope}</p>
      </section>
    </div>
  );
}
