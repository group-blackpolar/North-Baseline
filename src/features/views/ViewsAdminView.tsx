import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { useCatalog } from '@/context/CatalogContext';
import { useAppErrorSafe } from '@/context/ErrorContext';
import { useI18n } from '@/lib/i18n';
import { ApiError } from '@/lib/api';
import { listAuthorizedTaxonomy, type ManagementCategory } from '@/lib/northAdmin';
import { ViewsEditorProvider } from './ViewsEditorContext';
import { ViewsStructurePane } from './ViewsStructurePane';
import { ViewsEditorCanvas } from './ViewsEditorCanvas';
import { ViewsInspectorPane } from './ViewsInspectorPane';
import { ViewsDialogs } from './ViewsDialogs';
import { ComponentLibraryModal } from './ComponentLibraryModal';

export function ViewsAdminView({ organizationId }: { organizationId: string }) {
  const { t } = useI18n();
  const { refresh: refreshCatalog } = useCatalog();
  const appError = useAppErrorSafe();
  const [taxonomy, setTaxonomy] = useState<ManagementCategory[] | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(
    async (initial = false) => {
      if (initial) {
        setLoading(true);
        setLoadError(null);
      }
      try {
        setTaxonomy(await listAuthorizedTaxonomy(organizationId));
        return true;
      } catch (next) {
        const apiError = next instanceof ApiError ? next : new ApiError(0, next instanceof Error ? next.message : 'Request failed');
        if (apiError.status === 401) appError?.classifyAndRaise(apiError);
        setLoadError(apiError);
        return false;
      } finally {
        if (initial) setLoading(false);
      }
    },
    [appError, organizationId],
  );

  useEffect(() => {
    setTaxonomy(null);
    setLoadError(null);
    void reload(true);
  }, [organizationId, reload]);

  const refreshTaxonomy = useCallback(async () => {
    const ok = await reload(false);
    if (ok) {
      try {
        await refreshCatalog();
      } catch {
        /* ignore */
      }
    }
    return ok;
  }, [reload, refreshCatalog]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-text-muted">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        {t('admin.loading')}
      </div>
    );
  }

  if (loadError || !taxonomy) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={AlertCircle}
          title={t('admin.errorTitle')}
          body={`${loadError?.message ?? ''} ${loadError?.requestId ? `(${loadError.requestId})` : ''}`}
          action={
            <Button size="sm" onClick={() => reload(true)}>
              {t('admin.retry')}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <ViewsEditorProvider organizationId={organizationId} taxonomy={taxonomy} loading={loading} refreshTaxonomy={refreshTaxonomy}>
      <div className="flex flex-1 h-full overflow-hidden bg-background">
        <ViewsStructurePane />
        <ViewsEditorCanvas />
        <ViewsInspectorPane />
        <ViewsDialogs />
        <ComponentLibraryModal />
      </div>
    </ViewsEditorProvider>
  );
}
