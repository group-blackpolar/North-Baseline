import { useState } from 'react';
import { Bell, Globe, Moon, Shield, Sun } from 'lucide-react';
import { useI18n, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark' | 'system';

export function SettingsView() {
  const { t, locale, setLocale } = useI18n();
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('bp-theme') as Theme | null) ?? 'system'
  );

  const handleThemeChange = (next: Theme) => {
    setTheme(next);
    if (next === 'system') {
      localStorage.removeItem('bp-theme');
      document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    } else {
      localStorage.setItem('bp-theme', next);
      document.documentElement.dataset.theme = next;
    }
  };

  const locales: Array<{ id: Locale; label: string }> = [
    { id: 'es', label: 'Español' },
    { id: 'en', label: 'English' },
  ];

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-text">{t('settings.title')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('settings.subtitle')}</p>
        </div>

        {/* Apariencia */}
        <section className="np-card p-5 space-y-4">
          <h2 className="flex items-center gap-2.5 text-[15px] font-display font-semibold text-text">
            <Sun className="w-4 h-4 text-accent" />
            {t('settings.appearance')}
          </h2>
          <div>
            <p className="ui-label pb-2">{t('settings.theme')}</p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'light' as Theme, icon: Sun, label: t('settings.theme.light') },
                  { id: 'dark' as Theme, icon: Moon, label: t('settings.theme.dark') },
                  { id: 'system' as Theme, icon: Globe, label: t('settings.theme.system') },
                ]
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={theme === option.id}
                  className={cn(
                    'flex items-center justify-center gap-2 h-9 rounded-md text-sm font-medium transition-colors duration-150',
                    theme === option.id
                      ? 'bg-surface-active text-text shadow-soft border border-border'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text border border-transparent'
                  )}
                  onClick={() => handleThemeChange(option.id)}
                >
                  <option.icon className="w-4 h-4" />
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="ui-label pb-2">{t('settings.language')}</p>
            <div className="grid grid-cols-2 gap-2">
              {locales.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={locale === option.id}
                  className={cn(
                    'h-9 rounded-md text-sm font-medium transition-colors duration-150',
                    locale === option.id
                      ? 'bg-surface-active text-text shadow-soft border border-border'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text border border-transparent'
                  )}
                  onClick={() => setLocale(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-text-muted">{t('settings.language.help')}</p>
          </div>
        </section>

        {/* Notificaciones */}
        <section className="np-card p-5 space-y-3">
          <h2 className="flex items-center gap-2.5 text-[15px] font-display font-semibold text-text">
            <Bell className="w-4 h-4 text-accent" />
            {t('settings.notifications')}
          </h2>
          {(
            [
              ['email', true],
              ['push', false],
              ['weekly', true],
            ] as const
          ).map(([key, initial]) => (
            <label
              key={key}
              className="flex items-center justify-between py-1 text-sm text-text cursor-pointer"
            >
              {t(`settings.notifications.${key}` as const)}
              <input type="checkbox" defaultChecked={initial} className="size-4 rounded accent-[var(--color-accent)]" />
            </label>
          ))}
        </section>

        {/* Seguridad */}
        <section className="np-card p-5 space-y-2">
          <h2 className="flex items-center gap-2.5 text-[15px] font-display font-semibold text-text pb-1">
            <Shield className="w-4 h-4 text-accent" />
            {t('settings.security')}
          </h2>
          {(['password', 'mfa', 'sessions'] as const).map((key) => (
            <button
              key={key}
              type="button"
              className="w-full px-3 py-2 rounded-md text-sm text-text-secondary text-left hover:bg-surface-hover hover:text-text transition-colors duration-150"
            >
              {t(`settings.security.${key}` as const)}
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}