import { Plus, Trash } from '@phosphor-icons/react';
import { useViewsEditor } from './ViewsEditorContext';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import type { PanelDocument } from '@/lib/northAdmin';
import { ViewsBlockCard } from './ViewsBlockCard';

type Section = PanelDocument['sections'][number];

export function ViewsSectionCard({
  section,
  localName,
}: {
  section: Section;
  localName: (value?: Record<string, string>) => string;
}) {
  const { selection, selectSection, setModal, removeSection } = useViewsEditor();
  const { t } = useI18n();
  const isSectionSelected = selection.sectionId === section.id && !selection.componentId;

  return (
    <section
      onClick={() => selectSection(section.id)}
      className={`rounded-2xl border p-4 space-y-3 cursor-pointer transition-colors ${
        isSectionSelected ? 'border-accent/60 bg-accent/5' : 'border-dashed border-border bg-surface/30'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase font-semibold text-text-muted tracking-wider">
          {t('views.inspector.section')} #{section.order + 1}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            title={t('views.inspector.addBlock')}
            onClick={(e) => {
              e.stopPropagation();
              setModal({ type: 'component_library', sectionId: section.id });
            }}
            className="h-6 px-2 text-[11px]"
          >
            <Plus className="h-3 w-3 mr-1" />
            {t('views.canvas.addBlock')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            title={t('views.inspector.removeSection')}
            onClick={(e) => {
              e.stopPropagation();
              removeSection(section.id);
            }}
            className="h-6 px-2 text-red-500"
          >
            <Trash className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-12 gap-3">
        {section.components.map((comp, index) => (
          <ViewsBlockCard key={comp.id} section={section} comp={comp} index={index} localName={localName} />
        ))}
      </div>
    </section>
  );
}
