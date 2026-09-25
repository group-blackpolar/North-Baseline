import { useState, type FormEvent } from 'react';
import { NorthIcon } from '@/components/brand/NorthLogo';
import { LanguageSelector } from '@/components/LanguageSelector';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { changeTemporaryPassword, type SessionUser } from '@/lib/auth';
import { useI18n, type Locale } from '@/lib/i18n';
import { isTauri } from '@/lib/tauri';

interface TemporaryPasswordChangeProps {
  user: SessionUser;
  onComplete: (user: SessionUser) => void;
  onLogout: () => void;
}

export function TemporaryPasswordChange({
  user,
  onComplete,
  onLogout,
}: TemporaryPasswordChangeProps) {
  const { t, locale, setLocale } = useI18n();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const desktopBlocked = isTauri();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (desktopBlocked) {
      setError(t('auth.temporaryPasswordWebOnly'));
      return;
    }
    if (!currentPassword || !newPassword || !confirmation) {
      setError(t('auth.temporaryPasswordRequired'));
      return;
    }
    if (newPassword.length < 12 || newPassword.length > 128) {
      setError(t('auth.temporaryPasswordLength'));
      return;
    }
    if (newPassword === currentPassword) {
      setError(t('auth.temporaryPasswordDifferent'));
      return;
    }
    if (newPassword !== confirmation) {
      setError(t('auth.temporaryPasswordMismatch'));
      return;
    }

    setSaving(true);
    try {
      const updated = await changeTemporaryPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      onComplete(updated);
    } catch (changeError) {
      setError(
        changeError instanceof Error
          ? changeError.message
          : t('auth.temporaryPasswordError'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 min-h-screen flex flex-col overflow-y-auto bg-bg" lang={locale}>
      <header className="flex items-center justify-between px-5 sm:px-8 py-5">
        <div className="flex items-center gap-2">
          <NorthIcon className="size-7" />
          <span className="font-display text-xs tracking-[0.25em] text-text-dim">NORTH</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle language={locale} />
          <LanguageSelector value={locale} onChange={(value) => setLocale(value as Locale)} />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <section
          className="w-full max-w-[440px] rounded-2xl border border-line bg-panel px-6 py-10 shadow-sm sm:px-10"
          aria-labelledby="temporary-password-title"
        >
          <h1 id="temporary-password-title" className="font-display text-2xl font-bold text-text">
            {t('auth.temporaryPasswordTitle')}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-text-dim">
            {t('auth.temporaryPasswordBody')}
          </p>
          <p className="mt-3 truncate text-xs font-mono text-text-muted" title={user.email}>
            {user.email}
          </p>

          <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
            <PasswordField
              label={t('auth.currentPassword')}
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
            />
            <PasswordField
              label={t('auth.newPassword')}
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
            />
            <PasswordField
              label={t('auth.confirmNewPassword')}
              value={confirmation}
              onChange={setConfirmation}
              autoComplete="new-password"
            />

            {desktopBlocked && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                {t('auth.temporaryPasswordWebOnly')}
              </p>
            )}
            {error && !desktopBlocked && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="dark"
              disabled={saving || desktopBlocked}
              className="north-primary h-10 w-full"
            >
              {saving ? t('auth.temporaryPasswordSaving') : t('auth.temporaryPasswordSubmit')}
            </Button>
            <button
              type="button"
              onClick={onLogout}
              disabled={saving}
              className="w-full text-sm text-text-dim hover:text-text disabled:opacity-50"
            >
              {t('auth.signOut')}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-text">{label}</span>
      <Input
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        minLength={12}
        maxLength={128}
        required
      />
    </label>
  );
}
