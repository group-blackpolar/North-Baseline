import { Check } from '@phosphor-icons/react';
import { useTheme, type ThemeName, type ThemePreference } from '@/lib/theme';
import { useDensity, useMotion, type DensityPreference, type MotionPreference } from '@/lib/density';
import { useI18n, type Dictionary } from '@/lib/i18n';

type Key = keyof Dictionary;
import { DashboardCard } from '@/components/dashboard/primitives';
import { cn } from '@/lib/utils';

interface PreviewPalette {
  bg: string;
  panel: string;
  text: string;
  accent: string;
}

const PALETTES: Record<ThemeName, PreviewPalette> = {
  light: { bg: '#ffffff', panel: '#f1f5f9', text: '#0f172a', accent: '#346beb' },
  dark: { bg: '#101418', panel: '#1c232b', text: '#e6e8ea', accent: '#6e96ff' },
  midnight: { bg: '#0a1020', panel: '#131c33', text: '#e2e8f8', accent: '#6e96ff' },
};

const THEMES = [
  { id: 'system', nameKey: 'settings.theme.system', descKey: 'settings.theme.systemDesc' },
  { id: 'light', nameKey: 'settings.theme.light', descKey: 'settings.theme.lightDesc' },
  { id: 'dark', nameKey: 'settings.theme.dark', descKey: 'settings.theme.darkDesc' },
  { id: 'midnight', nameKey: 'settings.theme.midnight', descKey: 'settings.theme.midnightDesc' },
] as const;

function Preview({ id }: { id: ThemePreference }) {
  const p = PALETTES[id === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : id];
  return (
    <div className="h-20 rounded-lg border border-border p-2 flex flex-col gap-1.5" style={{ background: p.bg }}>
      <div className="h-4 rounded-md flex items-center px-1.5 gap-1" style={{ background: p.panel }}>
        <span className="size-1.5 rounded-full" style={{ background: p.accent }} />
        <span className="h-1 w-8 rounded opacity-60" style={{ background: p.text }} />
      </div>
      <div className="flex gap-1.5 flex-1">
        <div className="flex-1 rounded-md" style={{ background: p.panel }} />
        <div className="w-1/3 rounded-md" style={{ background: p.panel }} />
      </div>
    </div>
  );
}

const DENSITIES: ReadonlyArray<{ id: DensityPreference; key: Key }> = [
  { id: 'auto', key: 'settings.density.auto' }, { id: 'comfortable', key: 'settings.density.comfortable' },
  { id: 'standard', key: 'settings.density.standard' }, { id: 'compact', key: 'settings.density.compact' },
];
const MOTIONS: ReadonlyArray<{ id: MotionPreference; key: Key }> = [
  { id: 'system', key: 'settings.motion.system' }, { id: 'reduced', key: 'settings.motion.reduced' },
];

function Choice<T extends string>({ label, hint, value, options, onChange }: { label: string; hint: string; value: T; options: ReadonlyArray<{ id: T; key: Key }>; onChange: (next: T) => void }) {
  const { t } = useI18n();
  return (
    <div className="space-y-2" role="group" aria-label={label}>
      <div><p className="text-sm font-medium text-text">{label}</p><p className="text-xs text-text-secondary mt-0.5">{hint}</p></div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={value === option.id}
            onClick={() => onChange(option.id)}
            className={cn('h-(--control-h-md) rounded-md border px-3 text-sm transition-colors duration-(--duration-fast)', value === option.id ? 'border-accent bg-accent-soft text-text' : 'border-border text-text-secondary hover:border-border-strong hover:text-text')}
          >{t(option.key)}</button>
        ))}
      </div>
    </div>
  );
}

export function AppearanceSection() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const { density, setDensity } = useDensity();
  const { motion, setMotion } = useMotion();

  return (
    <DashboardCard title={t('settings.appearance')} description={t('settings.appearanceDesc')}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {THEMES.map((option) => {
          const selected = theme === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              className={cn(
                'np-card p-3 text-left space-y-2.5 transition-[border-color,box-shadow] duration-(--duration-fast)',
                selected ? 'border-accent ring-2 ring-accent/25' : 'hover:border-border-strong'
              )}
              onClick={() => setTheme(option.id)}
            >
              <Preview id={option.id} />
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    'mt-0.5 size-4 rounded-full border flex items-center justify-center shrink-0',
                    selected ? 'border-accent bg-accent' : 'border-border-strong'
                  )}
                >
                  {selected && <Check className="w-3 h-3 text-white" />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text">{t(option.nameKey)}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{t(option.descKey)}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-5 grid gap-5 border-t border-border pt-5 sm:grid-cols-2">
        <Choice label={t('settings.density')} hint={t('settings.densityDesc')} value={density} options={DENSITIES} onChange={setDensity} />
        <Choice label={t('settings.motion')} hint={t('settings.motionDesc')} value={motion} options={MOTIONS} onChange={setMotion} />
      </div>
    </DashboardCard>
  );
}
