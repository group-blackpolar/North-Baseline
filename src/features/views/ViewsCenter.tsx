import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useCatalog } from '@/context/CatalogContext';
import { useAppErrorSafe } from '@/context/ErrorContext';
import { ApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { listAuthorizedTaxonomy, type ManagementCategory } from '@/lib/northAdmin';
import { ViewsDialogs } from './ViewsDialogs';
import { ViewsEditorProvider } from './ViewsEditorContext';
import { ViewsWorkspace } from './workspace/ViewsWorkspace';

// The Studio (canvas, charts, inspector) is the heaviest part of Views and most sessions only browse: load it on demand.
const StudioEditor = lazy(() => import('./studio/StudioEditor').then((module) => ({ default: module.StudioEditor })));

function Surface({ loadError, onRetry }: { loadError: string | null; onRetry: () => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      {editing ? (
        <Suspense fallback={<div className="w-full space-y-3 p-4 lg:p-5" aria-busy="true"><Skeleton className="h-8 w-56" /><Skeleton className="h-64 w-full rounded-xl" /></div>}>
          <StudioEditor onExit={() => setEditing(false)} />
        </Suspense>
      ) : <ViewsWorkspace loadError={loadError} onRetry={onRetry} onOpenEditor={() => setEditing(true)} />}
      <ViewsDialogs />
    </>
  );
}

/**
 * Administration → Views. Loads the management tree CORECROW serves to people allowed to manage structure, then renders
 * the workspace (overview · explorer · results · inspector). The Views Studio (visual editor) opens per view.
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
