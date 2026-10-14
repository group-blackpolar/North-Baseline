import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { listAuthorizedTaxonomy, type ManagementCategory } from '@/lib/northAdmin';
import { pushPath } from '@/lib/routes';
import { ViewsEditorProvider, useViewsEditor } from './ViewsEditorContext';

const StudioEditor = lazy(() => import('./studio/StudioEditor').then((module) => ({ default: module.StudioEditor })));

/** Finds the view in the authorized tree: the URL only carries the panel id, never category/subcategory. */
function locate(taxonomy: ManagementCategory[], panelId: string) {
  for (const category of taxonomy)
    for (const subcategory of category.subcategories)
      if (subcategory.panels.some((panel) => panel.id === panelId)) return { categoryId: category.id, subcategoryId: subcategory.id };
  return null;
}

function Skel() {
  return <div className="flex h-full w-full flex-col gap-3 p-4" aria-busy="true"><Skeleton className="h-10 w-full" /><Skeleton className="h-full w-full rounded-xl" /></div>;
}

function Stage({ panelId, location, onExit }: { panelId: string; location: { categoryId: string; subcategoryId: string }; onExit: () => void }) {
  const { selectPanel, setActiveMode, selection } = useViewsEditor();
  useEffect(() => { selectPanel(location.categoryId, location.subcategoryId, panelId); setActiveMode('editor'); }, [location.categoryId, location.subcategoryId, panelId, selectPanel, setActiveMode]);
  if (selection.panelId !== panelId) return <Skel />;
  return <Suspense fallback={<Skel />}><StudioEditor onExit={onExit} /></Suspense>;
}

/**
 * Views Studio as its own browser tab (`/:organization/studio/:panelId`): no organization rail, navbar or category panel,
 * the editor owns the whole viewport. Session and authorization are the same as NORTH's (CORECROW cookie session, every
 * request authorized server-side); this component only locates the view and mounts the existing editor.
 */
export function StudioWindow({ organizationId, organizationSlug, panelId }: { organizationId: string; organizationSlug: string; panelId: string }) {
  const { t } = useI18n();
  const [taxonomy, setTaxonomy] = useState<ManagementCategory[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async (force = false) => {
    try { setTaxonomy(await listAuthorizedTaxonomy(organizationId, { force })); setError(null); return true; }
    catch (next) { setError(next instanceof ApiError ? next : new ApiError(0, next instanceof Error ? next.message : 'Request failed')); return false; }
  }, [organizationId]);
  useEffect(() => { setTaxonomy(null); void load(); }, [load]);

  // Closing a tab we opened returns to the opener; a directly opened studio navigates inside this tab instead.
  const exit = useCallback(() => {
    if (window.opener && !window.opener.closed) { window.close(); if (window.closed) return; }
    pushPath(`/${organizationSlug}`);
  }, [organizationSlug]);

  const location = taxonomy ? locate(taxonomy, panelId) : null;
  if (!taxonomy && !error) return <div className="fixed inset-0 bg-background"><Skel /></div>;
  if (!taxonomy || !location) {
    const forbidden = !error || error.status === 403 || error.status === 404;
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background p-6">
        <EmptyState
          icon={WarningCircle}
          title={forbidden ? t('st.window.notFound') : t('admin.errorTitle')}
          body={forbidden ? t('st.window.notFoundBody') : `${error?.message ?? ''}${error?.requestId ? ` (${error.requestId})` : ''}`}
          action={<div className="flex gap-2">{forbidden ? null : <Button size="sm" onClick={() => void load(true)}>{t('admin.retry')}</Button>}<Button size="sm" variant="secondary" onClick={exit}>{t('st.toolbar.exit')}</Button></div>}
        />
      </div>
    );
  }
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background" data-north-studio-window>
      <ViewsEditorProvider organizationId={organizationId} taxonomy={taxonomy} loading={false} refreshTaxonomy={() => load(true)}>
        <Stage panelId={panelId} location={location} onExit={exit} />
      </ViewsEditorProvider>
    </div>
  );
}
