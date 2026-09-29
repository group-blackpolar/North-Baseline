import { PanelLeft, PanelRight, PanelBottom, LayoutGrid, Square } from 'lucide-react';
import { useLayout } from '@/context/LayoutContext';
import { cn } from '@/lib/utils';
import { useI18n, type Dictionary } from '@/lib/i18n';

const MODES = [
  { id: 'single', icon: Square, label: 'layout.single' },
  { id: 'left', icon: PanelLeft, label: 'layout.left' },
  { id: 'right', icon: PanelRight, label: 'layout.right' },
  { id: 'bottom', icon: PanelBottom, label: 'layout.bottom' },
  { id: 'grid', icon: LayoutGrid, label: 'layout.grid' },
] as const;

export function LayoutSwitcher() {
  const { t } = useI18n();
  const { mode, setMode } = useLayout();

  return (
    <div className="shrink-0 h-full bg-surface border-l border-border flex flex-col items-center py-2 gap-1" style={{ width: 'var(--shell-layout-switcher)' }}>
      {MODES.map((m) => {
        const Icon = m.icon;
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            title={t(m.label as keyof Dictionary)}
            aria-label={t(m.label as keyof Dictionary)}
            aria-pressed={active}
            className={cn(
              'h-8 w-8 rounded-lg flex items-center justify-center transition-colors duration-150',
              active
                ? 'bg-surface-active text-text shadow-soft ring-1 ring-border'
                : 'text-text-muted hover:bg-surface-hover hover:text-text'
            )}
            onClick={() => setMode(m.id)}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}
