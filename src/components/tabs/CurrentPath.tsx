import { useTabs } from '@/context/TabsContext';
import { subcategoryLabel, viewLabel } from '@/lib/navigation';
import { NotificationBell } from '@/components/notifications/NotificationBell';

export function CurrentPath() {
  const { activeTab } = useTabs();
  const category = activeTab ? viewLabel(activeTab.route.categoryId) : '';
  const subcategory = activeTab
    ? subcategoryLabel(activeTab.route.categoryId, activeTab.route.subcategoryId)
    : null;

  return (
    <div className="h-8 shrink-0 flex items-center justify-between gap-3 px-4 bg-background border-b border-border/60">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[11px] text-text-muted truncate">{category}</span>
        {subcategory && (
          <>
            <span className="text-[11px] text-border-strong" aria-hidden="true">/</span>
            <span className="text-[11px] font-medium text-text-secondary truncate">{subcategory}</span>
          </>
        )}
      </div>
      {/* Zona superior derecha: controles globales */}
      <div className="flex items-center gap-1 shrink-0">
        <NotificationBell />
      </div>
    </div>
  );
}