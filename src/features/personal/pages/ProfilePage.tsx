import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { CheckCircle2, CircleAlert, LockKeyhole } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { getOwnProfile, updateOwnProfile, type SessionUser } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

function ReadOnly({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="ui-label pb-1">{label}</dt>
      <dd className={cn('text-sm text-text', mono && 'mono-data')}>{value}</dd>
    </div>
  );
}

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="w-full max-w-3xl p-4 lg:p-5 space-y-4">
      <h1 className="text-xl font-display font-semibold text-text">{title}</h1>
      {children}
    </div>
  );
}

export function ProfilePage({ sub, user }: { sub: string; user: SessionUser }) {
  const { t, locale } = useI18n();
  const [profile, setProfile] = useState(user);
  const [name, setName] = useState(user.name ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setProfile(user);
    setName(user.name ?? '');
  }, [user]);

  useEffect(() => {
    let live = true;
    void getOwnProfile()
      .then((current) => {
        if (!live) return;
        setProfile(current);
        setName(current.name ?? '');
      })
      .catch(() => {
        // The authenticated session remains a safe read-only fallback.
      });
    return () => {
      live = false;
    };
  }, []);

  const saveName = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateOwnProfile(profile, { name });
      setProfile(updated);
      setName(updated.name ?? '');
      setMessage({ type: 'success', text: t('profile.saved') });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : t('profile.saveError') });
    } finally {
      setSaving(false);
    }
  };

  if (sub === 'account') {
    return (
      <Page title={t('profile.account')}>
        <DashboardCard title={t('profile.accountDetails')} description={t('profile.accountDetailsHint')}>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <ReadOnly label={t('profile.email')} value={profile.email} />
            <ReadOnly label={t('profile.accountId')} value={profile.id} mono />
            <ReadOnly
              label={t('profile.created')}
              value={profile.createdAt ? new Intl.DateTimeFormat(locale).format(new Date(profile.createdAt)) : '—'}
            />
            <ReadOnly label={t('profile.globalRole')} value={profile.role} />
          </dl>
        </DashboardCard>
      </Page>
    );
  }

  if (sub === 'contact') {
    return (
      <Page title={t('profile.contact')}>
        <DashboardCard title={t('profile.contact')} description={t('profile.contactHint')}>
          <ReadOnly label={t('profile.email')} value={profile.email} />
          <p className="text-xs text-text-secondary">{t('profile.contactUnavailable')}</p>
        </DashboardCard>
      </Page>
    );
  }

  if (sub === 'security') {
    return (
      <Page title={t('profile.security')}>
        <DashboardCard title={t('profile.identitySecurity')} description={t('profile.securityHint')}>
          <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-hover/50 p-3">
            {profile.emailVerified
              ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              : <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" />}
            <div>
              <p className="text-sm font-medium text-text">
                {profile.emailVerified ? t('profile.emailVerified') : t('profile.emailPending')}
              </p>
              <p className="mt-0.5 text-xs text-text-secondary">{t('profile.emailSecurityHint')}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-dashed border-border-strong p-3">
            <LockKeyhole className="mt-0.5 size-4 shrink-0 text-text-muted" />
            <div>
              <p className="text-sm font-medium text-text">{t('profile.securityComing')}</p>
              <p className="mt-0.5 text-xs text-text-secondary">{t('profile.securityComingHint')}</p>
            </div>
          </div>
        </DashboardCard>
      </Page>
    );
  }

  return (
    <Page title={t('profile.personalInformation')}>
      <DashboardCard title={t('profile.profile')} description={t('profile.profileHint')}>
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-accent-soft text-accent flex items-center justify-center font-display text-sm font-semibold shrink-0">
            {(profile.name ?? profile.email).slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">{profile.name ?? profile.email}</p>
            <p className="truncate text-xs text-text-secondary">{profile.email}</p>
          </div>
        </div>

        <form className="space-y-3" onSubmit={saveName}>
          <label className="block space-y-1.5">
            <span className="ui-label block">{t('profile.name')}</span>
            <input
              value={name}
              minLength={2}
              maxLength={100}
              required
              onChange={(event) => setName(event.target.value)}
              className="h-9 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-text outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
            />
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="accent" size="sm" disabled={saving || name.trim().length < 2 || name.trim() === (profile.name ?? '')}>
              {saving ? t('profile.saving') : t('profile.save')}
            </Button>
            {message && (
              <p role={message.type === 'error' ? 'alert' : 'status'} className={cn('text-xs', message.type === 'success' ? 'text-success' : 'text-error')}>
                {message.text}
              </p>
            )}
          </div>
        </form>
      </DashboardCard>
    </Page>
  );
}
