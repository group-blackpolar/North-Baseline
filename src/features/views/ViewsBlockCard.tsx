import { ArrowDown, ArrowUp, Copy, Trash } from '@phosphor-icons/react';
import { useViewsEditor } from './ViewsEditorContext';
import { useI18n } from '@/lib/i18n';
import type { PanelDocument } from '@/lib/northAdmin';

type Section = PanelDocument['sections'][number];
type Component = Section['components'][number];

export function ViewsBlockCard({
  section,
  comp,
  index,
  localName,
}: {
  section: Section;
  comp: Component;
  index: number;
  localName: (value?: Record<string, string>) => string;
}) {
  const { selection, selectComponent, duplicateComponent, removeComponent, moveComponent } = useViewsEditor();
  const { t } = useI18n();
  const isSelected = selection.componentId === comp.id;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        selectComponent(section.id, comp.id);
      }}
      className={`group col-span-12 rounded-xl border p-4 cursor-pointer ${
        isSelected ? 'border-accent bg-surface shadow-md ring-1 ring-accent' : 'border-border bg-surface'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase font-semibold text-text-muted">{comp.type}</span>
        {isSelected && (
          <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              title={t('views.inspector.moveUp')}
              disabled={index === 0}
              onClick={() => moveComponent(section.id, comp.id, -1)}
              className="p-1 rounded text-text-muted hover:text-text disabled:opacity-30"
            >
              <ArrowUp className="h-3 w-3" />
            </button>
            <button
              type="button"
              title={t('views.inspector.moveDown')}
              disabled={index === section.components.length - 1}
              onClick={() => moveComponent(section.id, comp.id, 1)}
              className="p-1 rounded text-text-muted hover:text-text disabled:opacity-30"
            >
              <ArrowDown className="h-3 w-3" />
            </button>
            <button
              type="button"
              title={t('views.inspector.duplicateBlock')}
              onClick={() => duplicateComponent(section.id, comp.id)}
              className="p-1 rounded text-text-muted hover:text-text"
            >
              <Copy className="h-3 w-3" />
            </button>
            <button
              type="button"
              title={t('views.inspector.removeBlock')}
              onClick={() => removeComponent(section.id, comp.id)}
              className="p-1 rounded text-text-muted hover:text-red-500"
            >
              <Trash className="h-3 w-3" />
            </button>
          </span>
        )}
      </div>
      {comp.type === 'heading' && <h2 className="text-lg font-bold">{localName(comp.props.text as Record<string, string>)}</h2>}
      {comp.type === 'metric' && (
        <div>
          <div className="text-xs text-text-muted">{localName(comp.props.label as Record<string, string>)}</div>
          <div className="text-2xl font-semibold">{String(comp.props.value ?? '')}</div>
        </div>
      )}
      {comp.type === 'card' && <div className="text-sm font-medium">{localName(comp.props.title as Record<string, string>)}</div>}
      {comp.type === 'link' && <div className="text-sm text-accent underline">{localName(comp.props.label as Record<string, string>)}</div>}
      {comp.type === 'list' && <div className="text-xs text-text-muted">Lista</div>}
      {comp.type === 'table' && <div className="text-xs text-text-muted">Tabla</div>}
      {comp.type === 'rich_text' && <div className="text-xs text-text-secondary">Texto enriquecido</div>}
      {comp.type === 'divider' && <hr className="border-border my-1" />}
      {['image', 'video', 'file', 'embed'].includes(comp.type) && (
        <div className="text-[11px] italic text-text-muted">Recurso validado por CoreCrow</div>
      )}
    </div>
  );
}
