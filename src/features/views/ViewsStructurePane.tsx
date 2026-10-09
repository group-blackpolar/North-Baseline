import { useState } from 'react';
import { Plus, Stack } from '@phosphor-icons/react';
import { useViewsEditor } from './ViewsEditorContext';
import { useI18n } from '@/lib/i18n';
import { archiveResource, cloneTaxonomyResource } from '@/lib/northAdmin';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ViewsCategoryNode } from './ViewsCategoryNode';

export function ViewsStructurePane() {
  const {
    taxonomy,
    loading,
    setModal,
    organizationId,
    refreshTaxonomy,
  } = useViewsEditor();
  const { locale, t } = useI18n();

  const localName = (nameObj: Record<string, string>) =>
    nameObj[locale] ?? nameObj.es ?? nameObj.en ?? Object.values(nameObj)[0] ?? '';

  // Archiving asks through the NORTH dialog; failures show inline (never a native confirm/alert).
  const [pendingArchive, setPendingArchive] = useState<{ type: 'categories' | 'subcategories' | 'panels'; id: string } | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const handleArchive = async (type: 'categories' | 'subcategories' | 'panels', id: string) => { setActionError(null); setPendingArchive({ type, id }); };
  const confirmArchive = async () => {
    if (!pendingArchive) return;
    setArchiving(true);
    try {
      await archiveResource(organizationId, pendingArchive.type, pendingArchive.id);
      await refreshTaxonomy();
      setPendingArchive(null);
    } catch (err) {
      setPendingArchive(null);
      setActionError(err instanceof Error ? err.message : t('state.loadError'));
    } finally { setArchiving(false); }
  };

  const handleDuplicate = async (kind: 'CATEGORY' | 'SUBCATEGORY' | 'PANEL', sourceId: string, currentSlug: string) => {
    try {
      await cloneTaxonomyResource(organizationId, {
        kind,
        sourceId,
        slug: `${currentSlug}-copy-${Math.floor(Math.random() * 1000)}`,
      });
      await refreshTaxonomy();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('state.loadError'));
    }
  };

  return (
    <>
    <aside className="w-80 max-[1599px]:w-72 max-[1399px]:w-48 shrink-0 border-r border-border bg-surface flex flex-col h-full select-none">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Stack className="w-4 h-4 text-accent" />
          <span className="text-xs font-semibold text-text uppercase tracking-wider">{t('views.structure')}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          aria-label={t('views.addCategory')}
          title={t('views.addCategory')}
          onClick={() => setModal({ type: 'create_category' })}
          className="h-7 text-xs gap-1 px-2 text-text hover:text-accent"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="max-[1399px]:sr-only">{t('views.addCategory')}</span>
        </Button>
      </div>

      {actionError ? <p role="alert" className="border-b border-border bg-error/5 px-3 py-2 text-xs text-error">{actionError}</p> : null}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading && !taxonomy && (
          <div className="p-4 text-center text-xs text-text-muted">{t('admin.loading')}</div>
        )}
        {taxonomy && taxonomy.length === 0 && (
          <div className="p-6 text-center space-y-2">
            <p className="text-xs text-text-muted">{t('views.emptyStructure')}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModal({ type: 'create_category' })}
              className="text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              {t('views.addCategory')}
            </Button>
          </div>
        )}
        {taxonomy?.map((cat) => (
          <ViewsCategoryNode
            key={cat.id}
            cat={cat}
            localName={localName}
            handleDuplicate={handleDuplicate}
            handleArchive={handleArchive}
          />
        ))}
      </div>
    </aside>
    <ConfirmDialog
      open={Boolean(pendingArchive)}
      title={t('views.archive')}
      description={t('views.archiveConfirm')}
      confirmLabel={t('views.archive')}
      destructive
      busy={archiving}
      onConfirm={() => void confirmArchive()}
      onCancel={() => setPendingArchive(null)}
    />
    </>
  );
}

