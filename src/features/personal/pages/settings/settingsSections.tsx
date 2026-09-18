import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useNotifications } from '@/context/NotificationContext';
import { DashboardCard } from '@/components/dashboard/primitives';
import { cn } from '@/lib/utils';

/** Toggle reutilizable de Settings (estado local mock).
 *  TODO: persistir vía CoreCrow User Preferences. */
export function ToggleRow({ label, hint, defaultOn = false }: { label: string; hint?: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-border/60 last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-text">{label}</p>
        {hint && <p className="text-xs text-text-secondary mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn((v) => !v)}
        className={cn(
          'h-5 w-9 rounded-full relative shrink-0 transition-colors duration-150',
          on ? 'bg-accent' : 'bg-surface-active'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-4 rounded-full bg-white transition-[left] duration-150',
            on ? 'left-[18px]' : 'left-0.5'
          )}
        />
      </button>
    </div>
  );
}

function MockSelect({ label, options }: { label: string; options: string[] }) {
  const [value, setValue] = useState(options[0]);
  return (
    <label className="flex items-center justify-between gap-4 py-2.5 border-b border-border/60 last:border-0">
      <span className="text-sm text-text">{label}</span>
      <select
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="h-8 rounded-md border border-border bg-surface px-2 text-xs font-medium text-text outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

export function GeneralSection() {
  const { t } = useI18n();
  return (
    <DashboardCard title="General" description={t('settings.generalDesc')}>
      <ToggleRow label="Sync profile across workspaces" defaultOn />
      <MockSelect label="Default workspace" options={['Personal', 'SHARK']} />
      <MockSelect label="Timezone" options={['(GMT-05:00) Panama', '(GMT-06:00) Mexico City', '(GMT+01:00) Madrid']} />
    </DashboardCard>
  );
}

export function NotificationsSection() {
  const { t } = useI18n();
  return (
    <DashboardCard title="Notifications" description={t('settings.notificationsDesc')}>
      <ToggleRow label={t('settings.emailNotifications')} defaultOn />
      <ToggleRow label={t('settings.pushNotifications')} />
      <ToggleRow label={t('settings.productUpdates')} defaultOn />
    </DashboardCard>
  );
}

export function AccessibilitySection() {
  const { t } = useI18n();
  return (
    <DashboardCard title="Accessibility" description={t('settings.accessibilityDesc')}>
      <ToggleRow label={t('settings.reduceMotion')} />
      <ToggleRow label={t('settings.highContrast')} />
      <ToggleRow label={t('settings.largeText')} />
    </DashboardCard>
  );
}

export function PrivacySection() {
  const { t } = useI18n();
  const { push } = useNotifications();
  return (
    <>
      <DashboardCard title="Privacy" description={t('settings.privacyDesc')}>
        <ToggleRow label={t('settings.activityVisible')} defaultOn />
        <ToggleRow label={t('settings.readReceipts')} defaultOn />
      </DashboardCard>
      <DashboardCard title={t('settings.exportData')} description={t('settings.exportHint')}>
        <button
          type="button"
          className="h-9 px-3 rounded-lg border border-border text-sm font-medium text-text hover:bg-surface-hover transition-colors duration-150"
          onClick={() =>
            push({ type: 'info', title: t('settings.exportData'), body: 'TODO: CoreCrow User Preferences' })
          }
        >
          {t('settings.exportData')}
        </button>
      </DashboardCard>
    </>
  );
}

export function AdvancedSection() {
  const { t } = useI18n();
  const { push } = useNotifications();
  return (
    <>
      <DashboardCard title="Advanced" description={t('settings.advancedDesc')}>
        <ToggleRow label={t('settings.devMode')} />
      </DashboardCard>
      <DashboardCard title={t('settings.dangerZone')} description={t('settings.deleteHint')}>
        <button
          type="button"
          className="h-9 px-3 rounded-lg border border-error/40 text-sm font-medium text-error hover:bg-error/10 transition-colors duration-150"
          onClick={() =>
            push({ type: 'warning', title: t('settings.deleteAccount'), body: 'TODO: CoreCrow Identity' })
          }
        >
          {t('settings.deleteAccount')}
        </button>
      </DashboardCard>
    </>
  );
}