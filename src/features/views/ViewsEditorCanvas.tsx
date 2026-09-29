import { useEffect, useState, useCallback } from 'react';
import { useViewsEditor } from './ViewsEditorContext';
import { useI18n } from '@/lib/i18n';
import { getDraft } from '@/lib/northAdmin';
import { ViewsEditorToolbar } from './ViewsEditorToolbar';
import { ViewsCanvasBody } from './ViewsCanvasBody';
import { emptyDocument } from '@/features/admin/contentDocument';
import { useViewsAutosave } from './useViewsAutosave';
import { ApiError } from '@/lib/api';

export function ViewsEditorCanvas() {
  const {
    organizationId,
    activePanel,
    selection,
    setActiveDocument,
    setIsDirty,
    setEtag,
    setSaveStatus,
    setSaveError,
  } = useViewsEditor();
  const { t } = useI18n();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fase 5: autosave debounced sobre el documento activo.
  useViewsAutosave();

  const loadPanelDraft = useCallback(async (panelId: string) => {
    setLoading(true);
    setError(null);
    setSaveStatus('idle');
    setSaveError(null);
    try {
      const res = await getDraft(organizationId, panelId);
      setActiveDocument(res.document);
      setEtag(res.etag);
      setIsDirty(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Vista recién creada sin draft publicado: lienzo vacío editable.
        setActiveDocument(emptyDocument());
        setEtag('');
        setIsDirty(true);
      } else {
        setError(err instanceof Error ? err.message : 'Error loading draft');
        setActiveDocument(emptyDocument());
      }
    } finally {
      setLoading(false);
    }
  }, [organizationId, setActiveDocument, setIsDirty, setEtag, setSaveStatus, setSaveError]);

  useEffect(() => {
    if (selection.panelId) {
      void loadPanelDraft(selection.panelId);
    } else {
      setActiveDocument(null);
      setEtag('');
      setIsDirty(false);
      setSaveStatus('idle');
      setSaveError(null);
    }
  }, [selection.panelId, loadPanelDraft, setActiveDocument, setIsDirty, setEtag, setSaveStatus, setSaveError]);

  if (!selection.panelId || !activePanel) {
    return (
      <main className="min-w-0 flex-1 flex flex-col items-center justify-center p-5 bg-background/50 text-center">
        <div className="max-w-sm space-y-2">
          <p className="text-sm font-medium text-text">{t('views.selectView')}</p>
          <p className="text-xs text-text-muted">{t('views.description')}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-w-0 flex-1 flex flex-col h-full bg-background overflow-hidden">
      <ViewsEditorToolbar />
      <ViewsCanvasBody loading={loading} error={error} />
    </main>
  );
}
