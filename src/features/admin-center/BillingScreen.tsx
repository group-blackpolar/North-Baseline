import { useState, type FormEvent } from 'react';
import { ArrowsClockwise, Receipt } from '@phosphor-icons/react';
import { DashboardCard } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Status } from '@/components/ui/status';
import { usePermissions } from '@/context/PermissionContext';
import { useI18n } from '@/lib/i18n';
import { PERM } from '@/lib/permission';
import { formatMinor, getBilling, listEntitlements, listSubscriptions, updateBillingEmail } from './api';
import { useResource } from './hooks';
import { KeyValue, Loading, Notice, Shell, Unavailable, errorText, invalidateOrganization, td, th, toneForStatus } from './ui';

/**
 * Billing & Usage. Read-only view of CORECROW's billing account, subscriptions, invoices and entitlements, plus the one
 * write the contract offers: the billing contact. There is NO payment flow here (real collection is not implemented in
 * CORECROW); nothing is shown as paid/completed unless the backend says so.
 */
export function BillingScreen({ organizationId }: { organizationId: string }) {
  const { t, locale } = useI18n();
  const { can } = usePermissions();
  const billing = useResource(() => getBilling(organizationId), [organizationId]);
  const subscriptions = useResource(() => listSubscriptions(organizationId), [organizationId]);
  const entitlements = useResource(() => listEntitlements(organizationId), [organizationId]);
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const manage = can(PERM.billingManage);
  const account = billing.data;
  const invoices = (subscriptions.data ?? []).flatMap((subscription) => subscription.invoices.map((invoice) => ({ ...invoice, plan: subscription.planId }))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const day = (value: string) => new Date(value).toLocaleDateString(locale);
  const refresh = () => { invalidateOrganization(organizationId); void billing.reload(); void subscriptions.reload(); void entitlements.reload(); };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (email === null) return;
    setBusy(true); setError(null); setOk(null);
    try { await updateBillingEmail(organizationId, email.trim() || null); setOk(t('adm2.billing.saved')); setEmail(null); await billing.reload(); }
    catch (reason) { setError(errorText(reason)); } finally { setBusy(false); }
  };

  return (
    <Shell title={t('adm2.billing.title')} hint={t('adm2.billing.hint')}>
      <div className="flex justify-end"><Button size="sm" variant="ghost" onClick={refresh}><ArrowsClockwise className="size-3.5" />{t('access.refresh')}</Button></div>
      {billing.status === 'forbidden' ? <Unavailable tone="forbidden" title={t('adm2.billing.forbidden')} body={t('adm2.billing.forbiddenBody')} /> : (
        <>
          <div className="grid gap-4 xl:grid-cols-3">
            <DashboardCard title={t('adm2.billing.plan')} description={t('adm2.billing.planHint')} className="xl:col-span-1">
              {billing.status === 'loading' ? <Loading /> : !account ? <Notice error={billing.error} /> : (
                <dl>
                  <KeyValue label={t('access.col.status')}><Status tone={toneForStatus(account.status)}>{account.status}</Status></KeyValue>
                  <KeyValue label={t('adm2.billing.base')}>{formatMinor(account.basePriceMinor, account.currency, locale)}</KeyValue>
                  <KeyValue label={t('adm2.billing.perMember')}>{formatMinor(account.memberPriceMinor, account.currency, locale)}</KeyValue>
                  <KeyValue label={t('adm2.usage.billable')}>{account.billableMemberCount}</KeyValue>
                  <KeyValue label={t('adm2.billing.groups')}>{formatMinor(account.groupsCostMinor, account.currency, locale)}</KeyValue>
                  <KeyValue label={t('adm2.billing.estimate')}><strong>{formatMinor(account.estimatedMonthlyMinor, account.currency, locale)}</strong></KeyValue>
                  <KeyValue label={t('adm2.billing.since')}>{day(account.createdAt)}</KeyValue>
                </dl>
              )}
              <p className="text-[11px] text-text-muted">{t('adm2.billing.estimateNote')}</p>
            </DashboardCard>

            <DashboardCard title={t('adm2.billing.contact')} description={manage ? undefined : t('access.readOnly')} className="xl:col-span-1">
              <form onSubmit={(event) => void save(event)} className="space-y-3">
                <label className="block space-y-1">
                  <span className="ui-label">{t('adm2.billing.email')}</span>
                  <Input type="email" disabled={!manage || busy || !account} value={email ?? account?.billingEmail ?? ''} onChange={(event) => setEmail(event.target.value)} autoComplete="off" />
                </label>
                <div className="flex items-center gap-3"><Button type="submit" variant="accent" loading={busy} disabled={!manage || email === null}>{t('adm.settings.save')}</Button><Notice error={error} ok={ok} /></div>
              </form>
            </DashboardCard>

            <DashboardCard title={t('adm2.billing.limits')} description={t('adm2.billing.limitsHint')} className="xl:col-span-1">
              <Unavailable title={t('adm2.billing.quotas')} body={t('adm2.billing.quotasBody')} needs={t('adm2.billing.quotasNeeds')} />
            </DashboardCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <DashboardCard title={t('adm2.billing.entitlements')} description={t('adm2.billing.entitlementsHint')}>
              {entitlements.status === 'loading' ? <Loading /> : entitlements.status !== 'ready' ? <Notice error={entitlements.status === 'forbidden' ? t('adm2.kpi.forbidden') : entitlements.error} /> : (entitlements.data ?? []).length === 0 ? <EmptyState icon={Receipt} title={t('adm2.billing.noEntitlements')} /> : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead><tr><th className={th}>{t('adm2.billing.product')}</th><th className={th}>{t('adm2.billing.feature')}</th><th className={th}>{t('adm2.billing.expires')}</th><th className={th}>{t('access.col.status')}</th></tr></thead>
                    <tbody>{(entitlements.data ?? []).map((item) => (
                      <tr key={item.id}><td className={td}>{item.productCode}</td><td className={td}>{item.feature}</td><td className={td}>{day(item.expiresAt)}</td><td className={td}><Status tone={item.revokedAt || Date.parse(item.expiresAt) < Date.now() ? 'error' : 'active'}>{item.revokedAt ? t('adm2.billing.revoked') : Date.parse(item.expiresAt) < Date.now() ? t('adm2.billing.expired') : t('adm2.billing.valid')}</Status></td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </DashboardCard>

            <DashboardCard title={t('adm2.billing.history')} description={t('adm2.billing.historyHint')}>
              {subscriptions.status === 'loading' ? <Loading /> : subscriptions.status !== 'ready' ? <Notice error={subscriptions.status === 'forbidden' ? t('adm2.kpi.forbidden') : subscriptions.error} /> : invoices.length === 0 ? <EmptyState icon={Receipt} title={t('adm2.billing.noInvoices')} body={t('adm2.billing.noInvoicesBody')} /> : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead><tr><th className={th}>{t('adm.col.when')}</th><th className={th}>{t('adm2.billing.plan')}</th><th className={th}>{t('adm2.billing.amount')}</th><th className={th}>{t('access.col.status')}</th></tr></thead>
                    <tbody>{invoices.map((invoice) => (
                      <tr key={invoice.id}><td className={td}>{day(invoice.createdAt)}</td><td className={td}>{invoice.plan}</td><td className={td}>{formatMinor(invoice.amountMinor, invoice.currency, locale)}</td><td className={td}><Status tone={toneForStatus(invoice.status)}>{invoice.status}</Status></td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </DashboardCard>
          </div>
        </>
      )}
    </Shell>
  );
}
