import { useViewsEditor } from './ViewsEditorContext';
import { useI18n } from '@/lib/i18n';
import { ArrowDown, ArrowUp, Copy, Plus, SlidersHorizontal, Trash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { InspectorComponentForm } from './InspectorComponentForm';

export function ViewsInspectorPane() {
  const {
    selection,
    activePanel,
    activeDocument,
    setModal,
    addSection,
    removeSection,
    duplicateComponent,
    removeComponent,
    moveComponent,
  } = useViewsEditor();
  const { locale, t } = useI18n();

  const localName = (nameObj?: Record<string, string>) =>
    nameObj ? nameObj[locale] ?? nameObj.es ?? nameObj.en ?? Object.values(nameObj)[0] ?? '' : '';

  const section = activeDocument?.sections.find((item) => item.id === selection.sectionId);
  const hasComponent = Boolean(section && selection.componentId);

  return (
    <aside className="w-80 max-[1599px]:w-72 max-[1399px]:w-48 shrink-0 border-l border-border bg-surface flex flex-col h-full select-none">
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <SlidersHorizontal className="w-4 h-4 text-accent" />
        <span className="text-xs font-semibold text-text uppercase tracking-wider">{t('views.inspector.title')}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {!activePanel && (
          <div className="text-center py-12 text-xs text-text-muted">
            {t('views.inspector.noSelection')}
          </div>
        )}

        {activePanel && (
          <div className="space-y-4">
            {hasComponent && section && selection.componentId && (
              <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 space-y-3">
                <InspectorComponentForm />
                <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    title={t('views.inspector.moveUp')}
                    onClick={() => moveComponent(section.id, selection.componentId!, -1)}
                    className="h-7 px-2"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    title={t('views.inspector.moveDown')}
                    onClick={() => moveComponent(section.id, selection.componentId!, 1)}
                    className="h-7 px-2"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    title={t('views.inspector.duplicateBlock')}
                    onClick={() => duplicateComponent(section.id, selection.componentId!)}
                    className="h-7 px-2"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    title={t('views.inspector.removeBlock')}
                    onClick={() => removeComponent(section.id, selection.componentId!)}
                    className="h-7 px-2 text-red-500 hover:text-red-600"
                  >
                    <Trash className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            {section && !selection.componentId && (
              <div className="rounded-xl border border-border p-3 space-y-2">
                <div className="text-xs font-medium text-text">
                  {t('views.inspector.section')} #{section.order + 1}
                </div>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setModal({ type: 'component_library', sectionId: section.id })}
                    className="h-7 flex-1 text-[11px]"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {t('views.inspector.addBlock')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    title={t('views.inspector.removeSection')}
                    onClick={() => removeSection(section.id)}
                    className="h-7 px-2 text-red-500"
                  >
                    <Trash className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            <div>
              <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">{t('views.nameLabel')}</span>
              <div className="mt-1 text-sm font-medium text-text">{localName(activePanel.name)}</div>
            </div>

            <div>
              <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">{t('views.slugLabel')}</span>
              <div className="mt-1 font-mono text-xs text-text-secondary bg-surface-hover/70 px-2 py-1 rounded">
                /{activePanel.slug}
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSection}
                className="h-7 w-full text-[11px]"
              >
                <Plus className="h-3 w-3 mr-1" />
                {t('views.inspector.addSection')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
