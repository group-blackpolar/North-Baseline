import { LayoutGrid, PanelBottom, PanelLeft, PanelRight } from 'lucide-react';
import { useLayout, type LayoutMode } from '@/context/LayoutContext';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const OPTIONS: Array<{ mode: LayoutMode; icon: typeof PanelLeft; labelKey: 'layout.right' | 'layout.left' | 'layout.bottom' | 'layout.grid' }> = [
  { mode: 'right', icon: PanelRight, labelKey: 'layout.right' },
  { mode: 'left', icon: PanelLeft, labelKey: 'layout.left' },
  { mode: 'bottom', icon: PanelBottom, labelKey: 'layout.bottom' },
  { mode: 'grid', icon: LayoutGrid, labelKey: 'layout.grid' },
];

export function LayoutSwitcher() {
  const { mode, setMode } = useLayout();
  const { t } = useI18n();

  return (
    <div className="w-10 shrink-0 border-l border-border bg-surface flex flex-col items-center py-2 gap-1">
      {OPTIONS.map(({ mode: optionMode, icon: Icon, labelKey }) => (
        <button
          key={optionMode}
          type="button"
          title={t(labelKey)}
          aria-label={t(labelKey)}
          aria-pressed={mode === optionMode}
          className={cn(
            'h-8 w-8 rounded-md flex items-center justify-center transition-colors duration-150',
            mode === optionMode
              ? 'bg-surface-active text-text shadow-soft'
              : 'text-text-muted hover:bg-surface-hover hover:text-text'
          )}
          onClick={() => setMode(mode === optionMode ? 'single' : optionMode)}
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  );
}