import { Check } from 'lucide-react';
import { useTheme, type ThemeName } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import { DashboardCard } from '@/components/dashboard/primitives';
import { cn } from '@/lib/utils';

interface PreviewPalette {
  bg: string;
  panel: string;
  text: string;
  accent: string;
}

const PALETTES: Record<Exclude<ThemeName, 'system'>, PreviewPalette> = {
  light: { bg: '#ffffff', panel: '#f1f5f9', text: '#0f172a', accent: '#0fa396' },
  dark: { bg: '#101418', panel: '#1c232b', text: '#e6e8ea', accent: '#3ecfba' },
  midnight: { bg: '#0a1020', panel: '#131c33', text: '#e2e8f8', accent: '#3ecfba' },
};

const THEMES = [
  { id: 'light', nameKey: 'settings.theme.light', descKey: 'settings.theme.lightDesc' },
  { id: 'dark', nameKey: 'settings.theme.dark', descKey: 'settings.theme.darkDesc' },
  { id: 'midnight', nameKey: 'settings.theme.midnight', descKey: 'settings.theme.midnightDesc' },
  { id: 'system', nameKey: 'settings.theme.system', descKey: 'settings.theme.systemDesc' },
] as const;

function Preview({ id }: { id: ThemeName }) {
  if (id === 'system') {
    return (
      <div className="h-20 rounded-lg border border-border overflow-hidden flex">
        {(['light', 'dark'] as const).map((half) => (
          <div key={half} className="flex-1 p-2 flex flex-col gap-1.5" style={{ background: PALETTES[half].bg }}>
            <div className="h-4 rounded-md flex items-center px-1.5 gap-1" style={{ background: PALETTES[half].panel }}>
              <span className="size-1.5 rounded-full" style={{ background: PALETTES[half].accent }} />
              <span className="h-1 w-8 rounded opacity-60" style={{ background: PALETTES[half].text }} />
            </div>
            <div className="flex gap-1.5 flex-1">
              <div className="flex-1 rounded-md" style={{ background: PALETTES[half].panel }} />
              <div className="w-1/3 rounded-md" style={{ background: PALETTES[half].panel }} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  const p = PALETTES[id];
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

export function AppearanceSection() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();

  return (
    <DashboardCard title="Appearance" description={t('settings.appearanceDesc')}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {THEMES.map((option) => {
          const selected = theme === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              className={cn(
                'np-card p-3 text-left space-y-2.5 transition-[border-color,box-shadow] duration-150',
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
    </DashboardCard>
  );
}