import { useCallback, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowSquareOut, ArrowUp, Archive, ArrowsLeftRight, Copy, Eye, FolderPlus, PencilSimple, Plus, SidebarSimple } from '@phosphor-icons/react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { archiveResource, cloneTaxonomyResource, reorderResources, updatePanel, updateSubcategory } from '@/lib/northAdmin';
import { errorText } from '@/features/access-admin/ui';
import { selectClass } from '@/features/access-admin/ui';
import { localName, type ViewResource } from './resources';
import type { MenuItem } from './ContextMenu';
import type { ModalState } from '../ViewsEditorContext';

const API_TYPE = { CATEGORY: 'categories', SUBCATEGORY: 'subcategories', PANEL: 'panels' } as const;
const MODAL_TYPE = { CATEGORY: 'category', SUBCATEGORY: 'subcategory', PANEL: 'panel' } as const;

export interface ViewActionsInput {
  organizationId: string;
  resources: ViewResource[];
  refresh: () => Promise<boolean>;
  setModal: (modal: ModalState) => void;
  onEdit: (resource: ViewResource) => void;
  onOpen: (resource: ViewResource) => void;
  onInspect: (resource: ViewResource) => void;
  onError: (message: string) => void;
}

/**
 * Every structural operation of the workspace, expressed once. Only operations CORECROW already exposes are offered
 * (create/rename/archive/clone/reorder/move through PATCH). SYSTEM resources are read-only. Reordering always sends the
 * COMPLETE sibling list so the stored order can never become inconsistent.
 */
