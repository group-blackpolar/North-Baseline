import { useEffect, useState, useCallback } from 'react';
import { useViewsEditor } from './ViewsEditorContext';
import { useI18n } from '@/lib/i18n';
import { getDraft } from '@/lib/northAdmin';
import { ViewsEditorToolbar } from './ViewsEditorToolbar';
import { ViewsCanvasBody } from './ViewsCanvasBody';
import { emptyDocument } from '@/features/admin/contentDocument';

export function ViewsEditorCanvas() {
  const {
    organizationId,
    activePanel,
    selection,
    setActiveDocument,
    setIsDirty,
  } = useViewsEditor();
  const { t } = useI18n();

  const [loading, setLoading] = useState(false);
  const [etag, setEtag] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const loadPanelDraft = useCallback(async (panelId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDraft(organizationId, panelId);
      setActiveDocument(res.document);
      setEtag(res.etag);
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading draft');
      setActiveDocument(emptyDocument());
    } finally {
      setLoading(false);
    }
  }, [organizationId, setActiveDocument, setIsDirty]);

  useEffect(() => {
    if (selection.panelId) {
      void loadPanelDraft(selection.panelId);
    } else {
      setActiveDocument(null);
      setEtag('');
      setIsDirty(false);
    }
  }, [selection.panelId, loadPanelDraft, setActiveDocument, setIsDirty]);

  if (!selection.panelId || !activePanel) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-8 bg-background/50 text-center">
        <div className="max-w-sm space-y-2">
          <p className="text-sm font-medium text-text">{t('views.selectView')}</p>
          <p className="text-xs text-text-muted">{t('views.description')}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      <ViewsEditorToolbar etag={etag} setEtag={setEtag} />
      <ViewsCanvasBody loading={loading} error={error} />
    </main>
  );
}
