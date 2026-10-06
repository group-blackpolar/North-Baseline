import { useState } from 'react';
import { Archive, CaretDown, CaretRight, FolderPlus, PencilSimple, Plus } from '@phosphor-icons/react';
import { useViewsEditor } from './ViewsEditorContext';
import { useI18n } from '@/lib/i18n';
import type { ManagementCategory } from '@/lib/northAdmin';
import { ViewsPanelNode } from './ViewsPanelNode';

type SubcategoryWithPanels = ManagementCategory['subcategories'][number];

export function ViewsSubcategoryNode({
  catId,
  sub,
  localName,
  handleDuplicate,
  handleArchive,
}: {
  catId: string;
  sub: SubcategoryWithPanels;
  localName: (obj: Record<string, string>) => string;
  handleDuplicate: (kind: 'CATEGORY' | 'SUBCATEGORY' | 'PANEL', sourceId: string, currentSlug: string) => Promise<void>;
  handleArchive: (type: 'categories' | 'subcategories' | 'panels', id: string) => Promise<void>;
}) {
  const { selection, selectSubcategory, setModal } = useViewsEditor();
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);

  const isSubSelected = selection.subcategoryId === sub.id && !selection.panelId;

  return (
    <div>
      <div
        onClick={() => selectSubcategory(catId, sub.id)}
        className={`group flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors duration-150 ${
          isSubSelected ? 'bg-accent/10 text-accent font-medium' : 'text-text hover:bg-surface-hover'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed(!collapsed);
            }}
            className="p-0.5 rounded text-text-muted hover:text-text"
          >
            {collapsed ? <CaretRight className="w-3 h-3" /> : <CaretDown className="w-3 h-3" />}
          </button>
          <FolderPlus className="w-3 h-3 text-text-muted shrink-0" />
          <span className="truncate">{localName(sub.name)}</span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            title={t('views.addView')}
            onClick={(e) => {
              e.stopPropagation();
              setModal({ type: 'create_view', categoryId: catId, subcategoryId: sub.id });
            }}
            className="p-1 rounded hover:bg-surface text-text-muted hover:text-text"
          >
            <Plus className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setModal({
                type: 'rename',
                resourceType: 'subcategory',
                id: sub.id,
                currentName: localName(sub.name),
                currentSlug: sub.slug,
              });
            }}
            className="p-1 rounded hover:bg-surface text-text-muted hover:text-text"
          >
            <PencilSimple className="w-3 h-3" />
          </button>
          {sub.resourceKind !== 'SYSTEM' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleArchive('subcategories', sub.id);
              }}
              className="p-1 rounded hover:bg-surface text-text-muted hover:text-red-500"
            >
              <Archive className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="pl-4 pr-1 py-0.5 space-y-0.5 border-l border-border/50 ml-3 mt-0.5">
          {sub.panels.map((panel) => (
            <ViewsPanelNode
              key={panel.id}
              catId={catId}
              subId={sub.id}
              panel={panel}
              localName={localName}
              handleDuplicate={handleDuplicate}
              handleArchive={handleArchive}
            />
          ))}
        </div>
      )}
    </div>
  );
}