export function useViewActions(input: ViewActionsInput) {
  const { t, locale } = useI18n();
  const { organizationId, resources, refresh, setModal, onEdit, onOpen, onInspect, onError } = input;
  const [archiving, setArchiving] = useState<ViewResource | null>(null);
  const [moving, setMoving] = useState<ViewResource | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [target, setTarget] = useState('');

  const siblings = useCallback((resource: ViewResource) => resources.filter((item) => item.kind === resource.kind && item.parentId === resource.parentId), [resources]);

  const run = useCallback(async (work: () => Promise<unknown>) => {
    try { await work(); await refresh(); return true; } catch (reason) { onError(errorText(reason)); return false; }
  }, [onError, refresh]);

  const reorder = (resource: ViewResource, direction: -1 | 1) => {
    const list = siblings(resource);
    const index = list.findIndex((item) => item.id === resource.id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= list.length) return;
    const ids = list.map((item) => item.id);
    [ids[index], ids[next]] = [ids[next]!, ids[index]!];
    void run(() => reorderResources(organizationId, resource.kind, ids, resource.parentId ?? undefined));
  };

  const duplicate = (resource: ViewResource) => void run(() => cloneTaxonomyResource(organizationId, {
    kind: resource.kind, sourceId: resource.id, slug: `${resource.slug}-copy-${Math.random().toString(36).slice(2, 6)}`,
    ...(resource.parentId ? { destinationParentId: resource.parentId } : {}),
  }));

  const openRename = (resource: ViewResource) => setModal({ type: 'rename', resourceType: MODAL_TYPE[resource.kind], id: resource.id, currentName: localName(resource.name, locale), currentSlug: resource.slug });

  const requestArchive = (resource: ViewResource) => { setDialogError(null); setArchiving(resource); };

  const confirmArchive = async () => {
    if (!archiving) return;
    setBusy(true); setDialogError(null);
    try { await archiveResource(organizationId, API_TYPE[archiving.kind], archiving.id); setArchiving(null); await refresh(); }
    catch (reason) { setDialogError(errorText(reason)); } finally { setBusy(false); }
  };

  const moveTargets = moving ? resources.filter((item) => item.kind === (moving.kind === 'PANEL' ? 'SUBCATEGORY' : 'CATEGORY') && item.id !== moving.parentId && item.status !== 'ARCHIVED' && item.resourceKind === 'CONTENT') : [];
  const confirmMove = async () => {
    if (!moving || !target) return;
    setBusy(true); setDialogError(null);
    try {
      const meta = { name: moving.name, slug: moving.slug };
      if (moving.kind === 'PANEL') await updatePanel(organizationId, moving.id, { ...meta, subcategoryId: target });
      else await updateSubcategory(organizationId, moving.id, { ...meta, categoryId: target });
      setMoving(null); setTarget('');
      await refresh();
    } catch (reason) { setDialogError(errorText(reason)); } finally { setBusy(false); }
  };

  /** Menu for one resource. `compact` omits navigation-only entries the surrounding UI already provides. */
  const menuFor = useCallback((resource: ViewResource): MenuItem[] => {
    const locked = resource.resourceKind === 'SYSTEM';
    const archived = resource.status === 'ARCHIVED';
    const list = siblings(resource);
    const index = list.findIndex((item) => item.id === resource.id);
    const items: MenuItem[] = [];
    const item = (id: string, label: string, icon: ReactNode, onSelect: () => void, extra: Partial<Extract<MenuItem, { type: 'item' }>> = {}): MenuItem => ({ type: 'item', id, label, icon, onSelect, ...extra });

    items.push(item('inspect', t('adm2.views.act.inspect'), <SidebarSimple />, () => onInspect(resource)));
    if (resource.kind === 'PANEL') {
      items.push(item('open', t('adm2.views.act.open'), <ArrowSquareOut />, () => onOpen(resource), { disabled: resource.status !== 'PUBLISHED' }));
      items.push(item('edit', t('adm2.views.act.edit'), <PencilSimple />, () => onEdit(resource), { disabled: locked || archived }));
      items.push(item('preview', t('adm2.views.act.preview'), <Eye />, () => onEdit(resource), { disabled: locked || archived }));
    }
    if (resource.kind === 'CATEGORY') items.push(item('add-sub', t('adm2.views.act.newSubcategory'), <FolderPlus />, () => setModal({ type: 'create_subcategory', categoryId: resource.id }), { disabled: locked || archived }));
    if (resource.kind === 'SUBCATEGORY') items.push(item('add-view', t('adm2.views.act.newView'), <Plus />, () => setModal({ type: 'create_view', categoryId: resource.categoryId, subcategoryId: resource.id }), { disabled: locked || archived }));
    items.push({ type: 'separator' });
    items.push(item('rename', t('adm2.views.act.rename'), <PencilSimple />, () => openRename(resource), { disabled: locked || archived, hint: 'F2' }));
    items.push(item('duplicate', t('adm2.views.act.duplicate'), <Copy />, () => duplicate(resource), { disabled: locked || archived }));
    if (resource.kind !== 'CATEGORY') items.push(item('move', t('adm2.views.act.move'), <ArrowsLeftRight />, () => { setTarget(''); setDialogError(null); setMoving(resource); }, { disabled: locked || archived }));
    items.push(item('up', t('adm2.views.act.moveUp'), <ArrowUp />, () => reorder(resource, -1), { disabled: locked || index <= 0 }));
    items.push(item('down', t('adm2.views.act.moveDown'), <ArrowDown />, () => reorder(resource, 1), { disabled: locked || index < 0 || index >= list.length - 1 }));
    items.push({ type: 'separator' });
    items.push(item('archive', t('adm2.views.act.archive'), <Archive />, () => requestArchive(resource), { danger: true, disabled: locked || archived }));
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siblings, t, onInspect, onOpen, onEdit, setModal, locale]);

  const dialogs = (
    <>
      <ConfirmDialog
        open={Boolean(archiving)} destructive busy={busy} error={dialogError}
        title={t('adm2.views.archive.title')} description={archiving ? t('adm2.views.archive.body', { name: localName(archiving.name, locale) }) : undefined}
        confirmLabel={t('adm2.views.act.archive')} onCancel={() => setArchiving(null)} onConfirm={() => void confirmArchive()}
      />
      <Dialog
        open={Boolean(moving)} onOpenChange={(open) => { if (!open && !busy) setMoving(null); }} size="sm"
        title={t('adm2.views.move.title')} description={moving ? t('adm2.views.move.body', { name: localName(moving.name, locale) }) : undefined}
        footer={<><Button variant="ghost" disabled={busy} onClick={() => setMoving(null)}>{t('access.cancel')}</Button><Button variant="accent" loading={busy} disabled={!target} onClick={() => void confirmMove()}>{t('adm2.views.act.move')}</Button></>}
      >
        <label className="block space-y-1">
          <span className="ui-label">{moving?.kind === 'PANEL' ? t('adm2.views.move.subcategory') : t('adm2.views.move.category')}</span>
          <select className={`${selectClass} w-full`} value={target} onChange={(event) => setTarget(event.target.value)}>
            <option value="">{t('adm2.views.move.pick')}</option>
            {moveTargets.map((item) => <option key={item.id} value={item.id}>{item.kind === 'SUBCATEGORY' ? `${localName(item.categoryName, locale)} / ` : ''}{localName(item.name, locale)}</option>)}
          </select>
        </label>
        {dialogError ? <p role="alert" className="mt-2 text-xs text-error">{dialogError}</p> : null}
      </Dialog>
    </>
  );

  return { menuFor, dialogs, reorder, duplicate, openRename, requestArchive };
}
