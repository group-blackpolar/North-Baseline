import { useCallback, useEffect, useState } from 'react';
import { CircleNotch, ClockCounterClockwise, Eye } from '@phosphor-icons/react';
import { useViewsEditor } from './ViewsEditorContext';
import { useI18n } from '@/lib/i18n';
import {
  listRevisions,
  readRevision,
  restoreRevision,
  type PanelRevision,
  type PanelRevisionSummary,
} from '@/lib/northAdmin';
import { Button } from '@/components/ui/button';

/** Fase 6: historial visual con preview seguro y restore como borrador. */
export function ViewsRevisionsTab() {
  const { organizationId, selection, etag, saveNow, setActiveDocument, setIsDirty, setEtag } = useViewsEditor();
  const { t } = useI18n();
  const [items, setItems] = useState<PanelRevisionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inspected, setInspected] = useState<PanelRevision | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selection.panelId) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await listRevisions(organizationId, selection.panelId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [organizationId, selection.panelId]);

  useEffect(() => {
    setInspected(null);
    setNotice(null);
    void load();
  }, [load]);

  const handleRestore = async (revisionId: string) => {
    if (!selection.panelId || restoring) return;
    setRestoring(true);
    setError(null);
    try {
      // Guardar primero el trabajo actual evita perder el draft en curso.
      if (!etag) await saveNow();
      const next = await restoreRevision(organizationId, selection.panelId, revisionId, etag);
      setActiveDocument(next.document);
      // The restore created a new draft revision: keep its ETag, or the next autosave would conflict with itself.
      setEtag(next.etag);
      setIsDirty(false);
      setNotice(t('views.revisions.restored'));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setRestoring(false);
    }
  };

  const handleInspect = async (revisionId: string) => {
    if (!selection.panelId) return;
    try {
      setInspected(await readRevision(organizationId, selection.panelId, revisionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
          <ClockCounterClockwise className="h-4 w-4 text-accent" />
          {t('views.revisions.title')} ({items.length})
        </h2>
        {loading && (
          <div className="mt-4 flex items-center gap-2 text-xs text-text-muted">
            <CircleNotch className="h-4 w-4 animate-spin" />
            {t('admin.loading')}
          </div>
        )}
        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
        {notice && <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400">{notice}</p>}
        {!loading && items.length === 0 && (
          <p className="mt-3 text-xs text-text-muted">{t('views.revisions.empty')}</p>
        )}
        <div className="mt-3 space-y-1.5">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs"
            >
              <span className="text-text-secondary">
                v{item.revisionNumber} · {new Date(item.createdAt).toLocaleString()}
              </span>
              <span className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={restoring}
                  onClick={() => void handleRestore(item.id)}
                  className="h-6 text-[11px] px-2"
                >
                  {t('views.revisions.restore')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleInspect(item.id)}
                  className="h-6 text-[11px] px-2"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  {t('views.revisions.preview')}
                </Button>
              </span>
            </div>
          ))}
        </div>
      </div>
      {inspected && (
        <div className="rounded-2xl border border-border bg-surface p-4 text-xs">
          <div className="flex justify-between items-center">
            <strong>
              {t('views.revisions.preview')} v{inspected.revisionNumber}
            </strong>
            <Button type="button" variant="outline" size="sm" onClick={() => setInspected(null)} className="h-6 text-[11px]">
              {t('views.revisions.backToDraft')}
            </Button>
          </div>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-background p-3 font-mono text-[11px]">
            {JSON.stringify(inspected.document, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
