import { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, Plus, Edit2, Archive } from 'lucide-react';
import { useViewsEditor } from './ViewsEditorContext';
import { useI18n } from '@/lib/i18n';
import type { ManagementCategory } from '@/lib/northAdmin';
import { ViewsSubcategoryNode } from './ViewsSubcategoryNode';

export function ViewsCategoryNode({
  cat,
  localName,
  handleDuplicate,
  handleArchive,
}: {
  cat: ManagementCategory;
  localName: (obj: Record<string, string>) => string;
  handleDuplicate: (kind: 'CATEGORY' | 'SUBCATEGORY' | 'PANEL', sourceId: string, currentSlug: string) => Promise<void>;
  handleArchive: (type: 'categories' | 'subcategories' | 'panels', id: string) => Promise<void>;
}) {
  const { selection, selectCategory, setModal } = useViewsEditor();
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);

  const isCatSelected = selection.categoryId === cat.id && !selection.subcategoryId && !selection.panelId;

  return (
    <div className="rounded-lg border border-transparent">
      <div
        onClick={() => selectCategory(cat.id)}
        className={`group flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors duration-150 ${
          isCatSelected ? 'bg-accent/10 text-accent font-medium' : 'text-text hover:bg-surface-hover'
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
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <Folder className="w-3.5 h-3.5 text-accent shrink-0" />
          <span className="truncate">{localName(cat.name)}</span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            title={t('views.addSubcategory')}
            onClick={(e) => {
              e.stopPropagation();
              setModal({ type: 'create_subcategory', categoryId: cat.id });
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
                resourceType: 'category',
                id: cat.id,
                currentName: localName(cat.name),
                currentSlug: cat.slug,
              });
            }}
            className="p-1 rounded hover:bg-surface text-text-muted hover:text-text"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          {cat.resourceKind !== 'SYSTEM' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleArchive('categories', cat.id);
              }}
              className="p-1 rounded hover:bg-surface text-text-muted hover:text-red-500"
            >
              <Archive className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="pl-4 pr-1 py-0.5 space-y-0.5 border-l border-border/50 ml-3.5 mt-0.5">
          {cat.subcategories.map((sub) => (
            <ViewsSubcategoryNode
              key={sub.id}
              catId={cat.id}
              sub={sub}
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
