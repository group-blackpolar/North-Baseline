import { Loader2, Plus, Code2 } from 'lucide-react';
import { useViewsEditor } from './ViewsEditorContext';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { ViewsSectionCard } from './ViewsSectionCard';
import { ViewsSettingsTab } from './ViewsSettingsTab';
import { ViewsRevisionsTab } from './ViewsRevisionsTab';
import { ViewsPreview } from './ViewsPreview';

export function ViewsCanvasBody({ loading, error }: { loading: boolean; error: string | null }) {
  const { activePanel, selection, activeMode, activeDocument, addSection, setModal } = useViewsEditor();
  const { locale, t } = useI18n();

  const localName = (nameObj?: Record<string, string>) =>
    nameObj ? nameObj[locale] ?? nameObj.es ?? nameObj.en ?? Object.values(nameObj)[0] ?? '' : '';

  if (!selection.panelId || !activePanel) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background/50 text-center">
        <div className="max-w-sm space-y-2">
          <p className="text-sm font-medium text-text">{t('views.selectView')}</p>
          <p className="text-xs text-text-muted">{t('views.description')}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20 text-xs text-text-muted">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span>{t('admin.loading')}</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {error && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      {activeDocument && activeMode === 'settings' && <ViewsSettingsTab />}
      {activeDocument && activeMode === 'revisions' && <ViewsRevisionsTab />}
      {activeDocument && activeMode === 'preview' && <ViewsPreview />}
      {activeDocument && activeMode === 'editor' && (
        <div className="max-w-4xl mx-auto space-y-6">
          {activeDocument.sections.map((section) => (
            <ViewsSectionCard key={section.id} section={section} localName={localName} />
          ))}
          <div className="flex justify-center gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={addSection} className="text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t('views.inspector.addSection')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModal({ type: 'dev_json' })}
              className="text-xs"
            >
              <Code2 className="h-3.5 w-3.5 mr-1" />
              {t('views.devJson.title')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
