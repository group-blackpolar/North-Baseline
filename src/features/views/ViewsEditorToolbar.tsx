import { useState } from 'react';
import { useViewsEditor } from './ViewsEditorContext';
import { useI18n } from '@/lib/i18n';
import { publishDraft } from '@/lib/northAdmin';
import { hasUnsafeContent } from '@/features/admin/contentDocument';
import { Button } from '@/components/ui/button';
import { Eye, Edit3, Settings, History, Check, Loader2, ArrowUpRight, AlertTriangle } from 'lucide-react';

export function ViewsEditorToolbar() {
  const {
    organizationId,
    activePanel,
    selection,
    activeMode,
    setActiveMode,
    activeDocument,
    isDirty,
    etag,
    setEtag,
    saveStatus,
    saveError,
    saveNow,
    conflict,
    reloadDraft,
    refreshTaxonomy,
  } = useViewsEditor();
  const { locale, t } = useI18n();

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const localName = (nameObj?: Record<string, string>) =>
    nameObj ? nameObj[locale] ?? nameObj.es ?? nameObj.en ?? Object.values(nameObj)[0] ?? '' : '';

  const saving = saveStatus === 'saving';
  const unsafe = saveError === 'unsafe' || (activeDocument ? hasUnsafeContent(activeDocument) : false);

  const handleSave = () => {
    setPublishError(null);
    void saveNow();
  };

  const handlePublish = async () => {
    if (!selection.panelId || publishing) return;
    // Fase 5: validación previa al publish — nunca publicar contenido ejecutable.
    if (!activeDocument || hasUnsafeContent(activeDocument)) {
      setPublishError(t('views.publishUnsafe'));
      return;
    }
    setPublishing(true);
    setPublishError(null);
    try {
      let currentEtag = etag;
      if (isDirty) {
        const ok = await saveNow();
        // Si el guardado previo falló (conflicto u otro error), no publicar.
        if (!ok) return;
        currentEtag = etag;
      }
      const pub = await publishDraft(organizationId, selection.panelId, currentEtag);
      setEtag(pub.etag);
      await refreshTaxonomy();
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : 'Request failed');
    } finally {
      setPublishing(false);
    }
  };

  if (!activePanel) return null;

  return (
  <>
    <header className="h-14 shrink-0 border-b border-border bg-surface px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-text flex items-center gap-2">
          <span>{localName(activePanel.name)}</span>
          <span className="text-[11px] font-mono text-text-muted font-normal">/{activePanel.slug}</span>
        </h1>
        {isDirty && (
          <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium px-1.5 py-0.5 rounded">
            {t('views.unsavedChanges')}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 rounded-lg bg-surface-hover/80 p-0.5">
        <button
          type="button"
          onClick={() => setActiveMode('editor')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            activeMode === 'editor' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
          }`}
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>{t('views.editor')}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMode('preview')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            activeMode === 'preview' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>{t('views.preview')}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMode('settings')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            activeMode === 'settings' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>{t('views.settings')}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMode('revisions')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            activeMode === 'revisions' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>{t('views.revisions')}</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] text-text-muted" role="status">
          {saving
            ? t('views.autosave.saving')
            : saveStatus === 'saved' && !isDirty
              ? t('views.autosave.saved')
              : saveError === 'conflict' || conflict
                ? t('views.autosave.conflictShort')
                : saveError === 'unsafe'
                  ? t('views.autosave.unsafeShort')
                  : saveStatus === 'error'
                    ? t('views.autosave.errorShort')
                    : ''}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="h-8 text-xs gap-1.5"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          <span>{saving ? t('views.saving') : t('views.saveDraft')}</span>
        </Button>
        <Button
          size="sm"
          onClick={handlePublish}
          disabled={publishing || unsafe}
          title={unsafe ? t('views.publishUnsafe') : undefined}
          className="h-8 text-xs gap-1.5"
        >
          {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
          <span>{publishing ? t('views.saving') : t('views.publish')}</span>
        </Button>
      </div>
    </header>
    {(publishError || saveError === 'conflict' || conflict || unsafe) && (
      <div className="shrink-0 border-b border-border bg-surface px-4 py-2 flex items-center gap-2 text-[11px] text-text-secondary">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <span className="flex-1">
          {unsafe
            ? t('views.publishUnsafe')
            : saveError === 'conflict' || conflict
              ? t('views.autosave.conflict')
              : publishError ?? ''}
        </span>
        {(saveError === 'conflict' || conflict) && (
          <Button variant="outline" size="sm" onClick={() => void reloadDraft()} className="h-6 text-[11px] px-2">
            {t('views.autosave.reload')}
          </Button>
        )}
      </div>
    )}
  </>
  );
}
