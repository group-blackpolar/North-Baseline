import { Loader2, Plus } from 'lucide-react';
import { useViewsEditor } from './ViewsEditorContext';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { ViewsSectionCard } from './ViewsSectionCard';

export function ViewsCanvasBody({ loading, error }: { loading: boolean; error: string | null }) {
  const { activePanel, selection, activeMode, activeDocument, addSection } = useViewsEditor();
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
      {activeDocument && activeMode === 'editor' && (
        <div className="max-w-4xl mx-auto space-y-6">
          {activeDocument.sections.map((section) => (
            <ViewsSectionCard key={section.id} section={section} localName={localName} />
          ))}
          <div className="flex justify-center pt-2">
            <Button type="button" variant="outline" size="sm" onClick={addSection} className="text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t('views.inspector.addSection')}
            </Button>
          </div>
        </div>
      )}
      {activeDocument && activeMode === 'preview' && (
        <div className="max-w-4xl mx-auto rounded-2xl border border-border bg-surface p-8 space-y-6">
          <h1 className="text-xl font-bold">{localName(activePanel.name)}</h1>
          {activeDocument.sections.map((section) => (
            <div key={section.id} className="grid grid-cols-12 gap-4">
              {section.components.map((comp) => (
                <div key={comp.id} className="col-span-12">
                  {comp.type === 'heading' && <h2 className="text-base font-semibold">{localName(comp.props.text as Record<string, string>)}</h2>}
                  {comp.type === 'metric' && (
                    <div className="rounded-xl border border-border p-4 bg-background">
                      <div className="text-xs text-text-muted">{localName(comp.props.label as Record<string, string>)}</div>
                      <div className="text-2xl font-bold mt-1">{String(comp.props.value ?? '')}</div>
                    </div>
                  )}
                  {comp.type === 'card' && <div className="rounded-xl border p-4">{localName(comp.props.title as Record<string, string>)}</div>}
                  {comp.type === 'divider' && <hr className="border-border my-2" />}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
