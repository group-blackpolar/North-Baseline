import { useCallback, useEffect, useState } from 'react';
import { CaretLeft, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useCatalog } from '@/context/CatalogContext';
import { useAppErrorSafe } from '@/context/ErrorContext';
import { ApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { listAuthorizedTaxonomy, type ManagementCategory } from '@/lib/northAdmin';
import { ComponentLibraryModal } from './ComponentLibraryModal';
import { DevJsonModal } from './DevJsonModal';
import { ViewsDialogs } from './ViewsDialogs';
import { ViewsEditorCanvas } from './ViewsEditorCanvas';
import { ViewsEditorProvider, useViewsEditor } from './ViewsEditorContext';
import { ViewsInspectorPane } from './ViewsInspectorPane';
import { ViewsStructurePane } from './ViewsStructurePane';
import { ViewsWorkspace } from './workspace/ViewsWorkspace';

/** The Views editor (structure · canvas · inspector) that existed before the workspace, unchanged, behind "Edit". */
function EditorLayout({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const { isDirty, saveNow, activePanel } = useViewsEditor();
  const [leaving, setLeaving] = useState(false);
  const back = async () => {
    // Leave only after the draft is safe: a failed save keeps the editor open (conflicts are shown by the toolbar).
    setLeaving(true);
    const ok = !isDirty || (await saveNow());
    setLeaving(false);
    if (ok) onBack();
  };
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3 py-1.5">
        <Button size="sm" variant="ghost" loading={leaving} onClick={() => void back()}><CaretLeft />{t('adm2.views.backToWorkspace')}</Button>
        {activePanel ? <span className="min-w-0 truncate text-xs text-text-secondary">{activePanel.slug}</span> : null}
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ViewsStructurePane />
        <ViewsEditorCanvas />
        <ViewsInspectorPane />
      </div>
    </div>
  );
}

function Surface({ loadError, onRetry }: { loadError: string | null; onRetry: () => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      {editing ? <EditorLayout onBack={() => setEditing(false)} /> : <ViewsWorkspace loadError={loadError} onRetry={onRetry} onOpenEditor={() => setEditing(true)} />}
      <ViewsDialogs />
      <ComponentLibraryModal />
      <DevJsonModal />
    </>
  );
}

/**
 * Administration → Views. Loads the management tree CORECROW serves to people allowed to manage structure, then renders
 * the workspace (overview · explorer · results · inspector). The pre-existing visual editor is reachable per view.
 */
export function ViewsCenter({ organizationId }: { organizationId: string }) {
  const { t } = useI18n();
  const { refresh: refreshCatalog } = useCatalog();
  const appError = useAppErrorSafe();
  const [taxonomy, setTaxonomy] = useState<ManagementCategory[] | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async (initial = false, force = false) => {
    if (initial) { setLoading(true); setLoadError(null); }
    try {
      setTaxonomy(await listAuthorizedTaxonomy(organizationId, { force }));
      setLoadError(null);
      return true;
    } catch (next) {
      const apiError = next instanceof ApiError ? next : new ApiError(0, next instanceof Error ? next.message : 'Request failed');
      if (apiError.status === 401) appError?.classifyAndRaise(apiError);
      // A failed *refresh* keeps the tree that is already on screen and shows the error above it.
      setLoadError(apiError);
      return false;
    } finally {
      if (initial) setLoading(false);
    }
  }, [appError, organizationId]);

  useEffect(() => { setTaxonomy(null); void reload(true); }, [reload]);

  const refreshTaxonomy = useCallback(async () => {
    const ok = await reload(false, true);
    if (ok) { try { await refreshCatalog(); } catch { /* the navigation catalog refreshes on its next load */ } }
    return ok;
  }, [reload, refreshCatalog]);

  if (loading && !taxonomy) return <div className="w-full space-y-3 p-4 lg:p-5" aria-busy="true"><Skeleton className="h-8 w-56" /><Skeleton className="h-28 w-full rounded-xl" /><Skeleton className="h-64 w-full rounded-xl" /></div>;

  if (!taxonomy) {
    const forbidden = loadError?.status === 403 || loadError?.status === 404;
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={WarningCircle}
          title={forbidden ? t('adm2.views.forbidden') : t('admin.errorTitle')}
          body={forbidden ? t('adm2.views.forbiddenBody') : `${loadError?.message ?? ''} ${loadError?.requestId ? `(${loadError.requestId})` : ''}`}
          action={forbidden ? undefined : <Button size="sm" onClick={() => void reload(true, true)}>{t('admin.retry')}</Button>}
        />
      </div>
    );
  }

  return (
    <ViewsEditorProvider organizationId={organizationId} taxonomy={taxonomy} loading={loading} refreshTaxonomy={refreshTaxonomy}>
      <Surface loadError={loadError ? `${loadError.message}${loadError.requestId ? ` (${loadError.requestId})` : ''}` : null} onRetry={() => void reload(false, true)} />
    </ViewsEditorProvider>
  );
}
