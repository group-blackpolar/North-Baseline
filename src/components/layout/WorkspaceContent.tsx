import { useTabs } from '@/context/TabsContext';
import { ViewRenderer } from '@/views/ViewsRenderer';
import { useCatalog } from '@/context/CatalogContext';
import { DelayedSkeleton, WorkspaceSkeleton } from '@/components/ui/skeleton';
import { useScreenTransition } from '@/lib/useScreenTransition';
import type { SessionUser } from '@/lib/auth';

/** The single workspace area of the active tab. */
export function WorkspaceContent({ user }: { user: SessionUser }) {
  const { activeTab } = useTabs();
  const { categories, isLoading } = useCatalog();
  // No tab yet: either the organization's navigation is still loading (org switch / first load) or
  // CatalogSync is about to open the first view. Show the workspace skeleton instead of an empty view.
  const screenRef = useScreenTransition<HTMLDivElement>(`${activeTab?.id}:${activeTab?.route.categoryId}:${activeTab?.route.subcategoryId}`);
  const opening = !activeTab && (isLoading || categories.length > 0);

  return (
    <div className="flex-1 flex min-h-0">
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div ref={screenRef} className="flex-1 overflow-y-auto">
          {opening ? <DelayedSkeleton loading delay={0} fallback={<WorkspaceSkeleton />} /> : <ViewRenderer user={user} tab={activeTab} />}
        </div>
      </div>
    </div>
  );
}
