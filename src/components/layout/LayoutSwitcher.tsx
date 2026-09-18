import { PanelLeft, PanelRight, PanelBottom, LayoutGrid, Square } from 'lucide-react';
import { useLayout } from '@/context/LayoutContext';
import { cn } from '@/lib/utils';

const MODES = [
  { id: 'single', icon: Square, label: 'Single' },
  { id: 'left', icon: PanelLeft, label: 'Left' },
  { id: 'right', icon: PanelRight, label: 'Right' },
  { id: 'bottom', icon: PanelBottom, label: 'Bottom' },
  { id: 'grid', icon: LayoutGrid, label: 'Grid' },
] as const;

export function LayoutSwitcher() {
  const { mode, setMode } = useLayout();

  return (
    <div className="w-10 shrink-0 h-full bg-surface border-l border-border flex flex-col items-center py-3 gap-1">
      {MODES.map((m) => {
        const Icon = m.icon;
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            title={m.label}
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