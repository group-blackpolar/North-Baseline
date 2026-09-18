import { useLayout } from '@/context/LayoutContext';
import { useTabs, type Tab } from '@/context/TabsContext';
import { ViewRenderer } from '@/views/ViewsRenderer';
import { ResizeHandle } from '@/components/layout/ResizeHandle';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/lib/auth';

function Pane({ index, user }: { index: number; user: SessionUser }) {
  const { tabs } = useTabs();
  const { paneTabId, setPaneTabId } = useLayout();
  const { t } = useI18n();
  const selectedId = paneTabId[index] ?? null;
  const tab: Tab | null = tabs.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <div className="h-8 shrink-0 flex items-center gap-2 px-2 border-b border-border/60 bg-surface-hover/50">
        <span className="ui-label shrink-0">{t('panel.label', { n: index + 1 }) || `Panel ${index + 1}`}</span>
        <select
          className="flex-1 min-w-0 h-6 rounded-md border border-border bg-surface px-1.5 text-xs text-text outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
          value={selectedId ?? ''}
          onChange={(event) => setPaneTabId(index, event.target.value || null)}
        >
          <option value="">{t('panel.select') || 'Seleccionar vista...'}</option>
          {tabs.map((item) => (
            <option key={item.id} value={item.id}>
              {item.route.categoryId}/{item.route.subcategoryId ?? ''}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab ? (
          <ViewRenderer user={user} tab={tab} />
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-text-muted">
            {t('panel.empty') || 'Selecciona una vista para este panel'}
          </div>
        )}
      </div>
    </div>
  );
}

export function SplitContent({ user }: { user: SessionUser }) {
  const { mode, paneSize, dragging } = useLayout();
  const { activeTab } = useTabs();

  const animated = cn('flex flex-col min-w-0 min-h-0', !dragging && 'transition-[width,height] duration-200 ease-out');

  const main = (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <div className="flex-1 overflow-y-auto">
        <ViewRenderer user={user} tab={activeTab} />
      </div>
    </div>
  );

  if (mode === 'single') return <div className="flex-1 flex min-h-0">{main}</div>;

  if (mode === 'right' || mode === 'grid') {
    return (
      <div className="flex-1 flex min-h-0">
        {main}
        <ResizeHandle axis="x" sign={-1} />
        <div className={animated} style={{ width: paneSize }}>
          {mode === 'right' ? (
            <Pane index={0} user={user} />
          ) : (
            <>
              <div className="flex-1 flex flex-col min-h-0 border-b border-border/60">
                <Pane index={0} user={user} />
              </div>
              <div className="flex-1 flex flex-col min-h-0">
                <Pane index={1} user={user} />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'left') {
    return (
      <div className="flex-1 flex min-h-0">
        <div className={animated} style={{ width: paneSize }}>
          <Pane index={0} user={user} />
        </div>
        <ResizeHandle axis="x" sign={1} />
        {main}
      </div>
    );
  }

  // bottom
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {main}
      <ResizeHandle axis="y" sign={-1} />
      <div className={animated} style={{ height: paneSize }}>
        <Pane index={0} user={user} />
      </div>
    </div>
  );
}