import { useState } from 'react';
import { Check } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { DashboardCard } from '@/components/dashboard/primitives';
import { getRegionPrefs, saveRegionPrefs, type RegionPrefs } from '@/lib/regionPrefs';
import { cn } from '@/lib/utils';

const LANGUAGES = [
  { id: 'es', label: 'Español', hint: 'es-PA' },
  { id: 'en', label: 'English', hint: 'en-US' },
] as const;

const LOCALE_MAP: Record<string, string> = { es: 'es-PA', en: 'en-US' };

export function LanguageSection() {
  // Cast defensivo: si tu i18n aún no expone locale/setLocale, usamos el fallback de localStorage
  const i18n = useI18n() as unknown as {
    t: (key: string) => string;
    locale?: string;
    setLocale?: (locale: string) => void;
  };

  const [prefs, setPrefs] = useState<RegionPrefs>(() => getRegionPrefs());
  const current = i18n.locale ?? (() => { try { return localStorage.getItem('north-locale') ?? 'es'; } catch { return 'es'; } })();

  const changeLanguage = (next: string) => {
    if (typeof i18n.setLocale === 'function') {
      i18n.setLocale(next);
    } else {
      // Fallback: persistir y recargar hasta que i18n exponga setLocale
      try { localStorage.setItem('north-locale', next); } catch { /* noop */ }
      window.location.reload();
    }
  };

  const update = (patch: Partial<RegionPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveRegionPrefs(next);
  };

  const preview = new Intl.DateTimeFormat(LOCALE_MAP[current] ?? 'es-PA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());

  return (
    <>
      <DashboardCard title={i18n.t('settings.language')} description={i18n.t('settings.languageHint')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {LANGUAGES.map((language) => {
            const selected = current === language.id;
            return (
              <button
                key={language.id}
                type="button"
                aria-pressed={selected}
                className={cn(
                  'np-card p-3 flex items-center gap-3 text-left transition-[border-color,box-shadow] duration-150',
                  selected ? 'border-accent ring-2 ring-accent/25' : 'hover:border-border-strong'
                )}
                onClick={() => changeLanguage(language.id)}
              >
                <span
                  className={cn(
                    'size-4 rounded-full border flex items-center justify-center shrink-0',
                    selected ? 'border-accent bg-accent' : 'border-border-strong'
                  )}
                >
                  {selected && <Check className="w-3 h-3 text-white" />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text">{language.label}</p>
                  <p className="text-xs text-text-muted mono-data">{language.hint}</p>
                </div>
              </button>
            );
          })}
        </div>
      </DashboardCard>

      <DashboardCard title={i18n.t('settings.region')} description={preview}>
        <div className="space-y-0">
          <label className="flex items-center justify-between gap-4 py-2.5 border-b border-border/60">
            <span className="text-sm text-text">{i18n.t('settings.region')}</span>
            <select
              value={prefs.region}
              onChange={(event) => update({ region: event.target.value })}
              className="h-8 rounded-md border border-border bg-surface px-2 text-xs font-medium text-text outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
            >
              <option value="PA">Panamá</option>
              <option value="US">United States</option>
              <option value="MX">México</option>
              <option value="ES">España</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-4 py-2.5 border-b border-border/60">
            <span className="text-sm text-text">{i18n.t('settings.dateFormat')}</span>
            <select
              value={prefs.dateFormat}
              onChange={(event) => update({ dateFormat: event.target.value })}
              className="h-8 rounded-md border border-border bg-surface px-2 text-xs font-medium text-text outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-4 py-2.5">
            <span className="text-sm text-text">{i18n.t('settings.timeFormat')}</span>
            <select
              value={prefs.timeFormat}
              onChange={(event) => update({ timeFormat: event.target.value })}
              className="h-8 rounded-md border border-border bg-surface px-2 text-xs font-medium text-text outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
            >
              <option value="24h">24 h</option>
              <option value="12h">12 h (AM/PM)</option>
            </select>
          </label>
        </div>
      </DashboardCard>
    </>
  );
}