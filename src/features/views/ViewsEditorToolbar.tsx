import { useState } from 'react';
import { useViewsEditor } from './ViewsEditorContext';
import { useI18n } from '@/lib/i18n';
import { saveDraft, publishDraft } from '@/lib/northAdmin';
import { Button } from '@/components/ui/button';
import { Eye, Edit3, Settings, History, Check, Loader2, ArrowUpRight } from 'lucide-react';

export function ViewsEditorToolbar({ etag, setEtag }: { etag: string; setEtag: (tag: string) => void }) {
  const {
    organizationId,
    activePanel,
    selection,
    activeMode,
    setActiveMode,
    activeDocument,
    isDirty,
    setIsDirty,
    refreshTaxonomy,
  } = useViewsEditor();
  const { locale, t } = useI18n();

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const localName = (nameObj?: Record<string, string>) =>
    nameObj ? nameObj[locale] ?? nameObj.es ?? nameObj.en ?? Object.values(nameObj)[0] ?? '' : '';

  const handleSave = async () => {
    if (!selection.panelId || !activeDocument || saving) return;
    setSaving(true);
    try {
      const saved = await saveDraft(organizationId, selection.panelId, activeDocument, etag || undefined);
      setEtag(saved.etag);
      setIsDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!selection.panelId || publishing) return;
    setPublishing(true);
    try {
      let currentEtag = etag;
      if (isDirty && activeDocument) {
        const saved = await saveDraft(organizationId, selection.panelId, activeDocument, etag || undefined);
        currentEtag = saved.etag;
        setEtag(saved.etag);
        setIsDirty(false);
      }
      const pub = await publishDraft(organizationId, selection.panelId, currentEtag);
      setEtag(pub.etag);
      await refreshTaxonomy();
    } finally {
      setPublishing(false);
    }
  };

  if (!activePanel) return null;

  return (
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
          disabled={publishing}
          className="h-8 text-xs gap-1.5"
        >
          {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
          <span>{publishing ? t('views.saving') : t('views.publish')}</span>
        </Button>
      </div>
    </header>
  );
}
