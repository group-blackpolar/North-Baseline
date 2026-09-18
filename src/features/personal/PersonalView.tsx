import { ArrowRight, Bell, CreditCard, FileText, Sparkles } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCard, DashboardCard } from '@/components/dashboard/primitives';
import type { TabRoute } from '@/context/TabsContext';
import type { SessionUser } from '@/lib/auth';

export function PersonalView({ route, user }: { route: TabRoute; user: SessionUser }) {
  const { t } = useI18n();
  const sub = route.subcategoryId ?? 'overview';

  if (route.categoryId === 'home') {
    if (sub === 'quick-actions') {
      return (
        <div className="p-6 space-y-4">
          <h1 className="text-xl font-display font-semibold text-text">{t('personal.quickActions')}</h1>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: FileText, label: t('personal.actionNotes') },
              { icon: Bell, label: t('personal.actionNotifications') },
              { icon: CreditCard, label: t('personal.actionBilling') },
            ].map((action) => (
              <button key={action.label} type="button" className="np-card p-4 flex items-center gap-3 text-sm font-medium text-text hover:bg-surface-hover transition-colors duration-150">
                <action.icon className="w-4 h-4 text-accent" />
                {action.label}
                <ArrowRight className="w-3.5 h-3.5 ml-auto text-text-muted" />
              </button>
            ))}
          </div>
        </div>
      );
    }
    if (sub === 'recent') {
      return (
        <div className="p-6">
          <EmptyState icon={Sparkles} title={t('personal.noActivity')} body={t('personal.noActivityBody')} className="max-w-md" />
        </div>
      );
    }
    return (
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-2xl font-display font-bold text-text">{user.name ?? user.email}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('personal.welcomeBody')}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricCard label={t('personal.metricOrgs')} value="1" />
          <MetricCard label={t('personal.metricProjects')} value="0" />
          <MetricCard label={t('personal.metricSessions')} value="1" />
        </div>
        <DashboardCard title={t('personal.getStarted')}>
          <ul className="space-y-2 text-sm text-text-secondary">
            <li>• {t('personal.tipCreate')}</li>
            <li>• {t('personal.tipJoin')}</li>
            <li>• {t('personal.tipExplore')}</li>
          </ul>
        </DashboardCard>
      </div>
    );
  }

  if (route.categoryId === 'profile') {
    return (
      <div className="p-6 space-y-4 max-w-2xl">
        <h1 className="text-xl font-display font-semibold text-text">{t('personal.profile')}</h1>
        <DashboardCard title={sub === 'verification' ? t('personal.verification') : t('personal.information')}>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><dt className="ui-label pb-1">{t('auth.email')}</dt><dd className="text-text">{user.email}</dd></div>
            <div><dt className="ui-label pb-1">{t('auth.firstName')}</dt><dd className="text-text">{user.name ?? '—'}</dd></div>
            <div><dt className="ui-label pb-1">Role</dt><dd className="mono-data text-text">{user.role}</dd></div>
            <div>
              <dt className="ui-label pb-1">{t('personal.emailVerified')}</dt>
              <dd className={user.emailVerified ? 'text-success' : 'text-warning'}>
                {user.emailVerified ? t('personal.verified') : t('personal.notVerified')}
              </dd>
            </div>
          </dl>
        </DashboardCard>
      </div>
    );
  }

  if (route.categoryId === 'billing') {
    return (
      <div className="p-6 space-y-4 max-w-2xl">
        <h1 className="text-xl font-display font-semibold text-text">{t('personal.billing')}</h1>
        <DashboardCard title={t('personal.currentPlan')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text">Free</p>
              <p className="text-xs text-text-secondary">{t('personal.planHint')}</p>
            </div>
            <span className="rounded-full bg-accent-soft text-accent text-xs font-semibold px-2.5 py-1">Active</span>
          </div>
        </DashboardCard>
        <EmptyState icon={CreditCard} title={t('personal.noInvoices')} body={t('personal.noInvoicesBody')} />
      </div>
    );
  }

  // preferences
  return (
    <div className="p-6 space-y-4 max-w-2xl">
      <h1 className="text-xl font-display font-semibold text-text">{t('personal.preferences')}</h1>
      <DashboardCard title={sub === 'language' ? t('settings.language') : t('settings.appearance')}>
        <p className="text-sm text-text-secondary">{t('personal.preferencesHint')}</p>
      </DashboardCard>
    </div>
  );
}