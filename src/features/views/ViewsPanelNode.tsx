import { Archive, Copy, FileText, PencilSimple } from '@phosphor-icons/react';
import { useViewsEditor } from './ViewsEditorContext';
import { useI18n } from '@/lib/i18n';
import type { TaxonomyPanel } from '@/lib/northAdmin';

export function ViewsPanelNode({
  catId,
  subId,
  panel,
  localName,
  handleDuplicate,
  handleArchive,
}: {
  catId: string;
  subId: string;
  panel: TaxonomyPanel;
  localName: (obj: Record<string, string>) => string;
  handleDuplicate: (kind: 'CATEGORY' | 'SUBCATEGORY' | 'PANEL', sourceId: string, currentSlug: string) => Promise<void>;
  handleArchive: (type: 'categories' | 'subcategories' | 'panels', id: string) => Promise<void>;
}) {
  const { selection, selectPanel, setModal } = useViewsEditor();
  const { t } = useI18n();

  const isPanelSelected = selection.panelId === panel.id;
  const isPublished = panel.status === 'PUBLISHED';
  const isDraft = panel.status === 'DRAFT';

  return (
    <div
      onClick={() => selectPanel(catId, subId, panel.id)}
      className={`group flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors duration-(--duration-fast) ${
        isPanelSelected ? 'bg-accent/10 text-accent font-medium' : 'text-text-secondary hover:bg-surface-hover hover:text-text'
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <FileText className="w-3 h-3 text-text-muted shrink-0" />
        <span className="truncate">{localName(panel.name)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
            isPublished
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : isDraft
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : 'bg-surface-hover text-text-muted line-through'
          }`}
        >
          {isPublished ? 'Live' : 'Draft'}
        </span>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
          <button
            type="button"
            title={t('views.duplicate')}
            onClick={(e) => {
              e.stopPropagation();
              void handleDuplicate('PANEL', panel.id, panel.slug);
            }}
            className="p-1 rounded hover:bg-surface text-text-muted hover:text-text"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            type="button"
            title={t('views.rename')}
            onClick={(e) => {
              e.stopPropagation();
              setModal({
                type: 'rename',
                resourceType: 'panel',
                id: panel.id,
                currentName: localName(panel.name),
                currentSlug: panel.slug,
              });
            }}
            className="p-1 rounded hover:bg-surface text-text-muted hover:text-text"
          >
            <PencilSimple className="w-3 h-3" />
          </button>
          {panel.resourceKind !== 'SYSTEM' && (
            <button
              type="button"
              title={t('views.archive')}
              onClick={(e) => {
                e.stopPropagation();
                void handleArchive('panels', panel.id);
              }}
              className="p-1 rounded hover:bg-surface text-text-muted hover:text-red-500"
            >
              <Archive className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
