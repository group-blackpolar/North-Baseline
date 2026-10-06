import { Sidebar, Square, SquareHalf, SquareHalfBottom, SquaresFour } from '@phosphor-icons/react';
import { useLayout } from '@/context/LayoutContext';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useI18n, type Dictionary } from '@/lib/i18n';

const MODES = [
  { id: 'single', icon: Square, label: 'layout.single' },
  { id: 'left', icon: Sidebar, label: 'layout.left' },
  { id: 'right', icon: SquareHalf, label: 'layout.right' },
  { id: 'bottom', icon: SquareHalfBottom, label: 'layout.bottom' },
  { id: 'grid', icon: SquaresFour, label: 'layout.grid' },
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
          <Tooltip key={m.id} label={t(m.label as keyof Dictionary)} side="left">
          <button
            type="button"
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
          </Tooltip>
        );
      })}
    </div>
  );
}
